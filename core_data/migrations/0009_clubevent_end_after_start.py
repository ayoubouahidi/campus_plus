from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core_data', '0008_additive_public_schema'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='clubevent',
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ends_at__gt=models.F('starts_at'),
                ),
                name='clubevent_end_after_start',
            ),
        ),
    ]
