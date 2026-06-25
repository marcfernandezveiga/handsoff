-- Hands Off: schema for jobs and events tables
-- Service role bypasses RLS; all server writes go through createServiceClient()

-- Jobs: one row per r/forhire post the scout finds
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

-- Learnings: one row per human approve/reject decision — the training signal store
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

-- RLS: enable on both tables; service role bypasses automatically
alter table jobs      enable row level security;
alter table events    enable row level security;
alter table learnings enable row level security;

-- No policies needed: service role key bypasses RLS entirely.
-- If you ever need anon/authenticated reads, add policies here.

-- Seed: 3 realistic r/forhire-style jobs so the dashboard has content immediately
insert into jobs (source_url, title, body, budget_text, status, reasoning, deliverable, fee_cents)
values
  (
    'https://www.reddit.com/r/forhire/comments/seed001/hiring_need_short_product_description_written',
    '[HIRING] Need a short product description written for my SaaS landing page',
    'I launched a time-tracking SaaS for freelancers last week and the copy on my homepage is terrible. I need one punchy paragraph (80-100 words) describing the product for the hero section. Straightforward, no jargon. Budget: $15. Turnaround: today.',
    '$15',
    'awaiting_approval',
    'Short copywriting task. AI can write polished landing page copy from a product description. Deliverable is a single paragraph, no research needed. Low risk, high confidence.',
    E'Track every billable minute without breaking your flow. [ProductName] runs quietly in the background, automatically logging time across projects so you always know where your hours went. At the end of the week, export a clean invoice in one click. Built for freelancers who bill by the hour and have better things to do than fill in spreadsheets.',
    1500
  ),
  (
    'https://www.reddit.com/r/forhire/comments/seed002/hiring_write_5_tweet_thread_about_productivity',
    '[HIRING] Write a 5-tweet thread about productivity for solopreneurs',
    'I run a newsletter about solopreneur productivity and want a Twitter/X thread I can post this week. Topic: how to do deep work when you work from home with kids. 5 tweets, punchy, practical, no fluff. Budget $20.',
    '$20',
    'approved',
    'Short-form writing task perfectly suited for AI. Thread format, clear topic, no proprietary knowledge required. Confident this can be delivered to a high standard.',
    E'1/ The hardest part of deep work when you have kids at home isn\'t the interruptions. It\'s the mental overhead of knowing they might interrupt.\n\n2/ Fix it with a signal, not a schedule. A closed door, a specific lamp, a pair of headphones. Kids learn the signal faster than you think.\n\n3/ Work in 45-min blocks, not 2-hour marathons. You can defend 45 minutes. You can\'t defend your whole morning.\n\n4/ Front-load your hardest work before 9am. Not because of circadian rhythms. Because the house is quieter and your brain hasn\'t taken on anyone else\'s problems yet.\n\n5/ The goal isn\'t zero interruptions. It\'s predictable ones. A 10am snack break that you choose beats three random ones that choose you.',
    2000
  ),
  (
    'https://www.reddit.com/r/forhire/comments/seed003/hiring_proofread_my_cover_letter',
    '[HIRING] Proofread and lightly rewrite my cover letter for a product manager role',
    'Applying for a PM role at a fintech startup. My cover letter is ~300 words and needs a native English speaker to clean up the phrasing and make it sound more confident. Not a full rewrite, just polish. Budget $10, quick turnaround needed.',
    '$10',
    'charged',
    'Proofreading and light rewriting is a core AI capability. 300-word document, clear output format, no specialist domain knowledge needed.',
    E'Dear Hiring Team,\n\nI am applying for the Product Manager role because I have spent the last three years sitting exactly at the intersection your job description describes: between engineering teams who want clear requirements and users who want problems solved, not features shipped.\n\nAt [Previous Company], I led the redesign of our onboarding flow, cutting time-to-first-value from 11 days to 3. I did it not by adding features, but by removing the five steps that confused new users most. That instinct, to simplify before building, is how I approach every product decision.\n\nFintech moves fast and the margin for trust mistakes is zero. I understand that, and I have the compliance and stakeholder communication experience to work within those constraints without slowing the team down.\n\nI would welcome a conversation about how I can bring that same clarity-first approach to your team.\n\nBest regards,\n[Name]',
    1000
  )
on conflict (source_url) do nothing;

-- Seed matching events for the seeded jobs
insert into events (agent, action, detail, job_id)
select 'scout', 'found', 'Discovered [HIRING] post from r/forhire seed data', id
from jobs where source_url like '%seed00%'
on conflict do nothing;

insert into events (agent, action, detail, job_id)
select 'worker', 'fulfilled', 'Drafted deliverable and set fee. Status: awaiting_approval.', id
from jobs where source_url like '%seed00%'
on conflict do nothing;

insert into events (agent, action, detail, job_id)
select 'finance', 'charged', 'PayPal sandbox invoice created. Job marked charged.', id
from jobs where source_url = 'https://www.reddit.com/r/forhire/comments/seed003/hiring_proofread_my_cover_letter'
on conflict do nothing;
