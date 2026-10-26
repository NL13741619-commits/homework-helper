-- Second-base theater data. Main-base auth IDs are verified by the Edge API.
create table if not exists public.dawn_theater_profiles (
 user_id uuid primary key, display_name text not null default '', bio text not null default '',
 preferences jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.dawn_theater_state (
 user_id uuid not null, video_id text not null check(video_id='big-buck-bunny'),
 saved boolean not null default false, liked boolean not null default false,
 position_seconds double precision not null default 0 check(position_seconds between 0 and 86400),
 duration_seconds double precision not null default 596.48, completed boolean not null default false,
 watched_at timestamptz, primary key(user_id,video_id)
);
create table if not exists public.dawn_theater_comments (
 id uuid primary key default gen_random_uuid(), video_id text not null check(video_id='big-buck-bunny'),
 user_id uuid not null, display_name text not null, body text not null check(length(body)<=1000),
 image_url text, parent_id uuid references public.dawn_theater_comments(id),
 created_at timestamptz not null default now(), check(length(body)>0 or image_url is not null)
);
create index if not exists dawn_theater_comments_video_time on public.dawn_theater_comments(video_id,created_at desc);
create index if not exists dawn_theater_comments_owner_time on public.dawn_theater_comments(user_id,created_at desc);
create index if not exists dawn_theater_comments_parent on public.dawn_theater_comments(parent_id);
create table if not exists public.dawn_theater_comment_likes (
 user_id uuid not null, comment_id uuid not null references public.dawn_theater_comments(id) on delete cascade,
 primary key(user_id,comment_id)
);
create index if not exists dawn_theater_comment_likes_comment on public.dawn_theater_comment_likes(comment_id);
create table if not exists public.dawn_theater_feedback (
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 body text not null check(length(body) between 1 and 2000), created_at timestamptz not null default now()
);
alter table public.dawn_theater_profiles enable row level security;
alter table public.dawn_theater_state enable row level security;
alter table public.dawn_theater_comments enable row level security;
alter table public.dawn_theater_comment_likes enable row level security;
alter table public.dawn_theater_feedback enable row level security;
-- Browser keys cannot query these tables. The API authenticates every private operation.
revoke all on public.dawn_theater_profiles, public.dawn_theater_state, public.dawn_theater_comments, public.dawn_theater_comment_likes, public.dawn_theater_feedback from anon, authenticated;
grant all on public.dawn_theater_profiles, public.dawn_theater_state, public.dawn_theater_comments, public.dawn_theater_comment_likes, public.dawn_theater_feedback to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('dawn-theater-comments','dawn-theater-comments',true,1048576,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
