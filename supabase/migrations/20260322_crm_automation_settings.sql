-- crm_automation_settings
-- Single-row settings table for automation sending rules.
-- Row id = 1 is the singleton; UI always upserts id = 1.

create table if not exists crm_automation_settings (
  id             integer primary key default 1 check (id = 1),  -- singleton guard
  is_enabled     boolean              not null default true,
  batch_limit    integer              not null default 3  check (batch_limit  between 1 and 50),
  daily_cap      integer              not null default 10 check (daily_cap    between 1 and 500),
  lunch_window   text                 not null default '11:00-14:00',
  dinner_window  text                 not null default '18:00-22:00',
  timezone       text                 not null default 'America/Sao_Paulo',
  updated_at     timestamptz          not null default now()
);

-- Seed the singleton row so GET always returns data
insert into crm_automation_settings (id) values (1)
  on conflict (id) do nothing;
