-- PROPOSED ONLY — do not apply without explicit approval.
-- Base 2: svtkpdmqemidlasowqew
-- Off switch is application-level (DAWN_TOWN_OFF); tables can remain empty.

create table if not exists public.dawn_town_buildings (
  id text primary key,
  title text not null,
  href text,
  status text not null default 'PLAN',
  sort int not null default 0
);

create table if not exists public.dawn_town_presence (
  user_id uuid primary key,
  display_name text,
  status text not null check (status in ('outside','inside','exiting','in_transit')),
  building_id text references public.dawn_town_buildings(id),
  agent_id text,
  entered_at timestamptz,
  updated_at timestamptz not null default now(),
  transfer_id uuid
);

create table if not exists public.dawn_town_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agent_id text,
  direction text not null check (direction in ('in','out')),
  state text not null check (state in ('pending','committed','acked','failed')),
  ticket_nonce text unique,
  base1_ack_at timestamptz,
  quota_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS policies to be written on apply; not enabled here.
