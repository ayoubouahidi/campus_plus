from django.db import migrations, models


def mark_existing_uploaded_avatars_custom(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(usermember__image_path__gt="").update(
        avatar_is_custom=True,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_emailverification"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar_is_custom",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(
            mark_existing_uploaded_avatars_custom,
            migrations.RunPython.noop,
        ),
    ]
