-- Outflow database setup
-- Paste all of this into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once: it only creates what is missing.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- categories
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null,
  icon       text,
  color      text,
  sort       int  not null default 100,
  created_at timestamptz not null default now()
);
create unique index if not exists categories_user_name on public.categories (user_id, name);
-- Monthly bill (true/false). Empty means the default: Bills & phone, Subscriptions, Fees and Education are monthly bills.
alter table public.categories add column if not exists fixed boolean;

-- -------------------------------------------------------------- transactions
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date            date not null,                 -- purchase date; decides the month
  description     text not null,                 -- as printed on the statement (or what you typed)
  merchant        text,                          -- cleaned shop name, e.g. "Winners"
  amount          numeric(12,2) not null,        -- what counts: purchases +, refunds -
  original_amount numeric(12,2),                 -- statement amount (differs for Chexy: $814 charge, $14 counts)
  my_share        numeric(12,2),                 -- "paid for others": if set, only this counts
  category        text not null default 'Other',
  kind            text not null default 'purchase', -- purchase | refund | fee | chexy_fee | manual
  source          text not null default 'manual',   -- amex | cibc | rbc | neo | manual | (later: applepay)
  note            text,
  fingerprint     text,                          -- statement line id; stops the same line being saved twice
  deleted         boolean not null default false, -- deleted lines are hidden but remembered, so re-imports skip them
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists transactions_user_fingerprint on public.transactions (user_id, fingerprint);
create index if not exists transactions_user_date on public.transactions (user_id, date);

-- ------------------------------------------------- "always do this for this shop"
create table if not exists public.merchant_rules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  merchant_key text not null,
  category     text not null,
  created_at   timestamptz not null default now()
);
create unique index if not exists merchant_rules_user_key on public.merchant_rules (user_id, merchant_key);

-- --------------------------------------------------------- instalment plans
-- A reminder list only: plan purchases already count in full in the month you bought them.
create table if not exists public.instalment_plans (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null,
  monthly_amount numeric(12,2) not null,
  start_month    text not null,   -- 'YYYY-MM' of the first payment
  total_months   int  not null,
  created_at     timestamptz not null default now()
);

-- ------------------------------------------------- row-level security
-- Each signed-in user can only see and change their own rows.
do $$
declare t text;
begin
  foreach t in array array['categories','transactions','merchant_rules','instalment_plans'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Keep updated_at current
create or replace function public.outflow_touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists transactions_touch on public.transactions;
create trigger transactions_touch before update on public.transactions
  for each row execute function public.outflow_touch();
