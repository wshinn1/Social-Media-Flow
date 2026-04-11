-- Run this in your Supabase SQL editor to set up the leads table

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  first_name text,
  last_name text,
  email text not null,
  phone text,
  appointment_date text,
  budget text,
  fb_leadgen_id text unique,
  fb_page_id text
);

-- Enable Row Level Security
alter table public.leads enable row level security;

-- Allow authenticated users (admin) to read all leads
create policy "Authenticated users can read leads"
  on public.leads
  for select
  using (auth.role() = 'authenticated');

-- Only service role can insert (webhook uses service role key)
create policy "Service role can insert leads"
  on public.leads
  for insert
  with check (true);
