"""Bounded cross-process Redis channel-layer verification for A16.

This probe deliberately uses an explicit ``A16_REDIS_URL`` and a unique Redis
key prefix/group. It never uses the application's ``calendar_updates`` group.
Run it only against an isolated development Redis database.
"""

from __future__ import annotations

import asyncio
import multiprocessing
import os
import queue
import sys
import uuid
from dataclasses import dataclass

from channels_redis.core import RedisChannelLayer


PROCESS_TIMEOUT = 10
MESSAGE_TIMEOUT = 3
NO_MESSAGE_TIMEOUT = 0.5


def make_layer(redis_url: str, prefix: str) -> RedisChannelLayer:
    return RedisChannelLayer(
        hosts=[redis_url],
        prefix=prefix,
        expiry=10,
        group_expiry=20,
        capacity=20,
    )


async def subscriber_session(
    label: str,
    redis_url: str,
    prefix: str,
    group: str,
    commands,
    results,
) -> None:
    layer = make_layer(redis_url, prefix)
    channel = await layer.new_channel(f"a16.{label}")
    joined = False
    try:
        await layer.group_add(group, channel)
        joined = True
        results.put((label, "ready", channel))

        while True:
            command, value = await asyncio.to_thread(commands.get)
            if command == "receive":
                messages = []
                for _ in range(value):
                    messages.append(
                        await asyncio.wait_for(
                            layer.receive(channel),
                            timeout=MESSAGE_TIMEOUT,
                        )
                    )
                results.put((label, "messages", messages))
            elif command == "expect_none":
                try:
                    message = await asyncio.wait_for(
                        layer.receive(channel),
                        timeout=NO_MESSAGE_TIMEOUT,
                    )
                except TimeoutError:
                    results.put((label, "none", None))
                else:
                    results.put((label, "unexpected", message))
            elif command == "leave":
                await layer.group_discard(group, channel)
                joined = False
                results.put((label, "left", None))
            elif command == "stop":
                break
            else:
                raise AssertionError(f"Unsupported subscriber command: {command}")
    finally:
        if joined:
            await layer.group_discard(group, channel)
        await layer.close_pools()
        current = asyncio.current_task()
        leaked_tasks = [
            task
            for task in asyncio.all_tasks()
            if task is not current and not task.done()
        ]
        results.put((label, "stopped", len(leaked_tasks)))


def subscriber_process(*args) -> None:
    try:
        asyncio.run(subscriber_session(*args))
    except BaseException as error:  # Report child failures to the controller.
        args[-1].put((args[0], "error", repr(error)))
        raise


async def broadcast_session(
    redis_url: str,
    prefix: str,
    group: str,
    messages: list[dict],
) -> None:
    layer = make_layer(redis_url, prefix)
    try:
        for message in messages:
            await layer.group_send(group, message)
    finally:
        await layer.close_pools()


def broadcaster_process(
    redis_url: str,
    prefix: str,
    group: str,
    messages: list[dict],
    results,
) -> None:
    try:
        asyncio.run(broadcast_session(redis_url, prefix, group, messages))
        results.put(("broadcaster", "sent", len(messages)))
    except BaseException as error:
        results.put(("broadcaster", "error", repr(error)))
        raise


async def remove_probe_keys(redis_url: str, prefix: str) -> None:
    layer = make_layer(redis_url, prefix)
    try:
        await layer.flush()
    finally:
        await layer.close_pools()


@dataclass
class Subscriber:
    label: str
    process: multiprocessing.Process
    commands: object


def next_result(results, *, label: str, action: str):
    deadline_results = []
    while True:
        try:
            result = results.get(timeout=PROCESS_TIMEOUT)
        except queue.Empty as error:
            raise AssertionError(
                f"Timed out waiting for {label}:{action}; received {deadline_results}"
            ) from error
        deadline_results.append(result)
        result_label, result_action, value = result
        if result_action == "error":
            raise AssertionError(f"Child {result_label} failed: {value}")
        if result_label == label and result_action == action:
            return value
        if result_label == label:
            raise AssertionError(
                f"Expected {label}:{action}, received {result_label}:{result_action}={value!r}"
            )


def start_subscriber(context, label, redis_url, prefix, group, results):
    commands = context.Queue()
    process = context.Process(
        name=f"a16-subscriber-{label}",
        target=subscriber_process,
        args=(label, redis_url, prefix, group, commands, results),
    )
    process.start()
    subscriber = Subscriber(label, process, commands)
    next_result(results, label=label, action="ready")
    return subscriber


def broadcast_in_process(context, redis_url, prefix, group, messages, results):
    process = context.Process(
        name="a16-broadcaster",
        target=broadcaster_process,
        args=(redis_url, prefix, group, messages, results),
    )
    process.start()
    sent = next_result(results, label="broadcaster", action="sent")
    process.join(PROCESS_TIMEOUT)
    if process.is_alive():
        process.terminate()
        process.join(PROCESS_TIMEOUT)
        raise AssertionError("Broadcaster did not exit within the timeout")
    if process.exitcode != 0:
        raise AssertionError(f"Broadcaster exit code was {process.exitcode}")
    if sent != len(messages):
        raise AssertionError(f"Broadcaster reported {sent} of {len(messages)} messages")


def request_messages(subscriber, count, results):
    subscriber.commands.put(("receive", count))
    return next_result(results, label=subscriber.label, action="messages")


def expect_no_message(subscriber, results):
    subscriber.commands.put(("expect_none", None))
    next_result(results, label=subscriber.label, action="none")


def main() -> int:
    redis_url = os.getenv("A16_REDIS_URL")
    if not redis_url:
        print(
            "BLOCKED: set A16_REDIS_URL to an isolated development Redis database.",
            file=sys.stderr,
        )
        return 2

    # Fork is intentional: this probe runs in the project's Linux/Docker
    # environment and must also work when the script is supplied over stdin.
    context = multiprocessing.get_context("fork")
    run_id = uuid.uuid4().hex
    prefix = f"a16_{run_id}"
    group = f"a16_group_{run_id}"
    results = context.Queue()
    subscribers: list[Subscriber] = []

    initial = [
        {"type": "probe.message", "sequence": sequence, "phase": "initial"}
        for sequence in range(1, 4)
    ]
    after_leave = {"type": "probe.message", "sequence": 4, "phase": "after_leave"}
    after_join = {"type": "probe.message", "sequence": 5, "phase": "after_join"}

    try:
        first = start_subscriber(context, "first", redis_url, prefix, group, results)
        second = start_subscriber(context, "second", redis_url, prefix, group, results)
        subscribers.extend((first, second))

        broadcast_in_process(context, redis_url, prefix, group, initial, results)
        for subscriber in (first, second):
            received = request_messages(subscriber, len(initial), results)
            if received != initial:
                raise AssertionError(
                    f"{subscriber.label} received out-of-order/incorrect messages: {received}"
                )
            expect_no_message(subscriber, results)

        first.commands.put(("leave", None))
        next_result(results, label="first", action="left")
        broadcast_in_process(
            context,
            redis_url,
            prefix,
            group,
            [after_leave],
            results,
        )
        if request_messages(second, 1, results) != [after_leave]:
            raise AssertionError("Remaining subscriber did not survive peer removal")
        expect_no_message(first, results)

        third = start_subscriber(context, "third", redis_url, prefix, group, results)
        subscribers.append(third)
        broadcast_in_process(
            context,
            redis_url,
            prefix,
            group,
            [after_join],
            results,
        )
        for subscriber in (second, third):
            if request_messages(subscriber, 1, results) != [after_join]:
                raise AssertionError(
                    f"{subscriber.label} did not receive the post-join message"
                )
        expect_no_message(first, results)

        print("PASS: 3 subscriber processes and separate broadcaster processes")
        print("PASS: exactly-once observation and per-subscriber ordering")
        print("PASS: peer removal isolation, late join, and removed-member non-delivery")
        return 0
    finally:
        cleanup_errors = []
        for subscriber in subscribers:
            if subscriber.process.is_alive():
                subscriber.commands.put(("stop", None))
                try:
                    leaked = next_result(
                        results,
                        label=subscriber.label,
                        action="stopped",
                    )
                    if leaked:
                        cleanup_errors.append(
                            f"{subscriber.label} reported {leaked} leaked tasks"
                        )
                except AssertionError as error:
                    cleanup_errors.append(str(error))
            subscriber.process.join(PROCESS_TIMEOUT)
            if subscriber.process.is_alive():
                subscriber.process.terminate()
                subscriber.process.join(PROCESS_TIMEOUT)
                cleanup_errors.append(
                    f"{subscriber.label} required forced termination"
                )
            if subscriber.process.exitcode not in (0, None):
                cleanup_errors.append(
                    f"{subscriber.label} exit code {subscriber.process.exitcode}"
                )
        asyncio.run(remove_probe_keys(redis_url, prefix))
        results.close()
        results.join_thread()
        if cleanup_errors:
            raise AssertionError("; ".join(cleanup_errors))


if __name__ == "__main__":
    raise SystemExit(main())
