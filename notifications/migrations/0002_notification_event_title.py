from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='event_title',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
