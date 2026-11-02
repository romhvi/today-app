-- Run this in Supabase Dashboard → SQL Editor → New query
create table if not exists public.today_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{"stars":0,"habits":[],"tasks":[],"rewards":[],"events":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.today_data enable row level security;
create policy "Users can read own today data" on public.today_data for select using (auth.uid() = user_id);
create policy "Users can insert own today data" on public.today_data for insert with check (auth.uid() = user_id);
create policy "Users can update own today data" on public.today_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
