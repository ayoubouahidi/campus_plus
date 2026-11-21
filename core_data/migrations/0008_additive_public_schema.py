import core_data.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core_data', '0007_usermember_phone'),
    ]

    operations = [
        migrations.AddField(
            model_name='department',
            name='slug',
            field=models.SlugField(blank=True, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='club',
            name='slug',
            field=models.SlugField(
                blank=True,
                max_length=100,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name='club',
            name='logo',
            field=models.ImageField(
                blank=True,
                upload_to=core_data.models.uuid_path('club_logos'),
                validators=[
                    core_data.models.validate_file_size,
                    core_data.models.validate_image_content,
                ],
            ),
        ),
        migrations.AddField(
            model_name='club',
            name='banner',
            field=models.ImageField(
                blank=True,
                upload_to=core_data.models.uuid_path('club_banners'),
                validators=[
                    core_data.models.validate_file_size,
                    core_data.models.validate_image_content,
                ],
            ),
        ),
        migrations.AddField(
            model_name='clubevent',
            name='category',
            field=models.CharField(
                blank=True,
                choices=[
                    ('Tech', 'Tech'),
                    ('Media', 'Media'),
                    ('Music', 'Music'),
                    ('Sports', 'Sports'),
                    ('Business', 'Business'),
                    ('EventsOrganization', 'Events Organization'),
                    ('Gaming', 'Gaming'),
                ],
                max_length=30,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='clubevent',
            name='capacity',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AlterModelOptions(
            name='clubevent',
            options={'ordering': ['starts_at']},
        ),
        migrations.AlterField(
            model_name='clubevent',
            name='image_path',
            field=models.ImageField(
                blank=True,
                upload_to=core_data.models.uuid_path('events_pics'),
                validators=[
                    core_data.models.validate_file_size,
                    core_data.models.validate_image_content,
                ],
            ),
        ),
    ]
