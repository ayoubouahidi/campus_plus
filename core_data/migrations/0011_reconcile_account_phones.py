from django.db import migrations

from core_data.phone_reconciliation import reconcile_phone_records


def reconcile_account_phones(apps, schema_editor):
    reconcile_phone_records(
        user_model=apps.get_model('accounts', 'User'),
        member_model=apps.get_model('core_data', 'UserMember'),
        using=schema_editor.connection.alias,
        apply=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_alter_user_options_and_more'),
        ('core_data', '0010_rsvp'),
    ]

    operations = [
        migrations.RunPython(
            reconcile_account_phones,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
