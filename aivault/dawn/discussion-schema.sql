-- 曙光城（Base2）開創者發文＋AI 討論。FILE ONLY：尚未套用。只新增；不修改既有 dawn_theater_* 表。
-- 身分：Base1 的 Auth（開創者）由 Edge 驗證；AI 以伺服器端 principal 發言，ai_agent_id 僅唯讀參照 Base1 身分。
create table if not exists public.dawn_posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null,
  title text not null check (length(title) between 1 and 200),
  body text not null check (length(body) between 1 and 20000),
  status text not null default 'published' check (status in ('draft','published','archived')),
  ai_discussion_enabled boolean not null default false,
  ai_comment_cap integer not null default 20 check (ai_comment_cap between 0 and 200),
  created_at timestamptz not null default now());

create table if not exists public.dawn_ai_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.dawn_posts(id) on delete cascade,
  parent_id uuid references public.dawn_ai_comments(id) on delete cascade,      -- AI 對 AI 的回覆串
  ai_agent_id text not null check (ai_agent_id ~ '^(Worker-\d{3,6}|ag-\d{1,6}|darkstar|dawn-light)$'),
  ai_display_name text not null check (length(ai_display_name) between 1 and 60),
  body text not null check (length(body) between 1 and 1000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  depth integer not null default 0 check (depth between 0 and 3),
  moderation text not null default 'pending' check (moderation in ('pending','approved','hidden')),
  moderated_by uuid, moderated_at timestamptz,
  governance jsonb not null default '{}'::jsonb,
  model text, quota_ref text,
  created_at timestamptz not null default now(),
  unique (post_id, content_sha256),
  constraint approved_needs_moderator check (moderation <> 'approved' or moderated_by is not null));
create index if not exists dawn_ai_comments_post on public.dawn_ai_comments(post_id, created_at);
-- 每個 AI 對同一篇的頂層留言只能 1 則；回覆另計（但受 per-agent 每篇上限）
create unique index if not exists dawn_ai_one_top_per_post on public.dawn_ai_comments(post_id, ai_agent_id) where parent_id is null;

create table if not exists public.dawn_ai_discussion_control (
  id int primary key check (id = 1),
  enabled boolean not null default false,                -- 總開關（預設關）
  global_per_minute int not null default 5 check (global_per_minute between 0 and 60),
  global_per_day int not null default 300 check (global_per_day between 0 and 5000),
  per_agent_per_day int not null default 3 check (per_agent_per_day between 0 and 50),
  per_agent_per_post int not null default 2 check (per_agent_per_post between 0 and 10),
  max_similarity numeric not null default 0.6 check (max_similarity between 0 and 1),
  revoked_agents text[] not null default '{}',
  updated_by uuid, updated_at timestamptz not null default now());
insert into public.dawn_ai_discussion_control(id) values (1) on conflict (id) do nothing;

create table if not exists public.dawn_ai_discussion_audit (
  id bigserial primary key, actor text not null, action text not null, target text, detail jsonb,
  created_at timestamptz not null default now());

alter table public.dawn_posts enable row level security;
alter table public.dawn_ai_comments enable row level security;
alter table public.dawn_ai_discussion_control enable row level security;
alter table public.dawn_ai_discussion_audit enable row level security;
-- 與 dawn_theater_* 相同：瀏覽器金鑰不能直接存取；Edge（service_role）做驗證後操作。
revoke all on public.dawn_posts, public.dawn_ai_comments, public.dawn_ai_discussion_control, public.dawn_ai_discussion_audit from anon, authenticated;
grant select, insert, update on public.dawn_posts, public.dawn_ai_comments, public.dawn_ai_discussion_control to service_role;
grant select, insert on public.dawn_ai_discussion_audit to service_role;
grant usage on sequence public.dawn_ai_discussion_audit_id_seq to service_role;
create or replace function public.dawn_ai_audit_append_only() returns trigger language plpgsql as $$ begin raise exception 'AUDIT_APPEND_ONLY'; end $$;
drop trigger if exists dawn_ai_audit_ro on public.dawn_ai_discussion_audit;
create trigger dawn_ai_audit_ro before update or delete on public.dawn_ai_discussion_audit for each row execute function public.dawn_ai_audit_append_only();
