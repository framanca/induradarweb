-- WebHMI audit: separate login events from compilation attempts.
-- All writes occur on the server with the service-role key; never expose IPs to clients.
create table if not exists public.webhmi_access_audit (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  user_type text not null check (user_type in ('guest','registered','unknown')),
  ip inet,
  result text not null check (result in ('success','error')),
  version text not null,
  http_status integer
);
alter table public.webhmi_access_audit enable row level security;
revoke all on table public.webhmi_access_audit from public, anon, authenticated;
grant select, insert on table public.webhmi_access_audit to service_role;
grant usage, select on sequence public.webhmi_access_audit_id_seq to service_role;
create index if not exists webhmi_access_audit_created_at_idx on public.webhmi_access_audit (created_at desc);
create index if not exists webhmi_access_audit_user_idx on public.webhmi_access_audit (user_id, created_at desc);

alter table public.webhmi_compilation_audit add column if not exists user_type text;
alter table public.webhmi_compilation_audit add column if not exists export_variant text;
alter table public.webhmi_compilation_audit add column if not exists project_name text;
alter table public.webhmi_compilation_audit add column if not exists project_sha256 text;
alter table public.webhmi_compilation_audit add column if not exists project_bytes integer;
alter table public.webhmi_compilation_audit add column if not exists project_screen_count integer;
alter table public.webhmi_compilation_audit add column if not exists project_variable_count integer;
alter table public.webhmi_compilation_audit enable row level security;
revoke all on table public.webhmi_compilation_audit from anon, authenticated;
grant select, insert on table public.webhmi_compilation_audit to service_role;
create index if not exists webhmi_compilation_audit_user_idx on public.webhmi_compilation_audit (user_id, created_at desc);
create index if not exists webhmi_compilation_audit_project_idx on public.webhmi_compilation_audit (project_sha256);
