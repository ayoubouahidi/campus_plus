from importlib import import_module
from io import StringIO

from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase

from core_data.models import UserMember
from core_data.phone_reconciliation import (
    PhoneConflictReason,
    PhoneReconciliationBlocked,
    reconcile_phone_records,
)


User = get_user_model()


class PhoneReconciliationTests(TestCase):
    def create_pair(self, suffix, *, account_phone='', member_phone='', member=True):
        user = User.objects.create_user(
            username=f'phone-user-{suffix}',
            password='unused',
            phone=account_phone,
        )
        profile = None
        if member:
            profile = UserMember.objects.create(
                user=user,
                username=user.username,
                phone=member_phone,
            )
        return user, profile

    def reconcile(self, *, apply=True):
        return reconcile_phone_records(
            user_model=User,
            member_model=UserMember,
            apply=apply,
        )

    def test_account_phone_backfills_blank_member_phone(self):
        user, member = self.create_pair(
            'account-only',
            account_phone='+212600000001',
            member_phone='',
        )

        result = self.reconcile()

        member.refresh_from_db()
        user.refresh_from_db()
        self.assertEqual(member.phone, '+212600000001')
        self.assertEqual(user.phone, '+212600000001')
        self.assertEqual(result.backfilled_members, 1)

    def test_member_phone_is_preserved_when_account_phone_is_blank(self):
        user, member = self.create_pair(
            'member-only',
            account_phone='',
            member_phone='+212600000002',
        )

        result = self.reconcile()

        member.refresh_from_db()
        user.refresh_from_db()
        self.assertEqual(member.phone, '+212600000002')
        self.assertEqual(user.phone, '')
        self.assertEqual(result.preserved_member_phones, 1)

    def test_identical_phone_values_are_unchanged(self):
        user, member = self.create_pair(
            'identical',
            account_phone='+212600000003',
            member_phone='+212600000003',
        )

        result = self.reconcile()

        member.refresh_from_db()
        user.refresh_from_db()
        self.assertEqual(member.phone, '+212600000003')
        self.assertEqual(user.phone, '+212600000003')
        self.assertEqual(result.identical_pairs, 1)
        self.assertEqual(result.backfilled_members, 0)

    def test_conflicting_nonblank_values_block_without_exposing_values(self):
        account_phone = '+212600000004'
        member_phone = '+212600000005'
        user, member = self.create_pair(
            'conflict',
            account_phone=account_phone,
            member_phone=member_phone,
        )

        with self.assertRaises(PhoneReconciliationBlocked) as raised:
            self.reconcile()

        message = str(raised.exception)
        report = raised.exception.report.as_dict()
        self.assertNotIn(account_phone, message)
        self.assertNotIn(member_phone, message)
        self.assertEqual(report["status"], "BLOCKED")
        self.assertEqual(report["summary"]["scanned_users"], 1)
        self.assertEqual(report["summary"]["total_blockers"], 1)
        self.assertEqual(
            report["summary"]["blockers_by_reason"],
            {
                "ACCOUNT_PHONE_WITHOUT_MEMBER": 0,
                "NONBLANK_VALUES_DIFFER": 1,
            },
        )
        self.assertEqual(report["affected_records"], [{
            "user_id": user.pk,
            "member_id": member.pk,
            "reason": PhoneConflictReason.NONBLANK_VALUES_DIFFER.value,
        }])
        user.refresh_from_db()
        member.refresh_from_db()
        self.assertEqual(user.phone, account_phone)
        self.assertEqual(member.phone, member_phone)

    def test_both_blank_values_are_unchanged_and_whitespace_counts_as_blank(self):
        user, member = self.create_pair(
            'both-blank',
            account_phone='   ',
            member_phone='\t',
        )

        result = self.reconcile()

        user.refresh_from_db()
        member.refresh_from_db()
        self.assertEqual(user.phone, '   ')
        self.assertEqual(member.phone, '\t')
        self.assertEqual(result.blank_pairs, 1)

    def test_account_phone_without_member_blocks_but_blank_account_does_not(self):
        phone = '+212600000006'
        blocked_user, _ = self.create_pair(
            'missing-profile',
            account_phone=phone,
            member=False,
        )
        blank_user, _ = self.create_pair(
            'blank-missing-profile',
            account_phone=' ',
            member=False,
        )

        with self.assertRaises(PhoneReconciliationBlocked) as raised:
            self.reconcile()

        self.assertEqual(raised.exception.missing_member_user_ids, (blocked_user.pk,))
        self.assertEqual(raised.exception.report.as_dict()["affected_records"], [{
            "user_id": blocked_user.pk,
            "member_id": None,
            "reason": "ACCOUNT_PHONE_WITHOUT_MEMBER",
        }])
        self.assertEqual(
            raised.exception.report.as_dict()["summary"]["total_blockers"],
            1,
        )
        self.assertNotIn(phone, str(raised.exception))
        self.assertFalse(UserMember.objects.filter(user=blocked_user).exists())
        self.assertFalse(UserMember.objects.filter(user=blank_user).exists())

    def test_any_conflict_prevents_partial_backfills_across_users(self):
        pending_user, pending_member = self.create_pair(
            'pending-before-conflict',
            account_phone='+212600000007',
            member_phone='',
        )
        conflict_user, conflict_member = self.create_pair(
            'later-conflict',
            account_phone='+212600000008',
            member_phone='+212600000009',
        )

        with self.assertRaises(PhoneReconciliationBlocked) as raised:
            self.reconcile()

        report = raised.exception.report.as_dict()
        self.assertEqual(report["summary"], {
            "scanned_users": 2,
            "eligible_backfills": 1,
            "total_blockers": 1,
            "blockers_by_reason": {
                "ACCOUNT_PHONE_WITHOUT_MEMBER": 0,
                "NONBLANK_VALUES_DIFFER": 1,
            },
        })
        self.assertEqual(report["affected_records"], [{
            "user_id": conflict_user.pk,
            "member_id": conflict_member.pk,
            "reason": "NONBLANK_VALUES_DIFFER",
        }])
        self.assertNotIn(str(pending_user.phone), str(report))
        pending_member.refresh_from_db()
        self.assertEqual(pending_member.phone, '')

    def test_command_conflict_report_is_redacted_and_actionable(self):
        account_phone = '+212600000016'
        member_phone = '+212600000017'
        user, member = self.create_pair(
            'command-conflict',
            account_phone=account_phone,
            member_phone=member_phone,
        )

        with self.assertRaises(CommandError) as raised:
            call_command('reconcile_profile_phones', '--apply')

        report_text = str(raised.exception)
        self.assertIn(f'"user_id": {user.pk}', report_text)
        self.assertIn(f'"member_id": {member.pk}', report_text)
        self.assertIn('"reason": "NONBLANK_VALUES_DIFFER"', report_text)
        self.assertIn('"total_blockers": 1', report_text)
        self.assertNotIn(account_phone, report_text)
        self.assertNotIn(member_phone, report_text)

    def test_dry_run_and_repeated_apply_are_safe_and_idempotent(self):
        _, member = self.create_pair(
            'idempotent',
            account_phone='+212600000010',
            member_phone='',
        )

        dry_run = self.reconcile(apply=False)
        member.refresh_from_db()
        self.assertEqual(dry_run.backfilled_members, 1)
        self.assertEqual(member.phone, '')

        first = self.reconcile(apply=True)
        second = self.reconcile(apply=True)
        member.refresh_from_db()
        self.assertEqual(first.backfilled_members, 1)
        self.assertEqual(second.backfilled_members, 0)
        self.assertEqual(member.phone, '+212600000010')

    def test_management_command_requires_mode_and_never_prints_phone_values(self):
        phone = '+212600000011'
        _, member = self.create_pair(
            'command',
            account_phone=phone,
            member_phone='',
        )
        output = StringIO()

        with self.assertRaises(CommandError):
            call_command('reconcile_profile_phones', stdout=output)
        call_command('reconcile_profile_phones', '--dry-run', stdout=output)
        member.refresh_from_db()
        self.assertEqual(member.phone, '')
        self.assertNotIn(phone, output.getvalue())

        call_command('reconcile_profile_phones', '--apply', stdout=output)
        member.refresh_from_db()
        self.assertEqual(member.phone, phone)
        self.assertNotIn(phone, output.getvalue())


class PhoneReconciliationMigrationTests(TransactionTestCase):
    migrate_from = ('core_data', '0010_rsvp')
    migrate_to = ('core_data', '0011_reconcile_account_phones')

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate([target])

    def test_migration_backfills_populated_rows_and_is_repeatable(self):
        self.migrate(self.migrate_from)
        user = User.objects.create_user(
            username='migration-phone-user',
            password='unused',
            phone='+212600000012',
        )
        member = UserMember.objects.create(
            user=user,
            username=user.username,
            phone='',
        )

        self.migrate(self.migrate_to)

        member.refresh_from_db()
        self.assertEqual(member.phone, '+212600000012')
        migration = import_module(
            'core_data.migrations.0011_reconcile_account_phones'
        )
        with connection.schema_editor() as schema_editor:
            migration.reconcile_account_phones(apps, schema_editor)
        member.refresh_from_db()
        self.assertEqual(member.phone, '+212600000012')

    def test_migration_conflict_rolls_back_all_rows_and_history(self):
        self.migrate(self.migrate_from)
        first_user = User.objects.create_user(
            username='migration-pending-user',
            password='unused',
            phone='+212600000013',
        )
        first_member = UserMember.objects.create(
            user=first_user,
            username=first_user.username,
            phone='',
        )
        conflict_user = User.objects.create_user(
            username='migration-conflict-user',
            password='unused',
            phone='+212600000014',
        )
        conflict_member = UserMember.objects.create(
            user=conflict_user,
            username=conflict_user.username,
            phone='+212600000015',
        )

        with self.assertRaises(PhoneReconciliationBlocked):
            self.migrate(self.migrate_to)

        first_member.refresh_from_db()
        self.assertEqual(first_member.phone, '')
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM django_migrations WHERE app=%s AND name=%s",
                ['core_data', '0011_reconcile_account_phones'],
            )
            migration_record = cursor.fetchone()
        self.assertIsNone(migration_record)

        conflict_member.phone = conflict_user.phone
        conflict_member.save(update_fields=['phone'])
        self.migrate(self.migrate_to)
        first_member.refresh_from_db()
        self.assertEqual(first_member.phone, '+212600000013')
