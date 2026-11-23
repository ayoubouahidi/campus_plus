from django.core.exceptions import ValidationError
from django.core.validators import validate_slug
from django.db import migrations, models
from django.utils.text import slugify


def backfill_club_slugs(apps, schema_editor):
    Club = apps.get_model('core_data', 'Club')
    database = schema_editor.connection.alias
    clubs = Club.objects.using(database).order_by('pk')

    used_slugs = set()
    pending = []
    for club in clubs.iterator():
        if club.slug:
            try:
                validate_slug(club.slug)
            except ValidationError as error:
                raise RuntimeError(
                    f'Club {club.pk} has an invalid existing slug; correct it '
                    'before applying core_data.0012.'
                ) from error
            if club.slug in used_slugs:
                raise RuntimeError(
                    f'Club {club.pk} has a duplicate existing slug; correct it '
                    'before applying core_data.0012.'
                )
            used_slugs.add(club.slug)
        else:
            pending.append(club)

    for club in pending:
        base_slug = slugify(club.name)[:100] or 'club'
        candidate = base_slug
        suffix = 2
        while candidate in used_slugs:
            suffix_text = f'-{suffix}'
            candidate = f'{base_slug[:100 - len(suffix_text)]}{suffix_text}'
            suffix += 1
        Club.objects.using(database).filter(pk=club.pk).update(slug=candidate)
        used_slugs.add(candidate)


class Migration(migrations.Migration):

    dependencies = [
        ('core_data', '0011_reconcile_account_phones'),
    ]

    operations = [
        migrations.RunPython(
            backfill_club_slugs,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name='club',
            name='slug',
            field=models.SlugField(max_length=100, unique=True),
        ),
    ]
