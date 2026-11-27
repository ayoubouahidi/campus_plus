"""Read-only preflight checks for the supported legacy Campus Plus schema.

This module deliberately contains no transfer or repair functionality.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import sqlite3
import stat
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote


EXIT_OK = 0
EXIT_DATA_BLOCKED = 2
EXIT_UNSAFE_SOURCE = 3
EXIT_UNSUPPORTED_SCHEMA = 5
EXIT_SOURCE_CHANGED = 10

ORIGINAL_REPOSITORY = Path("/home/ahlahfid/projects/campus_plus")
UNSAFE_PATH_MARKERS = {"prod", "production", "shared"}

MINIMAL_EXPECTED_TABLES = frozenset(
    {
        "auth_group",
        "auth_group_permissions",
        "auth_permission",
        "auth_user",
        "auth_user_groups",
        "auth_user_user_permissions",
        "authtoken_token",
        "core_data_club",
        "core_data_clubevent",
        "core_data_department",
        "core_data_usermember",
        "django_content_type",
        "django_migrations",
    }
)
FULL_FRAMEWORK_TABLES = MINIMAL_EXPECTED_TABLES | {
    "django_admin_log",
    "django_session",
}
EXPECTED_TABLES = MINIMAL_EXPECTED_TABLES

EXPECTED_MIGRATIONS = frozenset(
    {
        ("contenttypes", "0001_initial"),
        ("contenttypes", "0002_remove_content_type_name"),
        ("auth", "0001_initial"),
        ("auth", "0002_alter_permission_name_max_length"),
        ("auth", "0003_alter_user_email_max_length"),
        ("auth", "0004_alter_user_username_opts"),
        ("auth", "0005_alter_user_last_login_null"),
        ("auth", "0006_require_contenttypes_0002"),
        ("auth", "0007_alter_validators_add_error_messages"),
        ("auth", "0008_alter_user_username_max_length"),
        ("auth", "0009_alter_user_last_name_max_length"),
        ("auth", "0010_alter_group_name_max_length"),
        ("auth", "0011_update_proxy_permissions"),
        ("auth", "0012_alter_user_first_name_max_length"),
        ("authtoken", "0001_initial"),
        ("authtoken", "0002_auto_20160226_1747"),
        ("authtoken", "0003_tokenproxy"),
        ("authtoken", "0004_alter_tokenproxy_options"),
        ("core_data", "0001_initial"),
        ("core_data", "0002_alter_clubevent_parent_id_alter_usermember_role"),
        (
            "core_data",
            "0003_usermember_first_name_usermember_last_name_and_more",
        ),
        (
            "core_data",
            "0004_club_contact_email_club_created_at_club_description_and_more",
        ),
        ("core_data", "0005_clubevent_image_path"),
        ("core_data", "0006_usermember_year_of_study"),
    }
)
FULL_FRAMEWORK_MIGRATIONS = EXPECTED_MIGRATIONS | {
    ("admin", "0001_initial"),
    ("admin", "0002_logentry_remove_auto_add"),
    ("admin", "0003_logentry_add_action_flag_choices"),
    ("sessions", "0001_initial"),
}

# Generated from semantic SQLite introspection of the approved auth.User /
# core_data.0006 rehearsal schema. Index names are intentionally excluded.
SUPPORTED_SCHEMA_FINGERPRINT = (
    "9fab411fc6f72a348cfaa2fa913c28c9541cc354475b1481f49c9c1c1f70a96a"
)
FULL_FRAMEWORK_SCHEMA_FINGERPRINT = (
    "a8eeee71fc88343d573cdff4fa22fb0c84112476021936064f30a3c51888a3b1"
)

SUPPORTED_CONTRACTS = {
    SUPPORTED_SCHEMA_FINGERPRINT: {
        "name": "legacy-sqlite-minimal-v1",
        "tables": MINIMAL_EXPECTED_TABLES,
        "migrations": EXPECTED_MIGRATIONS,
    },
    FULL_FRAMEWORK_SCHEMA_FINGERPRINT: {
        "name": "legacy-sqlite-admin-sessions-v1",
        "tables": FULL_FRAMEWORK_TABLES,
        "migrations": FULL_FRAMEWORK_MIGRATIONS,
    },
}


class PreflightSafetyError(RuntimeError):
    """The requested source cannot be inspected safely."""

    exit_code = EXIT_UNSAFE_SOURCE


@dataclass(frozen=True)
class PreflightResult:
    general_report: dict
    review_manifest: dict
    exit_code: int


def _is_within(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root.resolve())
    except ValueError:
        return False
    return True


def validate_source_path(source: str | os.PathLike[str]) -> Path:
    raw = os.fspath(source)
    if "://" in raw:
        raise PreflightSafetyError(
            "Only explicit local SQLite paths are supported; PostgreSQL is not implemented."
        )
    candidate = Path(raw)
    if not candidate.is_absolute():
        raise PreflightSafetyError("The SQLite source path must be absolute.")

    resolved = candidate.resolve(strict=False)
    integration_root = Path(__file__).resolve().parent.parent
    for forbidden in (ORIGINAL_REPOSITORY, integration_root):
        if _is_within(resolved, forbidden):
            raise PreflightSafetyError("Source paths inside a repository are refused.")

    lowered_parts = {part.lower() for part in resolved.parts}
    filename_markers = set(re.split(r"[-_.]+", resolved.stem.lower()))
    if (
        lowered_parts & UNSAFE_PATH_MARKERS
        or filename_markers & UNSAFE_PATH_MARKERS
        or resolved.name.lower() == "db.sqlite3"
    ):
        raise PreflightSafetyError(
            "Known development, shared, or production-like database paths are refused."
        )
    if candidate.is_symlink():
        raise PreflightSafetyError("Symbolic-link database sources are refused.")
    if not resolved.exists() or not resolved.is_file():
        raise PreflightSafetyError("The SQLite source must be an existing regular file.")
    for suffix in ("-journal", "-wal"):
        if Path(f"{resolved}{suffix}").exists():
            raise PreflightSafetyError(
                "SQLite journal/WAL sidecars require a separately reviewed snapshot process."
            )
    return resolved


class ReadOnlySQLite:
    """A SQLite wrapper that accepts only SELECT/WITH/PRAGMA statements."""

    _ALLOWED_STATEMENTS = frozenset({"SELECT", "WITH", "PRAGMA"})
    _ALLOWED_PRAGMAS = frozenset(
        {
            "foreign_key_check",
            "foreign_key_list",
            "index_info",
            "index_list",
            "integrity_check",
            "query_only",
            "table_info",
        }
    )

    def __init__(self, path: Path):
        self.path = path
        self.connection: sqlite3.Connection | None = None
        self.file_descriptor: int | None = None
        self.file_identity: tuple[int, int] | None = None

    def __enter__(self) -> "ReadOnlySQLite":
        flags = os.O_RDONLY | getattr(os, "O_CLOEXEC", 0) | getattr(os, "O_NOFOLLOW", 0)
        try:
            self.file_descriptor = os.open(self.path, flags)
            file_stat = os.fstat(self.file_descriptor)
            if not stat.S_ISREG(file_stat.st_mode):
                raise PreflightSafetyError("The SQLite source descriptor is not a regular file.")
            self.file_identity = (file_stat.st_dev, file_stat.st_ino)
            descriptor_path = f"/proc/self/fd/{self.file_descriptor}"
            if not Path(descriptor_path).exists():
                raise PreflightSafetyError("Pinned file-descriptor SQLite access is unavailable.")
            uri = f"file:{quote(descriptor_path, safe='/')}?mode=ro&immutable=1"
            self.connection = sqlite3.connect(uri, uri=True)
            self.connection.row_factory = sqlite3.Row
            self.connection.execute("PRAGMA query_only = ON")
            enabled = self.connection.execute("PRAGMA query_only").fetchone()[0]
            if enabled != 1:
                raise PreflightSafetyError(
                    "SQLite query-only enforcement could not be enabled."
                )
            self.connection.set_authorizer(self._authorize)
            return self
        except Exception:
            self.__exit__(None, None, None)
            raise

    def __exit__(self, exc_type, exc, traceback) -> None:
        if self.connection is not None:
            self.connection.close()
            self.connection = None
        if self.file_descriptor is not None:
            os.close(self.file_descriptor)
            self.file_descriptor = None

    def _authorize(self, action, argument1, argument2, database, trigger):
        write_actions = {
            sqlite3.SQLITE_ALTER_TABLE,
            sqlite3.SQLITE_ANALYZE,
            sqlite3.SQLITE_ATTACH,
            sqlite3.SQLITE_CREATE_INDEX,
            sqlite3.SQLITE_CREATE_TABLE,
            sqlite3.SQLITE_CREATE_TEMP_INDEX,
            sqlite3.SQLITE_CREATE_TEMP_TABLE,
            sqlite3.SQLITE_CREATE_TEMP_TRIGGER,
            sqlite3.SQLITE_CREATE_TEMP_VIEW,
            sqlite3.SQLITE_CREATE_TRIGGER,
            sqlite3.SQLITE_CREATE_VIEW,
            sqlite3.SQLITE_CREATE_VTABLE,
            sqlite3.SQLITE_DELETE,
            sqlite3.SQLITE_DETACH,
            sqlite3.SQLITE_DROP_INDEX,
            sqlite3.SQLITE_DROP_TABLE,
            sqlite3.SQLITE_DROP_TEMP_INDEX,
            sqlite3.SQLITE_DROP_TEMP_TABLE,
            sqlite3.SQLITE_DROP_TEMP_TRIGGER,
            sqlite3.SQLITE_DROP_TEMP_VIEW,
            sqlite3.SQLITE_DROP_TRIGGER,
            sqlite3.SQLITE_DROP_VIEW,
            sqlite3.SQLITE_DROP_VTABLE,
            sqlite3.SQLITE_INSERT,
            sqlite3.SQLITE_REINDEX,
            sqlite3.SQLITE_TRANSACTION,
            sqlite3.SQLITE_UPDATE,
        }
        if action in write_actions:
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_PRAGMA:
            pragma = (argument1 or "").lower()
            if pragma not in self._ALLOWED_PRAGMAS:
                return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK

    def sha256(self) -> str:
        if self.file_descriptor is None:
            raise PreflightSafetyError("The read-only source descriptor is not open.")
        digest = hashlib.sha256()
        offset = 0
        while True:
            chunk = os.pread(self.file_descriptor, 1024 * 1024, offset)
            if not chunk:
                break
            digest.update(chunk)
            offset += len(chunk)
        return digest.hexdigest()

    def path_identity_unchanged(self) -> bool:
        if self.file_identity is None:
            return False
        try:
            current = os.stat(self.path, follow_symlinks=False)
        except OSError:
            return False
        return (current.st_dev, current.st_ino) == self.file_identity

    def sidecars_absent(self) -> bool:
        return not any(
            Path(f"{self.path}{suffix}").exists() for suffix in ("-journal", "-wal")
        )

    def query(self, sql: str, parameters: tuple = ()) -> list[sqlite3.Row]:
        if self.connection is None:
            raise PreflightSafetyError("The read-only SQLite connection is not open.")
        statement = sql.lstrip().split(None, 1)[0].upper()
        if statement not in self._ALLOWED_STATEMENTS:
            raise PreflightSafetyError(f"Disallowed SQL statement: {statement}")
        if statement == "PRAGMA":
            match = re.fullmatch(
                r"\s*PRAGMA\s+(?:main\.)?([A-Za-z_]+)(?:\s*\([^;]*\))?\s*;?\s*",
                sql,
                flags=re.IGNORECASE,
            )
            if not match or match.group(1).lower() not in self._ALLOWED_PRAGMAS:
                raise PreflightSafetyError("Writable or unknown SQLite PRAGMA refused.")
            if "=" in sql:
                raise PreflightSafetyError("Writable SQLite PRAGMA refused.")
        try:
            return self.connection.execute(sql, parameters).fetchall()
        except sqlite3.DatabaseError as error:
            if "not authorized" in str(error).lower():
                raise PreflightSafetyError("SQLite authorizer rejected unsafe SQL.") from error
            raise


class Redactor:
    def __init__(self, key: bytes):
        if len(key) < 32:
            raise PreflightSafetyError("The redaction key must contain at least 32 bytes.")
        self.key = key

    def reference(self, category: str, value: object) -> str:
        message = f"{category}:{value}".encode()
        return hmac.new(self.key, message, hashlib.sha256).hexdigest()[:16]


def _quote_identifier(identifier: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", identifier):
        raise PreflightSafetyError("Unsafe SQLite identifier encountered.")
    return f'"{identifier}"'


def _normalized_table_sql(sql: str | None) -> str:
    value = (sql or "").lower().replace('"', "").replace("`", "")
    return re.sub(r"\s+", " ", value).strip()


def _schema_snapshot(database: ReadOnlySQLite) -> tuple[dict, str]:
    table_rows = database.query(
        """
        SELECT name, sql FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        """
    )
    snapshot = {}
    for table_row in table_rows:
        table = table_row["name"]
        quoted_table = _quote_identifier(table)
        columns = [
            {
                "name": row["name"],
                "type": (row["type"] or "").lower(),
                "notnull": row["notnull"],
                "default": row["dflt_value"],
                "pk": row["pk"],
            }
            for row in database.query(f"PRAGMA table_info({quoted_table})")
        ]
        foreign_keys = sorted(
            (
                row["from"],
                row["table"],
                row["to"],
                row["on_update"],
                row["on_delete"],
                row["match"],
            )
            for row in database.query(f"PRAGMA foreign_key_list({quoted_table})")
        )
        indexes = []
        for index in database.query(f"PRAGMA index_list({quoted_table})"):
            quoted_index = _quote_identifier(index["name"])
            indexed_columns = tuple(
                row["name"]
                for row in database.query(f"PRAGMA index_info({quoted_index})")
            )
            indexes.append(
                (
                    index["unique"],
                    index["origin"],
                    index["partial"],
                    indexed_columns,
                )
            )
        snapshot[table] = {
            "columns": columns,
            "foreign_keys": foreign_keys,
            "indexes": sorted(indexes),
            "table_sql": _normalized_table_sql(table_row["sql"]),
        }
    encoded = json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode()
    return snapshot, hashlib.sha256(encoded).hexdigest()


def _references(redactor: Redactor, category: str, values) -> list[str]:
    return sorted({redactor.reference(category, value) for value in values})


def _leaf_migrations(migrations: set[tuple[str, str]]) -> dict[str, str]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for app, name in migrations:
        grouped[app].append(name)
    return {app: sorted(names)[-1] for app, names in sorted(grouped.items())}


def run_preflight(
    source: str | os.PathLike[str],
    *,
    redaction_key: bytes,
) -> PreflightResult:
    source_path = validate_source_path(source)
    redactor = Redactor(redaction_key)
    schema_blockers: list[dict] = []
    data_blockers: list[dict] = []
    observations: list[dict] = []

    def add_blocker(collection: list[dict], code: str, count: int, refs=()) -> None:
        if count:
            collection.append(
                {
                    "code": code,
                    "count": count,
                    "references": _references(redactor, code, refs),
                }
            )

    with ReadOnlySQLite(source_path) as database:
        before_hash = database.sha256()
        snapshot, schema_fingerprint = _schema_snapshot(database)
        actual_tables = set(snapshot)
        contract = SUPPORTED_CONTRACTS.get(schema_fingerprint)
        contract_candidates = list(SUPPORTED_CONTRACTS.values())
        expected_contract = min(
            contract_candidates,
            key=lambda item: len(actual_tables ^ set(item["tables"])),
        )
        expected_tables = set(expected_contract["tables"])
        expected_migrations = set(expected_contract["migrations"])
        add_blocker(
            schema_blockers,
            "UNEXPECTED_TABLES",
            len(actual_tables - expected_tables),
            actual_tables - expected_tables,
        )
        add_blocker(
            schema_blockers,
            "MISSING_TABLES",
            len(expected_tables - actual_tables),
            expected_tables - actual_tables,
        )
        if contract is None:
            add_blocker(schema_blockers, "SCHEMA_FINGERPRINT_MISMATCH", 1)

        migrations: set[tuple[str, str]] = set()
        migration_duplicates = []
        if "django_migrations" in actual_tables:
            migration_rows = database.query(
                "SELECT app, name, COUNT(*) AS amount FROM django_migrations "
                "GROUP BY app, name ORDER BY app, name"
            )
            migrations = {(row["app"], row["name"]) for row in migration_rows}
            migration_duplicates = [
                f"{row['app']}.{row['name']}"
                for row in migration_rows
                if row["amount"] != 1
            ]
            add_blocker(
                schema_blockers,
                "DUPLICATE_MIGRATION_ROWS",
                len(migration_duplicates),
                migration_duplicates,
            )
            missing_migrations = expected_migrations - migrations
            unexpected_migrations = migrations - expected_migrations
            add_blocker(
                schema_blockers,
                "MISSING_MIGRATIONS",
                len(missing_migrations),
                (f"{app}.{name}" for app, name in missing_migrations),
            )
            add_blocker(
                schema_blockers,
                "UNEXPECTED_MIGRATIONS",
                len(unexpected_migrations),
                (f"{app}.{name}" for app, name in unexpected_migrations),
            )

        phone_columns = []
        for table in ("auth_user", "core_data_usermember"):
            if table in snapshot and any(
                column["name"] == "phone" for column in snapshot[table]["columns"]
            ):
                phone_columns.append(f"{table}.phone")
        add_blocker(
            schema_blockers,
            "UNEXPECTED_PHONE_COLUMNS",
            len(phone_columns),
            phone_columns,
        )
        if len(phone_columns) == 2:
            phone_conflicts = database.query(
                "SELECT m.id FROM core_data_usermember m JOIN auth_user u "
                "ON u.id=m.user_id WHERE TRIM(m.phone) <> '' AND TRIM(u.phone) <> '' "
                "AND TRIM(m.phone) <> TRIM(u.phone)"
            )
            add_blocker(
                data_blockers,
                "PHONE_VALUE_CONFLICTS",
                len(phone_conflicts),
                (row["id"] for row in phone_conflicts),
            )

        required_for_data = MINIMAL_EXPECTED_TABLES - {"django_content_type"}
        data_audit_possible = required_for_data <= actual_tables
        counts = {}
        authorization_counts = {
            "historical_role_nonblank_profiles": 0,
            "club_head_profiles": 0,
            "club_membership_profiles": 0,
            "django_staff_users": 0,
            "django_superusers": 0,
            "review_candidates": 0,
            "target_automatic_privileged_roles": 0,
            "target_board_assignments": 0,
        }
        role_buckets = []
        candidates: dict[str, dict] = {}

        if data_audit_possible:
            count_tables = {
                "users": ("auth_user", "id"),
                "profiles": ("core_data_usermember", "id"),
                "departments": ("core_data_department", "id"),
                "clubs": ("core_data_club", "id"),
                "events": ("core_data_clubevent", "id"),
                "tokens": ("authtoken_token", "key"),
                "groups": ("auth_group", "id"),
                "group_memberships": ("auth_user_groups", "id"),
                "direct_permissions": ("auth_user_user_permissions", "id"),
            }
            if "django_admin_log" in actual_tables:
                count_tables["admin_logs"] = ("django_admin_log", "id")
            if "django_session" in actual_tables:
                count_tables["sessions"] = ("django_session", "session_key")
            for label, (table, primary_key) in count_tables.items():
                row = database.query(
                    f"SELECT COUNT(*) AS total, COUNT(DISTINCT {_quote_identifier(primary_key)}) "
                    f"AS unique_total FROM {_quote_identifier(table)}"
                )[0]
                counts[label] = row["total"]
                add_blocker(
                    data_blockers,
                    "DUPLICATE_PRIMARY_KEYS",
                    row["total"] - row["unique_total"],
                    [table] if row["total"] != row["unique_total"] else [],
                )

            duplicate_usernames = database.query(
                "SELECT username, GROUP_CONCAT(id) AS ids, COUNT(*) AS amount "
                "FROM auth_user GROUP BY username HAVING COUNT(*) > 1"
            )
            add_blocker(
                data_blockers,
                "DUPLICATE_USERNAMES",
                len(duplicate_usernames),
                (row["ids"] for row in duplicate_usernames),
            )
            empty_usernames = database.query(
                "SELECT id FROM auth_user WHERE TRIM(username) = ''"
            )
            add_blocker(
                data_blockers,
                "EMPTY_USERNAMES",
                len(empty_usernames),
                (row["id"] for row in empty_usernames),
            )
            duplicate_emails = database.query(
                "SELECT LOWER(TRIM(email)) AS normalized, GROUP_CONCAT(id) AS ids, "
                "COUNT(*) AS amount FROM auth_user WHERE TRIM(email) <> '' "
                "GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1"
            )
            add_blocker(
                data_blockers,
                "CASE_INSENSITIVE_EMAIL_CONFLICTS",
                len(duplicate_emails),
                (row["ids"] for row in duplicate_emails),
            )
            empty_email_count = database.query(
                "SELECT COUNT(*) AS amount FROM auth_user WHERE TRIM(email) = ''"
            )[0]["amount"]
            observations.append({"code": "EMPTY_EMAILS", "count": empty_email_count})

            profiles_without_users = database.query(
                "SELECT id FROM core_data_usermember WHERE user_id IS NULL"
            )
            users_without_profiles = database.query(
                "SELECT u.id FROM auth_user u LEFT JOIN core_data_usermember m "
                "ON m.user_id = u.id WHERE m.id IS NULL"
            )
            duplicate_profile_users = database.query(
                "SELECT user_id, GROUP_CONCAT(id) AS ids FROM core_data_usermember "
                "WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*) > 1"
            )
            association_refs = [row["id"] for row in profiles_without_users]
            association_refs.extend(row["id"] for row in users_without_profiles)
            association_refs.extend(row["ids"] for row in duplicate_profile_users)
            add_blocker(
                data_blockers,
                "USER_PROFILE_ASSOCIATION_GAPS",
                len(profiles_without_users)
                + len(users_without_profiles)
                + len(duplicate_profile_users),
                association_refs,
            )

            relation_queries = {
                "MISSING_PROFILE_USERS": (
                    "SELECT m.id FROM core_data_usermember m LEFT JOIN auth_user u "
                    "ON u.id=m.user_id WHERE m.user_id IS NOT NULL AND u.id IS NULL"
                ),
                "MISSING_PROFILE_DEPARTMENTS": (
                    "SELECT m.id FROM core_data_usermember m LEFT JOIN core_data_department d "
                    "ON d.id=m.department_id_id WHERE m.department_id_id IS NOT NULL AND d.id IS NULL"
                ),
                "MISSING_PROFILE_CLUBS": (
                    "SELECT m.id FROM core_data_usermember m LEFT JOIN core_data_club c "
                    "ON c.id=m.club_id_id WHERE m.club_id_id IS NOT NULL AND c.id IS NULL"
                ),
                "MISSING_CLUB_DEPARTMENTS": (
                    "SELECT c.id FROM core_data_club c LEFT JOIN core_data_department d "
                    "ON d.id=c.department_id WHERE d.id IS NULL"
                ),
                "MISSING_CLUB_HEADS": (
                    "SELECT c.id FROM core_data_club c LEFT JOIN core_data_usermember m "
                    "ON m.id=c.head_id WHERE c.head_id IS NOT NULL AND m.id IS NULL"
                ),
                "MISSING_EVENT_DEPARTMENTS": (
                    "SELECT e.id FROM core_data_clubevent e LEFT JOIN core_data_department d "
                    "ON d.id=e.parent_id_id WHERE d.id IS NULL"
                ),
                "MISSING_EVENT_CLUBS": (
                    "SELECT e.id FROM core_data_clubevent e LEFT JOIN core_data_club c "
                    "ON c.id=e.club_id WHERE e.club_id IS NOT NULL AND c.id IS NULL"
                ),
                "INVALID_TOKEN_OWNERS": (
                    "SELECT t.rowid AS id FROM authtoken_token t LEFT JOIN auth_user u "
                    "ON u.id=t.user_id WHERE u.id IS NULL"
                ),
                "INVALID_GROUP_MEMBERSHIPS": (
                    "SELECT ug.id FROM auth_user_groups ug LEFT JOIN auth_user u ON u.id=ug.user_id "
                    "LEFT JOIN auth_group g ON g.id=ug.group_id WHERE u.id IS NULL OR g.id IS NULL"
                ),
                "INVALID_DIRECT_PERMISSIONS": (
                    "SELECT up.id FROM auth_user_user_permissions up LEFT JOIN auth_user u "
                    "ON u.id=up.user_id LEFT JOIN auth_permission p ON p.id=up.permission_id "
                    "WHERE u.id IS NULL OR p.id IS NULL"
                ),
                "INVALID_GROUP_PERMISSIONS": (
                    "SELECT gp.id FROM auth_group_permissions gp LEFT JOIN auth_group g "
                    "ON g.id=gp.group_id LEFT JOIN auth_permission p ON p.id=gp.permission_id "
                    "WHERE g.id IS NULL OR p.id IS NULL"
                ),
                "INVALID_PERMISSION_CONTENT_TYPES": (
                    "SELECT p.id FROM auth_permission p LEFT JOIN django_content_type ct "
                    "ON ct.id=p.content_type_id WHERE ct.id IS NULL"
                ),
            }
            if "django_admin_log" in actual_tables:
                relation_queries.update(
                    {
                        "INVALID_ADMIN_LOG_USERS": (
                            "SELECT l.id FROM django_admin_log l LEFT JOIN auth_user u "
                            "ON u.id=l.user_id WHERE u.id IS NULL"
                        ),
                        "INVALID_ADMIN_LOG_CONTENT_TYPES": (
                            "SELECT l.id FROM django_admin_log l LEFT JOIN django_content_type ct "
                            "ON ct.id=l.content_type_id WHERE l.content_type_id IS NOT NULL "
                            "AND ct.id IS NULL"
                        ),
                    }
                )
            for code, query in relation_queries.items():
                rows = database.query(query)
                add_blocker(
                    data_blockers,
                    code,
                    len(rows),
                    (row["id"] for row in rows),
                )

            duplicate_token_keys = database.query(
                "SELECT COUNT(*) AS amount FROM authtoken_token GROUP BY key HAVING COUNT(*) > 1"
            )
            duplicate_token_owners = database.query(
                "SELECT user_id FROM authtoken_token GROUP BY user_id HAVING COUNT(*) > 1"
            )
            add_blocker(
                data_blockers,
                "DUPLICATE_TOKEN_KEYS",
                len(duplicate_token_keys),
            )
            add_blocker(
                data_blockers,
                "DUPLICATE_TOKEN_OWNERS",
                len(duplicate_token_owners),
                (row["user_id"] for row in duplicate_token_owners),
            )

            consistency_queries = {
                "EVENT_CLUB_DEPARTMENT_MISMATCH": (
                    "SELECT e.id FROM core_data_clubevent e JOIN core_data_club c ON c.id=e.club_id "
                    "WHERE e.club_id IS NOT NULL AND e.parent_id_id <> c.department_id"
                ),
                "PROFILE_CLUB_DEPARTMENT_MISMATCH": (
                    "SELECT m.id FROM core_data_usermember m JOIN core_data_club c ON c.id=m.club_id_id "
                    "WHERE m.department_id_id IS NOT NULL AND m.department_id_id <> c.department_id"
                ),
                "INVALID_EVENT_CHRONOLOGY": (
                    "SELECT id FROM core_data_clubevent WHERE starts_at IS NOT NULL "
                    "AND ends_at IS NOT NULL AND ends_at <= starts_at"
                ),
            }
            for code, query in consistency_queries.items():
                rows = database.query(query)
                add_blocker(
                    data_blockers,
                    code,
                    len(rows),
                    (row["id"] for row in rows),
                )

            foreign_key_rows = database.query("PRAGMA foreign_key_check")
            add_blocker(
                data_blockers,
                "FOREIGN_KEY_INTEGRITY_ERRORS",
                len(foreign_key_rows),
                (f"{row['table']}:{row['rowid']}" for row in foreign_key_rows),
            )
            integrity_rows = database.query("PRAGMA integrity_check")
            integrity_errors = [row[0] for row in integrity_rows if row[0] != "ok"]
            add_blocker(
                data_blockers,
                "SQLITE_INTEGRITY_ERRORS",
                len(integrity_errors),
            )

            role_rows = database.query(
                "SELECT id, user_id, club_id_id, role FROM core_data_usermember "
                "ORDER BY id"
            )
            role_counts = Counter(
                "blank" if row["role"] is None or not row["role"].strip() else row["role"].strip()
                for row in role_rows
            )
            role_buckets = [
                {
                    "role_reference": (
                        "blank"
                        if value == "blank"
                        else redactor.reference("historical-role", value)
                    ),
                    "count": count,
                }
                for value, count in sorted(role_counts.items())
            ]

            def candidate(user_id, profile_id=None) -> dict:
                key = f"user:{user_id}" if user_id is not None else f"profile:{profile_id}"
                if key not in candidates:
                    candidates[key] = {
                        "legacy_user_id": user_id,
                        "usermember_ids": set(),
                        "club_ids": set(),
                        "evidence_codes": set(),
                        "decision": "PENDING",
                    }
                if profile_id is not None:
                    candidates[key]["usermember_ids"].add(profile_id)
                return candidates[key]

            for row in role_rows:
                if row["role"] is not None and row["role"].strip():
                    item = candidate(row["user_id"], row["id"])
                    item["evidence_codes"].add("HISTORICAL_ROLE")
                    if row["club_id_id"] is not None:
                        item["club_ids"].add(row["club_id_id"])

            membership_rows = database.query(
                "SELECT id, user_id, club_id_id FROM core_data_usermember "
                "WHERE club_id_id IS NOT NULL"
            )
            for row in membership_rows:
                item = candidate(row["user_id"], row["id"])
                item["club_ids"].add(row["club_id_id"])
                item["evidence_codes"].add("CLUB_MEMBERSHIP")

            head_rows = database.query(
                "SELECT c.id AS club_id, m.id AS profile_id, m.user_id FROM core_data_club c "
                "JOIN core_data_usermember m ON m.id=c.head_id WHERE c.head_id IS NOT NULL"
            )
            for row in head_rows:
                item = candidate(row["user_id"], row["profile_id"])
                item["club_ids"].add(row["club_id"])
                item["evidence_codes"].add("CLUB_HEAD")

            staff_rows = database.query(
                "SELECT id, is_staff, is_superuser FROM auth_user "
                "WHERE is_staff = 1 OR is_superuser = 1"
            )
            for row in staff_rows:
                item = candidate(row["id"])
                if row["is_staff"]:
                    item["evidence_codes"].add("DJANGO_STAFF")
                if row["is_superuser"]:
                    item["evidence_codes"].add("DJANGO_SUPERUSER")

            username_mismatches = database.query(
                "SELECT m.id FROM core_data_usermember m JOIN auth_user u ON u.id=m.user_id "
                "WHERE m.username <> u.username"
            )
            observations.append(
                {
                    "code": "PROFILE_USERNAME_MISMATCHES",
                    "count": len(username_mismatches),
                }
            )

            evidence_counts = Counter()
            for item in candidates.values():
                evidence_counts.update(item["evidence_codes"])
            authorization_counts.update(
                {
                    "historical_role_nonblank_profiles": evidence_counts["HISTORICAL_ROLE"],
                    "club_head_profiles": len(head_rows),
                    "club_membership_profiles": len(membership_rows),
                    "django_staff_users": evidence_counts["DJANGO_STAFF"],
                    "django_superusers": evidence_counts["DJANGO_SUPERUSER"],
                    "review_candidates": len(candidates),
                }
            )
        else:
            observations.append({"code": "DATA_AUDIT_SKIPPED_UNSUPPORTED_SCHEMA", "count": 1})

        after_hash = database.sha256()
        source_identity_unchanged = database.path_identity_unchanged()
        sidecars_absent = database.sidecars_absent()

        manifest_candidates = []
        for key in sorted(candidates):
            item = candidates[key]
            manifest_candidates.append(
                {
                    "legacy_user_id": item["legacy_user_id"],
                    "usermember_ids": sorted(item["usermember_ids"]),
                    "club_ids": sorted(item["club_ids"]),
                    "evidence_codes": sorted(item["evidence_codes"]),
                    "decision": "PENDING",
                }
            )

    if before_hash != after_hash or not source_identity_unchanged or not sidecars_absent:
        data_blockers.append(
            {"code": "SOURCE_CHANGED_DURING_PREFLIGHT", "count": 1, "references": []}
        )

    if before_hash != after_hash or not source_identity_unchanged or not sidecars_absent:
        exit_code = EXIT_SOURCE_CHANGED
    elif schema_blockers:
        exit_code = EXIT_UNSUPPORTED_SCHEMA
    elif data_blockers:
        exit_code = EXIT_DATA_BLOCKED
    else:
        exit_code = EXIT_OK

    blockers = sorted(schema_blockers + data_blockers, key=lambda item: item["code"])
    source_reference = redactor.reference("sqlite-source", str(source_path))
    general_report = {
        "tool": "campus-plus-legacy-preflight",
        "mode": "dry-run-read-only",
        "status": "PASS" if exit_code == EXIT_OK else "BLOCKED",
        "exit_code": exit_code,
        "source": {
            "engine": "sqlite",
            "source_reference": source_reference,
            "content_sha256_before": before_hash,
            "content_sha256_after": after_hash,
            "read_only_uri": True,
            "query_only": True,
        },
        "schema": {
            "supported_contract": contract["name"] if contract else None,
            "expected_contract_candidate": expected_contract["name"],
            "fingerprint": schema_fingerprint,
            "migration_leaves": _leaf_migrations(migrations),
            "migration_count": len(migrations),
            "expected_migration_count": len(expected_migrations),
        },
        "counts": counts,
        "blockers": blockers,
        "observations": sorted(observations, key=lambda item: item["code"]),
        "authorization_review": {
            "historical_role_buckets": role_buckets,
            "aggregate_counts": authorization_counts,
            "policy": {
                "preserve_usermember_role": True,
                "accounts_user_role_authoritative": True,
                "automatic_privilege_promotion": False,
                "is_staff_api_privilege": False,
                "preserve_is_superuser": True,
                "club_head_grants_board_access": False,
                "club_membership_grants_board_access": False,
                "board_requires_role_and_assignment": True,
                "board_assignments_created": 0,
            },
        },
        "phone_review": {
            "canonical_field": "UserMember.phone",
            "expected_legacy_phone_columns": 0,
            "unexpected_phone_columns": len(phone_columns),
            "values_invented_or_copied": 0,
        },
        "postgresql_support": {
            "implemented": False,
            "requirements": [
                "dedicated SELECT-only source role",
                "READ ONLY stable transaction",
                "transaction_read_only verification",
                "exact server version and schema contract",
                "isolated PostgreSQL rehearsal",
            ],
        },
    }
    review_manifest = {
        "manifest_version": 1,
        "classification": "ACCESS_CONTROLLED",
        "source_reference": source_reference,
        "source_content_sha256": before_hash,
        "schema_fingerprint": schema_fingerprint,
        "policy": "pending-explicit-board-authorization-v1",
        "automatic_approvals": 0,
        "assignments_created": 0,
        "candidates": manifest_candidates,
    }
    return PreflightResult(general_report, review_manifest, exit_code)
