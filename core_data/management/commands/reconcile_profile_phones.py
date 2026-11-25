from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from core_data.models import UserMember
from core_data.phone_reconciliation import (
    PhoneReconciliationBlocked,
    reconcile_phone_records,
)


class Command(BaseCommand):
    help = (
        "Validate account/profile phone pairs and backfill blank canonical "
        "UserMember.phone values without exposing phone data."
    )

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group(required=True)
        mode.add_argument('--dry-run', action='store_true')
        mode.add_argument('--apply', action='store_true')
        parser.add_argument('--database', default='default')

    def handle(self, *args, **options):
        try:
            result = reconcile_phone_records(
                user_model=get_user_model(),
                member_model=UserMember,
                using=options['database'],
                apply=options['apply'],
            )
        except PhoneReconciliationBlocked as error:
            raise CommandError(str(error)) from error

        mode = 'APPLIED' if options['apply'] else 'DRY-RUN'
        self.stdout.write(
            self.style.SUCCESS(
                f"Phone reconciliation {mode}: scanned={result.scanned_users}, "
                f"backfills={result.backfilled_members}, "
                f"preserved={result.preserved_member_phones}, "
                f"identical={result.identical_pairs}, "
                f"blank={result.blank_pairs}, "
                f"blank_without_profile={result.users_without_blank_profiles}"
            )
        )
