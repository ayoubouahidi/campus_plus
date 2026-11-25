import hashlib
import json
import os
import sqlite3
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.test import SimpleTestCase

from core_data.legacy_preflight import (
    EXIT_DATA_BLOCKED,
    EXIT_OK,
    EXIT_UNSAFE_SOURCE,
    EXIT_UNSUPPORTED_SCHEMA,
    EXPECTED_MIGRATIONS,
    FULL_FRAMEWORK_MIGRATIONS,
    PreflightSafetyError,
    ReadOnlySQLite,
    run_preflight,
    validate_source_path,
)
from core_data.management.commands.legacy_migration_preflight import Command


SCHEMA_SQL = """
CREATE TABLE "django_migrations" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app" varchar(255) NOT NULL, "name" varchar(255) NOT NULL, "applied" datetime NOT NULL);
CREATE TABLE "django_content_type" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "app_label" varchar(100) NOT NULL, "model" varchar(100) NOT NULL);
CREATE UNIQUE INDEX "django_content_type_app_label_model_76bd3d3b_uniq" ON "django_content_type" ("app_label", "model");
CREATE TABLE "auth_permission" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "content_type_id" integer NOT NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "codename" varchar(100) NOT NULL, "name" varchar(255) NOT NULL);
CREATE INDEX "auth_permission_content_type_id_2f476e4b" ON "auth_permission" ("content_type_id");
CREATE UNIQUE INDEX "auth_permission_content_type_id_codename_01ab375a_uniq" ON "auth_permission" ("content_type_id", "codename");
CREATE TABLE "auth_group" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(150) NOT NULL UNIQUE);
CREATE TABLE "auth_group_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "auth_group_permissions_permission_id_84c5c92e" ON "auth_group_permissions" ("permission_id");
CREATE INDEX "auth_group_permissions_group_id_b120cbf9" ON "auth_group_permissions" ("group_id");
CREATE UNIQUE INDEX "auth_group_permissions_group_id_permission_id_0cd325b0_uniq" ON "auth_group_permissions" ("group_id", "permission_id");
CREATE TABLE "auth_user" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "password" varchar(128) NOT NULL, "last_login" datetime NULL, "is_superuser" bool NOT NULL, "username" varchar(150) NOT NULL {username_unique}, "last_name" varchar(150) NOT NULL, "email" varchar(254) NOT NULL, "is_staff" bool NOT NULL, "is_active" bool NOT NULL, "date_joined" datetime NOT NULL, "first_name" varchar(150) NOT NULL{user_phone});
CREATE TABLE "auth_user_groups" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "group_id" integer NOT NULL REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "auth_user_groups_group_id_97559544" ON "auth_user_groups" ("group_id");
CREATE INDEX "auth_user_groups_user_id_6a12ed8b" ON "auth_user_groups" ("user_id");
CREATE UNIQUE INDEX "auth_user_groups_user_id_group_id_94350c0c_uniq" ON "auth_user_groups" ("user_id", "group_id");
CREATE TABLE "auth_user_user_permissions" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "permission_id" integer NOT NULL REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE INDEX "auth_user_user_permissions_permission_id_1fbb5f2c" ON "auth_user_user_permissions" ("permission_id");
CREATE INDEX "auth_user_user_permissions_user_id_a95ead1b" ON "auth_user_user_permissions" ("user_id");
CREATE UNIQUE INDEX "auth_user_user_permissions_user_id_permission_id_14a6b632_uniq" ON "auth_user_user_permissions" ("user_id", "permission_id");
CREATE TABLE "authtoken_token" ("key" varchar(40) NOT NULL PRIMARY KEY, "created" datetime NOT NULL, "user_id" integer NOT NULL UNIQUE REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED);
CREATE TABLE "core_data_department" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "title" varchar(255) NOT NULL);
CREATE INDEX "core_data_d_title_475c20_idx" ON "core_data_department" ("title");
CREATE TABLE "core_data_clubevent" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(255) NOT NULL, "description" TEXT NOT NULL, "parent_id_id" bigint NOT NULL REFERENCES "core_data_department" ("id") DEFERRABLE INITIALLY DEFERRED, "club_id" bigint NULL REFERENCES "core_data_club" ("id") DEFERRABLE INITIALLY DEFERRED, "created_at" datetime NULL, "ends_at" datetime NULL, "location" varchar(255) NOT NULL, "starts_at" datetime NULL, "status" varchar(20) NOT NULL, "updated_at" datetime NULL, "image_path" varchar(100) NOT NULL);
CREATE INDEX "core_data_c_club_id_1070ec_idx" ON "core_data_clubevent" ("club_id", "starts_at");
CREATE INDEX "core_data_c_parent__f4a3d0_idx" ON "core_data_clubevent" ("parent_id_id", "name");
CREATE INDEX "core_data_clubevent_club_id_78c9b1a3" ON "core_data_clubevent" ("club_id");
CREATE TABLE "core_data_usermember" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "username" varchar(150) NOT NULL UNIQUE, "event_date" datetime NULL, "role" varchar(50) NULL, "image_path" varchar(100) NOT NULL, "department_id_id" bigint NULL REFERENCES "core_data_department" ("id") DEFERRABLE INITIALLY DEFERRED, "first_name" varchar(150) NOT NULL, "last_name" varchar(150) NOT NULL, "user_id" integer NULL UNIQUE REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "club_id_id" bigint NULL REFERENCES "core_data_club" ("id") DEFERRABLE INITIALLY DEFERRED, "year_of_study" smallint unsigned NULL CHECK ("year_of_study" >= 0){profile_phone});
CREATE INDEX "core_data_u_event_d_69fb62_idx" ON "core_data_usermember" ("event_date");
CREATE INDEX "core_data_u_club_id_2e6dc3_idx" ON "core_data_usermember" ("club_id_id");
CREATE INDEX "core_data_u_departm_9b8d95_idx" ON "core_data_usermember" ("department_id_id");
CREATE INDEX "core_data_usermember_club_id_id_482163a3" ON "core_data_usermember" ("club_id_id");
CREATE INDEX "core_data_usermember_department_id_id_c6607896" ON "core_data_usermember" ("department_id_id");
CREATE TABLE "core_data_club" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "name" varchar(255) NOT NULL, "department_id" bigint NOT NULL REFERENCES "core_data_department" ("id") DEFERRABLE INITIALLY DEFERRED, "head_id" bigint NULL REFERENCES "core_data_usermember" ("id") DEFERRABLE INITIALLY DEFERRED, "contact_email" varchar(254) NOT NULL, "created_at" datetime NULL, "description" TEXT NOT NULL, "is_active" bool NOT NULL, "meeting_day" varchar(20) NOT NULL, "meeting_location" varchar(255) NOT NULL, "meeting_time" time NULL, "updated_at" datetime NULL, CONSTRAINT "unique_club_name_per_department" UNIQUE ("department_id", "name"));
CREATE INDEX "core_data_club_head_id_0786270f" ON "core_data_club" ("head_id");
CREATE INDEX "core_data_club_department_id_87e69dc2" ON "core_data_club" ("department_id");
"""

FULL_FRAMEWORK_SCHEMA_SQL = """
CREATE TABLE "django_admin_log" ("id" integer NOT NULL PRIMARY KEY AUTOINCREMENT, "object_id" text NULL, "object_repr" varchar(200) NOT NULL, "action_flag" smallint unsigned NOT NULL CHECK ("action_flag" >= 0), "change_message" text NOT NULL, "content_type_id" integer NULL REFERENCES "django_content_type" ("id") DEFERRABLE INITIALLY DEFERRED, "user_id" integer NOT NULL REFERENCES "auth_user" ("id") DEFERRABLE INITIALLY DEFERRED, "action_time" datetime NOT NULL);
CREATE INDEX "django_admin_log_user_id_c564eba6" ON "django_admin_log" ("user_id");
CREATE INDEX "django_admin_log_content_type_id_c4bce8eb" ON "django_admin_log" ("content_type_id");
CREATE TABLE "django_session" ("session_key" varchar(40) NOT NULL PRIMARY KEY, "session_data" text NOT NULL, "expire_date" datetime NOT NULL);
CREATE INDEX "django_session_expire_date_a5c62663" ON "django_session" ("expire_date");
"""


class LegacyPreflightTests(SimpleTestCase):
    databases = set()
    redaction_key = b"synthetic-redaction-key-32-bytes-minimum"

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(
            prefix="campus-plus-preflight-",
            dir="/tmp",
        )
        self.root = Path(self.temporary.name).resolve()

    def tearDown(self):
        self.temporary.cleanup()

    def assert_isolated_write_path(self, path):
        resolved = Path(path).resolve(strict=False)
        self.assertTrue(resolved.is_relative_to(self.root))
        self.assertFalse(
            resolved.is_relative_to(Path("/home/ahlahfid/projects/campus_plus"))
        )
        self.assertFalse(
            resolved.is_relative_to(
                Path("/tmp/campus-plus-pr3-integration-sE6n54/clone")
            )
        )

    def create_legacy_database(
        self,
        name="legacy.sqlite3",
        *,
        extra_table=False,
        missing_migration=False,
        duplicate_migration=False,
        duplicate_email=False,
        duplicate_username=False,
        broken_event_fk=False,
        missing_profile_user=False,
        invalid_token_owner=False,
        phone_columns=False,
        phone_conflict=False,
        full_framework=False,
        invalid_group_permission=False,
        invalid_permission_content_type=False,
    ):
        path = self.root / name
        self.assert_isolated_write_path(path)
        self.assertFalse(path.exists())
        connection = sqlite3.connect(path)
        try:
            connection.executescript(
                SCHEMA_SQL.format(
                    username_unique="" if duplicate_username else "UNIQUE",
                    user_phone=(
                        ', "phone" varchar(30) NOT NULL DEFAULT \'\''
                        if phone_columns
                        else ""
                    ),
                    profile_phone=(
                        ', "phone" varchar(30) NOT NULL DEFAULT \'\''
                        if phone_columns
                        else ""
                    ),
                )
            )
            if full_framework:
                connection.executescript(FULL_FRAMEWORK_SCHEMA_SQL)
            migrations = sorted(
                FULL_FRAMEWORK_MIGRATIONS if full_framework else EXPECTED_MIGRATIONS
            )
            if missing_migration:
                migrations.remove(("core_data", "0006_usermember_year_of_study"))
            connection.executemany(
                "INSERT INTO django_migrations(app, name, applied) VALUES (?, ?, ?)",
                ((app, migration, "2026-01-01T00:00:00+00:00") for app, migration in migrations),
            )
            if duplicate_migration:
                connection.execute(
                    "INSERT INTO django_migrations(app, name, applied) VALUES (?, ?, ?)",
                    (
                        "core_data",
                        "0006_usermember_year_of_study",
                        "2026-01-02T00:00:00+00:00",
                    ),
                )
            connection.execute(
                "INSERT INTO django_content_type(id, app_label, model) VALUES (1, 'auth', 'group')"
            )
            connection.execute(
                "INSERT INTO auth_permission(id, content_type_id, codename, name) "
                "VALUES (1, 1, 'change_group', 'Can change group')"
            )
            if invalid_permission_content_type:
                connection.execute(
                    "UPDATE auth_permission SET content_type_id=999 WHERE id=1"
                )
            connection.execute(
                "INSERT INTO auth_group(id, name) VALUES (50, 'Synthetic Managers')"
            )
            connection.execute(
                "INSERT INTO auth_group_permissions(id, group_id, permission_id) VALUES (1, 50, 1)"
            )
            if invalid_group_permission:
                connection.execute(
                    "UPDATE auth_group_permissions SET permission_id=999 WHERE id=1"
                )
            connection.execute(
                "INSERT INTO auth_user(id, password, last_login, is_superuser, username, "
                "last_name, email, is_staff, is_active, date_joined, first_name) "
                "VALUES (1, 'pbkdf2_sha256$secret-hash-material', NULL, 0, "
                "'synthetic-user', 'Person', 'Private.Person@Example.test', 0, 1, "
                "'2026-01-01T00:00:00+00:00', 'Synthetic')"
            )
            if duplicate_email or duplicate_username:
                connection.execute(
                    "INSERT INTO auth_user(id, password, last_login, is_superuser, username, "
                    "last_name, email, is_staff, is_active, date_joined, first_name) "
                    "VALUES (2, 'pbkdf2_sha256$another-secret', NULL, 0, ?, 'Second', ?, 0, 1, "
                    "'2026-01-01T00:00:00+00:00', 'Synthetic')",
                    (
                        "synthetic-user" if duplicate_username else "synthetic-user-two",
                        (
                            "private.person@example.test"
                            if duplicate_email
                            else "second@example.test"
                        ),
                    ),
                )
            connection.execute(
                "INSERT INTO auth_user_groups(id, user_id, group_id) VALUES (1, 1, 50)"
            )
            connection.execute(
                "INSERT INTO auth_user_user_permissions(id, user_id, permission_id) VALUES (1, 1, 1)"
            )
            token_owner = 999 if invalid_token_owner else 1
            connection.execute(
                "INSERT INTO authtoken_token(key, created, user_id) VALUES (?, ?, ?)",
                ("secret-token-key-material-never-report!!", "2026-01-01", token_owner),
            )
            connection.execute(
                "INSERT INTO core_data_department(id, title) VALUES (10, 'Synthetic Department')"
            )
            profile_user = None if missing_profile_user else 1
            connection.execute(
                "INSERT INTO core_data_usermember(id, username, event_date, role, image_path, "
                "department_id_id, first_name, last_name, user_id, club_id_id, year_of_study) "
                "VALUES (20, 'synthetic-profile', NULL, 'Historical President Secret', "
                "'avatars/synthetic.webp', 10, 'Synthetic', 'Person', ?, NULL, 2)",
                (profile_user,),
            )
            if duplicate_email or duplicate_username:
                connection.execute(
                    "INSERT INTO core_data_usermember(id, username, event_date, role, image_path, "
                    "department_id_id, first_name, last_name, user_id, club_id_id, year_of_study) "
                    "VALUES (21, 'synthetic-profile-two', NULL, '', '', 10, 'Second', 'Person', 2, NULL, 2)"
                )
            connection.execute(
                "INSERT INTO core_data_club(id, name, department_id, head_id, contact_email, "
                "created_at, description, is_active, meeting_day, meeting_location, meeting_time, updated_at) "
                "VALUES (30, 'Synthetic Club', 10, 20, '', NULL, '', 1, '', '', NULL, NULL)"
            )
            connection.execute(
                "UPDATE core_data_usermember SET club_id_id=30 WHERE id=20"
            )
            if phone_conflict:
                self.assertTrue(phone_columns)
                connection.execute(
                    "UPDATE auth_user SET phone='+212600000001' WHERE id=1"
                )
                connection.execute(
                    "UPDATE core_data_usermember SET phone='+212600000002' WHERE id=20"
                )
            event_department = 999 if broken_event_fk else 10
            connection.execute(
                "INSERT INTO core_data_clubevent(id, name, description, parent_id_id, club_id, "
                "created_at, ends_at, location, starts_at, status, updated_at, image_path) "
                "VALUES (40, 'Synthetic Event', '', ?, 30, NULL, '2026-01-02T12:00:00+00:00', "
                "'', '2026-01-02T10:00:00+00:00', 'planned', NULL, 'events/synthetic.webp')",
                (event_department,),
            )
            if full_framework:
                connection.execute(
                    "INSERT INTO django_admin_log(id, object_id, object_repr, action_flag, "
                    "change_message, content_type_id, user_id, action_time) "
                    "VALUES (60, '1', 'Synthetic object', 1, '', 1, 1, "
                    "'2026-01-01T00:00:00+00:00')"
                )
                connection.execute(
                    "INSERT INTO django_session(session_key, session_data, expire_date) "
                    "VALUES ('synthetic-session-key', 'redacted-session-body', "
                    "'2026-01-02T00:00:00+00:00')"
                )
            if extra_table:
                connection.execute(
                    "CREATE TABLE unexpected_private_table (id INTEGER PRIMARY KEY, secret TEXT)"
                )
            connection.commit()
        finally:
            connection.close()
        return path

    def file_hash(self, path):
        return hashlib.sha256(Path(path).read_bytes()).hexdigest()

    def analyze(self, path):
        return run_preflight(path, redaction_key=self.redaction_key)

    def blocker_codes(self, result):
        return {item["code"] for item in result.general_report["blockers"]}

    def test_valid_supported_legacy_schema_passes(self):
        result = self.analyze(self.create_legacy_database())
        self.assertEqual(result.exit_code, EXIT_OK)
        self.assertEqual(result.general_report["status"], "PASS")
        self.assertEqual(result.general_report["counts"]["users"], 1)

    def test_verified_admin_and_session_legacy_schema_passes(self):
        path = self.create_legacy_database(full_framework=True)
        before = self.file_hash(path)
        result = self.analyze(path)
        self.assertEqual(result.exit_code, EXIT_OK)
        self.assertEqual(
            result.general_report["schema"]["supported_contract"],
            "legacy-sqlite-admin-sessions-v1",
        )
        self.assertEqual(result.general_report["counts"]["admin_logs"], 1)
        self.assertEqual(result.general_report["counts"]["sessions"], 1)
        self.assertEqual(self.file_hash(path), before)

    def test_unexpected_schema_is_rejected(self):
        result = self.analyze(self.create_legacy_database(extra_table=True))
        self.assertEqual(result.exit_code, EXIT_UNSUPPORTED_SCHEMA)
        self.assertIn("UNEXPECTED_TABLES", self.blocker_codes(result))

    def test_missing_migration_history_is_rejected(self):
        result = self.analyze(self.create_legacy_database(missing_migration=True))
        self.assertEqual(result.exit_code, EXIT_UNSUPPORTED_SCHEMA)
        self.assertIn("MISSING_MIGRATIONS", self.blocker_codes(result))

    def test_duplicate_migration_history_is_rejected(self):
        result = self.analyze(self.create_legacy_database(duplicate_migration=True))
        self.assertEqual(result.exit_code, EXIT_UNSUPPORTED_SCHEMA)
        self.assertIn("DUPLICATE_MIGRATION_ROWS", self.blocker_codes(result))

    def test_case_insensitive_duplicate_email_is_blocking(self):
        result = self.analyze(self.create_legacy_database(duplicate_email=True))
        self.assertEqual(result.exit_code, EXIT_DATA_BLOCKED)
        self.assertIn("CASE_INSENSITIVE_EMAIL_CONFLICTS", self.blocker_codes(result))

    def test_duplicate_username_is_reported_even_with_schema_drift(self):
        result = self.analyze(self.create_legacy_database(duplicate_username=True))
        self.assertEqual(result.exit_code, EXIT_UNSUPPORTED_SCHEMA)
        self.assertIn("DUPLICATE_USERNAMES", self.blocker_codes(result))
        self.assertIn("SCHEMA_FINGERPRINT_MISMATCH", self.blocker_codes(result))

    def test_broken_foreign_key_is_blocking(self):
        result = self.analyze(self.create_legacy_database(broken_event_fk=True))
        self.assertEqual(result.exit_code, EXIT_DATA_BLOCKED)
        self.assertIn("MISSING_EVENT_DEPARTMENTS", self.blocker_codes(result))
        self.assertIn("FOREIGN_KEY_INTEGRITY_ERRORS", self.blocker_codes(result))

    def test_missing_user_profile_association_is_blocking(self):
        result = self.analyze(self.create_legacy_database(missing_profile_user=True))
        self.assertEqual(result.exit_code, EXIT_DATA_BLOCKED)
        self.assertIn("USER_PROFILE_ASSOCIATION_GAPS", self.blocker_codes(result))

    def test_invalid_token_owner_is_blocking(self):
        result = self.analyze(self.create_legacy_database(invalid_token_owner=True))
        self.assertEqual(result.exit_code, EXIT_DATA_BLOCKED)
        self.assertIn("INVALID_TOKEN_OWNERS", self.blocker_codes(result))

    def test_historical_role_is_pending_review_not_permission(self):
        result = self.analyze(self.create_legacy_database())
        policy = result.general_report["authorization_review"]["policy"]
        self.assertTrue(policy["preserve_usermember_role"])
        self.assertFalse(policy["automatic_privilege_promotion"])
        self.assertEqual(policy["board_assignments_created"], 0)
        candidate = result.review_manifest["candidates"][0]
        self.assertEqual(candidate["decision"], "PENDING")
        self.assertIn("HISTORICAL_ROLE", candidate["evidence_codes"])

    def test_club_head_and_membership_are_review_evidence_only(self):
        result = self.analyze(self.create_legacy_database())
        candidate = result.review_manifest["candidates"][0]
        self.assertIn("CLUB_HEAD", candidate["evidence_codes"])
        self.assertIn("CLUB_MEMBERSHIP", candidate["evidence_codes"])
        self.assertEqual(result.review_manifest["automatic_approvals"], 0)
        self.assertEqual(result.review_manifest["assignments_created"], 0)

    def test_unexpected_phone_columns_require_schema_review(self):
        result = self.analyze(self.create_legacy_database(phone_columns=True))
        self.assertEqual(result.exit_code, EXIT_UNSUPPORTED_SCHEMA)
        self.assertIn("UNEXPECTED_PHONE_COLUMNS", self.blocker_codes(result))
        self.assertEqual(result.general_report["phone_review"]["values_invented_or_copied"], 0)

    def test_different_nonblank_phone_values_are_blocking(self):
        result = self.analyze(
            self.create_legacy_database(phone_columns=True, phone_conflict=True)
        )
        self.assertEqual(result.exit_code, EXIT_UNSUPPORTED_SCHEMA)
        self.assertIn("PHONE_VALUE_CONFLICTS", self.blocker_codes(result))
        serialized = json.dumps(result.general_report)
        self.assertNotIn("+212600000001", serialized)
        self.assertNotIn("+212600000002", serialized)

    def test_read_only_wrapper_rejects_write_statements(self):
        path = self.create_legacy_database()
        before = self.file_hash(path)
        with ReadOnlySQLite(path) as database:
            self.assertEqual(database.query("PRAGMA query_only")[0][0], 1)
            with self.assertRaises(PreflightSafetyError):
                database.query("INSERT INTO auth_user(id) VALUES (999)")
        self.assertEqual(self.file_hash(path), before)

    def test_writable_pragma_and_sql_validation_bypasses_are_rejected(self):
        path = self.create_legacy_database()
        before = self.file_hash(path)
        with ReadOnlySQLite(path) as database:
            for sql in (
                "PRAGMA user_version=9",
                "PRAGMA table_info(auth_user); DELETE FROM auth_user",
                "WITH selected AS (SELECT 1) DELETE FROM auth_user WHERE id=1",
            ):
                with self.subTest(sql=sql):
                    with self.assertRaises(PreflightSafetyError):
                        database.query(sql)
        self.assertEqual(self.file_hash(path), before)

    def test_source_descriptor_survives_path_replacement_and_detects_it(self):
        source = self.create_legacy_database("pinned.sqlite3")
        replacement = self.create_legacy_database("replacement.sqlite3")
        moved = self.root / "moved-original.sqlite3"
        self.assert_isolated_write_path(moved)
        with ReadOnlySQLite(source) as database:
            original_hash = database.sha256()
            os.replace(source, moved)
            os.replace(replacement, source)
            self.assertEqual(database.sha256(), original_hash)
            self.assertEqual(
                database.query("SELECT COUNT(*) FROM auth_user")[0][0],
                1,
            )
            self.assertFalse(database.path_identity_unchanged())

    def test_missing_permission_relationships_are_blocking(self):
        for option, code in (
            ("invalid_group_permission", "INVALID_GROUP_PERMISSIONS"),
            ("invalid_permission_content_type", "INVALID_PERMISSION_CONTENT_TYPES"),
        ):
            with self.subTest(option=option):
                result = self.analyze(
                    self.create_legacy_database(
                        name=f"{option}.sqlite3",
                        **{option: True},
                    )
                )
                self.assertEqual(result.exit_code, EXIT_DATA_BLOCKED)
                self.assertIn(code, self.blocker_codes(result))

    def test_preflight_creates_no_database_or_target_files(self):
        path = self.create_legacy_database()
        before_files = {item.name for item in self.root.iterdir()}
        before_hash = self.file_hash(path)
        self.analyze(path)
        self.assertEqual({item.name for item in self.root.iterdir()}, before_files)
        self.assertEqual(self.file_hash(path), before_hash)

    def test_repeated_runs_are_identical_and_source_is_unchanged(self):
        path = self.create_legacy_database()
        before = self.file_hash(path)
        first = self.analyze(path)
        second = self.analyze(path)
        self.assertEqual(first, second)
        self.assertEqual(self.file_hash(path), before)

    def test_reports_redact_sensitive_values(self):
        result = self.analyze(self.create_legacy_database())
        serialized = json.dumps(
            {"general": result.general_report, "manifest": result.review_manifest}
        )
        for sensitive in (
            "Private.Person@Example.test",
            "private.person@example.test",
            "pbkdf2_sha256$secret-hash-material",
            "secret-token-key-material-never-report!!",
            "Historical President Secret",
        ):
            self.assertNotIn(sensitive, serialized)

    def test_management_command_writes_private_reports_without_source_changes(self):
        source = self.create_legacy_database()
        key = self.root / "redaction.key"
        general = self.root / "general.json"
        manifest = self.root / "review.json"
        for path in (key, general, manifest):
            self.assert_isolated_write_path(path)
        key.write_bytes(self.redaction_key)
        key.chmod(0o600)
        before = self.file_hash(source)
        call_command(
            "legacy_migration_preflight",
            "--dry-run",
            "--source-sqlite",
            str(source),
            "--redaction-key-file",
            str(key),
            "--general-report",
            str(general),
            "--review-manifest",
            str(manifest),
            verbosity=0,
        )
        self.assertEqual(self.file_hash(source), before)
        self.assertEqual(general.stat().st_mode & 0o777, 0o600)
        self.assertEqual(manifest.stat().st_mode & 0o777, 0o600)
        self.assertEqual(json.loads(general.read_text())["status"], "PASS")
        self.assertEqual(json.loads(manifest.read_text())["automatic_approvals"], 0)

    def test_command_exposes_no_execute_or_target_option(self):
        parser = Command().create_parser("manage.py", "legacy_migration_preflight")
        destinations = {action.dest for action in parser._actions}
        self.assertNotIn("execute", destinations)
        self.assertNotIn("target", destinations)
        self.assertIn("dry_run", destinations)

    def test_management_command_returns_documented_blocker_exit_code(self):
        source = self.create_legacy_database(duplicate_email=True)
        key = self.root / "blocker-redaction.key"
        general = self.root / "blocker-general.json"
        manifest = self.root / "blocker-review.json"
        key.write_bytes(self.redaction_key)
        key.chmod(0o600)
        before = self.file_hash(source)
        with self.assertRaises(SystemExit) as context:
            call_command(
                "legacy_migration_preflight",
                "--dry-run",
                "--source-sqlite",
                str(source),
                "--redaction-key-file",
                str(key),
                "--general-report",
                str(general),
                "--review-manifest",
                str(manifest),
                verbosity=0,
            )
        self.assertEqual(context.exception.code, EXIT_DATA_BLOCKED)
        self.assertEqual(json.loads(general.read_text())["exit_code"], EXIT_DATA_BLOCKED)
        self.assertEqual(self.file_hash(source), before)

    def test_report_and_key_symlinks_are_rejected(self):
        source = self.create_legacy_database()
        real_key = self.root / "real.key"
        real_key.write_bytes(self.redaction_key)
        real_key.chmod(0o600)
        key_link = self.root / "key-link"
        key_link.symlink_to(real_key)
        for use_key_link, use_report_link in ((True, False), (False, True)):
            suffix = "key" if use_key_link else "report"
            general = self.root / f"{suffix}-general.json"
            manifest = self.root / f"{suffix}-manifest.json"
            if use_report_link:
                victim = self.root / "report-victim"
                victim.write_text("do-not-replace")
                general.symlink_to(victim)
            with self.assertRaises(SystemExit) as context:
                call_command(
                    "legacy_migration_preflight",
                    "--dry-run",
                    "--source-sqlite",
                    str(source),
                    "--redaction-key-file",
                    str(key_link if use_key_link else real_key),
                    "--general-report",
                    str(general),
                    "--review-manifest",
                    str(manifest),
                    verbosity=0,
                )
            self.assertEqual(context.exception.code, EXIT_UNSAFE_SOURCE)
            if use_report_link:
                self.assertEqual(victim.read_text(), "do-not-replace")

    def test_unsafe_and_non_sqlite_sources_fail_closed(self):
        for source in (
            "/home/ahlahfid/projects/campus_plus/db.sqlite3",
            "postgresql://example.invalid/campus_plus",
        ):
            with self.subTest(source=source):
                with self.assertRaises(PreflightSafetyError) as context:
                    validate_source_path(source)
                self.assertEqual(context.exception.exit_code, EXIT_UNSAFE_SOURCE)
