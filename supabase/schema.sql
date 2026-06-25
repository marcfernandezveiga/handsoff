-- Hands Off: schema for jobs and events tables
-- Service role bypasses RLS; all server writes go through createServiceClient()

-- Jobs: one row per company the Modal agent finds via Companies House
create table if not exists jobs (
  id           uuid primary key default gen_random_uuid(),
  source       text not null default 'reddit',
  source_url   text not null unique,
  title        text not null,
  body         text not null default '',
  budget_text  text,
  status       text not null default 'found'
                 check (status in ('found','skipped','awaiting_approval','approved','charged')),
  reasoning    text,
  deliverable  text,
  fee_cents    integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists jobs_status_idx      on jobs(status);
create index if not exists jobs_created_at_idx  on jobs(created_at desc);
create index if not exists jobs_source_url_idx  on jobs(source_url);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_updated_at on jobs;
create trigger jobs_updated_at
  before update on jobs
  for each row execute function update_updated_at();

-- Events: glass-box audit log; every agent action appends a row
create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  agent      text not null
               check (agent in ('scout','worker','finance','manager')),
  action     text not null,
  detail     text,
  job_id     uuid references jobs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists events_created_at_idx on events(created_at desc);
create index if not exists events_job_id_idx     on events(job_id);

-- Learnings: one row per signal from the autonomous loop
create table if not exists learnings (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid references jobs(id) on delete set null,
  category   text not null,
  signal     text not null check (signal in ('approved', 'rejected')),
  fee_cents  integer not null default 300,
  created_at timestamptz not null default now()
);

create index if not exists learnings_category_idx    on learnings(category);
create index if not exists learnings_created_at_idx  on learnings(created_at desc);

-- RLS: enable on all tables; service role bypasses automatically
alter table jobs      enable row level security;
alter table events    enable row level security;
alter table learnings enable row level security;

-- No policies needed: service role key bypasses RLS entirely.
-- If you ever need anon/authenticated reads, add policies here.
