import json
import os
import stat
from pathlib import Path

from django.core.management.base import BaseCommand

from core_data.legacy_preflight import PreflightSafetyError, run_preflight


def _write_private_json(path_value, payload):
    path = Path(path_value).resolve(strict=False)
    if not path.parent.exists() or not path.parent.is_dir():
        raise PreflightSafetyError("Report parent directories must already exist.")
    directory_flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(
        os, "O_NOFOLLOW", 0
    )
    directory = os.open(path.parent, directory_flags)
    try:
        file_flags = (
            os.O_WRONLY
            | os.O_CREAT
            | os.O_EXCL
            | getattr(os, "O_NOFOLLOW", 0)
            | getattr(os, "O_CLOEXEC", 0)
        )
        descriptor = os.open(path.name, file_flags, 0o600, dir_fd=directory)
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(payload, stream, sort_keys=True, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
    finally:
        os.close(directory)


def _read_private_file(path_value, label):
    path = Path(path_value)
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError as error:
        raise PreflightSafetyError(f"{label} could not be opened safely.") from error
    try:
        file_stat = os.fstat(descriptor)
        if not stat.S_ISREG(file_stat.st_mode):
            raise PreflightSafetyError(f"{label} must be an existing regular file.")
        if file_stat.st_mode & 0o077:
            raise PreflightSafetyError(
                f"{label} must not be readable by group or others."
            )
        with os.fdopen(os.dup(descriptor), "rb") as stream:
            return Path(path).resolve(strict=False), stream.read()
    finally:
        os.close(descriptor)


def _validate_new_output(path_value, label):
    path = Path(path_value).resolve(strict=False)
    if not path.parent.exists() or not path.parent.is_dir():
        raise PreflightSafetyError(f"{label} parent directory must already exist.")
    if path.exists() or path.is_symlink():
        raise PreflightSafetyError(f"{label} must be a new non-symlink path.")
    return path


class Command(BaseCommand):
    help = "Read-only preflight for the supported legacy SQLite schema."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", required=True)
        parser.add_argument("--source-sqlite", required=True)
        parser.add_argument("--redaction-key-file", required=True)
        parser.add_argument("--general-report", required=True)
        parser.add_argument("--review-manifest", required=True)

    def handle(self, *args, **options):
        try:
            key_path, redaction_key = _read_private_file(
                options["redaction_key_file"],
                "Redaction key",
            )
            source_path = Path(options["source_sqlite"]).resolve(strict=False)
            if key_path == source_path:
                raise PreflightSafetyError(
                    "The redaction key must be separate from the SQLite source."
                )
            general_path = _validate_new_output(
                options["general_report"],
                "General report",
            )
            manifest_path = _validate_new_output(
                options["review_manifest"],
                "Review manifest",
            )
            if general_path == manifest_path:
                raise PreflightSafetyError("Report and manifest paths must differ.")
            result = run_preflight(
                options["source_sqlite"],
                redaction_key=redaction_key,
            )
            _write_private_json(general_path, result.general_report)
            _write_private_json(manifest_path, result.review_manifest)
        except (OSError, PreflightSafetyError) as error:
            self.stderr.write(f"Preflight safety failure: {error}")
            raise SystemExit(getattr(error, "exit_code", 3)) from error

        self.stdout.write(
            f"Legacy migration preflight: {result.general_report['status']} "
            f"(exit {result.exit_code})"
        )
        if result.exit_code:
            raise SystemExit(result.exit_code)
