-- Migración: Soporte de etapa en franjas horarias (Fase de Grupos vs Cuadro/Playoffs)
-- Permite configurar franjas dedicadas para grupos y para playoffs de forma secuencial.
-- En playoffs, las parejas clasificadas pueden jugar en todas las franjas de cuadro (disponibilidad 100%).

alter table public.time_slots
  add column if not exists stage text not null default 'group' check (stage in ('group', 'playoff'));

create index if not exists time_slots_tournament_stage_idx
  on public.time_slots (tournament_id, stage);

comment on column public.time_slots.stage is 'Etapa del torneo a la que pertenece la franja horaria: group (fase de grupos) o playoff (cuadro eliminatorio).';

