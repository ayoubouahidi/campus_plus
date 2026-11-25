"""Safe reconciliation for the temporary account and canonical profile phones."""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum

from django.db import transaction


class PhonePairState(str, Enum):
    ACCOUNT_ONLY = "account_only"
    MEMBER_ONLY = "member_only"
    IDENTICAL = "identical"
    CONFLICT = "conflict"
    BOTH_BLANK = "both_blank"
    ACCOUNT_WITHOUT_MEMBER = "account_without_member"
    BLANK_WITHOUT_MEMBER = "blank_without_member"


class PhoneConflictReason(str, Enum):
    NONBLANK_VALUES_DIFFER = "NONBLANK_VALUES_DIFFER"
    ACCOUNT_PHONE_WITHOUT_MEMBER = "ACCOUNT_PHONE_WITHOUT_MEMBER"


@dataclass(frozen=True)
class PhoneConflictReference:
    user_id: int
    member_id: int | None
    reason: PhoneConflictReason

    def as_dict(self):
        return {
            "user_id": self.user_id,
            "member_id": self.member_id,
            "reason": self.reason.value,
        }


@dataclass(frozen=True)
class PhoneConflictReport:
    scanned_users: int
    eligible_backfills: int
    affected_records: tuple[PhoneConflictReference, ...]

    def as_dict(self):
        reason_counts = {
            reason.value: sum(
                reference.reason is reason for reference in self.affected_records
            )
            for reason in PhoneConflictReason
        }
        return {
            "status": "BLOCKED",
            "summary": {
                "scanned_users": self.scanned_users,
                "eligible_backfills": self.eligible_backfills,
                "total_blockers": len(self.affected_records),
                "blockers_by_reason": reason_counts,
            },
            "affected_records": [
                reference.as_dict() for reference in self.affected_records
            ],
        }


def phone_is_blank(value: str | None) -> bool:
    """Treat empty and whitespace-only values as blank without normalizing them."""
    return value is None or not value.strip()


def classify_phone_pair(
    account_phone: str | None,
    member_phone: str | None,
    *,
    member_exists: bool,
) -> PhonePairState:
    account_blank = phone_is_blank(account_phone)
    member_blank = phone_is_blank(member_phone)

    if not member_exists:
        return (
            PhonePairState.BLANK_WITHOUT_MEMBER
            if account_blank
            else PhonePairState.ACCOUNT_WITHOUT_MEMBER
        )
    if account_blank and member_blank:
        return PhonePairState.BOTH_BLANK
    if not account_blank and member_blank:
        return PhonePairState.ACCOUNT_ONLY
    if account_blank and not member_blank:
        return PhonePairState.MEMBER_ONLY
    if account_phone == member_phone:
        return PhonePairState.IDENTICAL
    return PhonePairState.CONFLICT


class PhoneReconciliationBlocked(RuntimeError):
    """Raised before writes when phone data needs explicit human attention."""

    def __init__(self, report: PhoneConflictReport):
        self.report = report
        self.conflicting_user_ids = tuple(
            reference.user_id
            for reference in report.affected_records
            if reference.reason is PhoneConflictReason.NONBLANK_VALUES_DIFFER
        )
        self.missing_member_user_ids = tuple(
            reference.user_id
            for reference in report.affected_records
            if reference.reason is PhoneConflictReason.ACCOUNT_PHONE_WITHOUT_MEMBER
        )
        super().__init__(str(self))

    def __str__(self):
        return json.dumps(self.report.as_dict(), sort_keys=True)


@dataclass(frozen=True)
class PhoneReconciliationResult:
    scanned_users: int
    backfilled_members: int
    preserved_member_phones: int
    identical_pairs: int
    blank_pairs: int
    users_without_blank_profiles: int


def reconcile_phone_records(
    *,
    user_model,
    member_model,
    using: str = "default",
    apply: bool,
) -> PhoneReconciliationResult:
    """Validate every pair first, then atomically backfill canonical blank fields.

    The supplied models may be current Django models or historical models from a
    migration state. Phone values are never included in the result or errors.
    """
    with transaction.atomic(using=using):
        users = list(
            user_model.objects.using(using)
            .select_for_update()
            .only("pk", "phone")
            .order_by("pk")
        )
        user_ids = [user.pk for user in users]
        members = list(
            member_model.objects.using(using)
            .select_for_update()
            .filter(user_id__in=user_ids)
            .only("pk", "user_id", "phone")
            .order_by("user_id", "pk")
        )
        members_by_user = {member.user_id: member for member in members}

        backfills = []
        blockers = []
        counts = {state: 0 for state in PhonePairState}

        for user in users:
            member = members_by_user.get(user.pk)
            state = classify_phone_pair(
                user.phone,
                member.phone if member is not None else None,
                member_exists=member is not None,
            )
            counts[state] += 1
            if state is PhonePairState.ACCOUNT_ONLY:
                backfills.append((member, user.phone))
            elif state is PhonePairState.CONFLICT:
                blockers.append(
                    PhoneConflictReference(
                        user_id=user.pk,
                        member_id=member.pk,
                        reason=PhoneConflictReason.NONBLANK_VALUES_DIFFER,
                    )
                )
            elif state is PhonePairState.ACCOUNT_WITHOUT_MEMBER:
                blockers.append(
                    PhoneConflictReference(
                        user_id=user.pk,
                        member_id=None,
                        reason=PhoneConflictReason.ACCOUNT_PHONE_WITHOUT_MEMBER,
                    )
                )

        if blockers:
            raise PhoneReconciliationBlocked(
                PhoneConflictReport(
                    scanned_users=len(users),
                    eligible_backfills=len(backfills),
                    affected_records=tuple(blockers),
                )
            )

        if apply:
            for member, account_phone in backfills:
                member.phone = account_phone
            if backfills:
                member_model.objects.using(using).bulk_update(
                    [member for member, _ in backfills],
                    ["phone"],
                )

        return PhoneReconciliationResult(
            scanned_users=len(users),
            backfilled_members=len(backfills),
            preserved_member_phones=counts[PhonePairState.MEMBER_ONLY],
            identical_pairs=counts[PhonePairState.IDENTICAL],
            blank_pairs=counts[PhonePairState.BOTH_BLANK],
            users_without_blank_profiles=counts[PhonePairState.BLANK_WITHOUT_MEMBER],
        )
