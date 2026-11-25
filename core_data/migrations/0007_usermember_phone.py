from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core_data', '0006_usermember_year_of_study'),
    ]

    operations = [
        migrations.AddField(
            model_name='usermember',
            name='phone',
            field=models.CharField(blank=True, max_length=30),
        ),
    ]
