-- Actualiza los defaults de super tie-break para deportes tipo sets (pádel y tenis).
-- En pádel, el estándar habitual de torneos es super tie-break a 11 puntos hasta cuartos de final
-- y al mejor de 3 sets completos a partir de semifinales.

update public.sports
set default_scoring_config = jsonb_set(
  jsonb_set(
    default_scoring_config,
    '{superTiebreakPoints}',
    '11'::jsonb
  ),
  '{superTiebreakUntil}',
  '"quarterfinals"'::jsonb
)
where id in ('padel', 'tenis');
