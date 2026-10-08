-- =============================================================================
-- Afiche o imagen informativa del torneo (banner_url) y bucket de almacenamiento.
-- =============================================================================

alter table public.tournaments
  add column if not exists banner_url text check (
    banner_url is null or (
      banner_url ~ '^https?://' and char_length(banner_url) <= 2048
    )
  );

grant update (banner_url) on table public.tournaments to authenticated;

comment on column public.tournaments.banner_url is 'URL pública del afiche o banner informativo del torneo.';

-- Bucket de almacenamiento en Supabase Storage (hasta 5 MB por archivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tournament-media',
  'tournament-media',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- Políticas de acceso a storage.objects para tournament-media
drop policy if exists "tournament-media: lectura pública" on storage.objects;
create policy "tournament-media: lectura pública"
  on storage.objects for select
  using (bucket_id = 'tournament-media');

drop policy if exists "tournament-media: subida autenticada" on storage.objects;
create policy "tournament-media: subida autenticada"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'tournament-media');

drop policy if exists "tournament-media: actualización autenticada" on storage.objects;
create policy "tournament-media: actualización autenticada"
  on storage.objects for update to authenticated
  using (bucket_id = 'tournament-media');

drop policy if exists "tournament-media: eliminación autenticada" on storage.objects;
create policy "tournament-media: eliminación autenticada"
  on storage.objects for delete to authenticated
  using (bucket_id = 'tournament-media');
