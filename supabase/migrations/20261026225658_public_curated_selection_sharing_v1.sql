-- Public copies are separate from immutable, account-authorized source reports.
-- The owner explicitly inserts reviewed light documents; API clients cannot write.
create table public.curated_report_publications_v1 (
  report_reference text primary key
    check (report_reference ~ '^IR-[0-9]{8}-[0-9A-HJKMNP-TV-Z]{6}$'),
  document jsonb not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  constraint curated_public_document_matches_reference check (coalesce(
    document ?& array['found','report_reference','report_kind','payload']
    and document->>'found' = 'true'
    and document->>'report_reference' = report_reference
    and document->>'report_kind' = 'curated_selection'
    and document->'payload'->>'report_reference' = report_reference
    and document->'payload'->>'report_schema_version' = 'curated-selection-light-1.0.0',
    false
  ))
);
alter table public.curated_report_publications_v1 enable row level security;
revoke all on public.curated_report_publications_v1 from public, anon, authenticated;
grant select (report_reference, document) on public.curated_report_publications_v1 to anon, authenticated;
grant all on public.curated_report_publications_v1 to service_role;
create policy read_explicit_public_curated_documents
  on public.curated_report_publications_v1 for select to anon, authenticated
  using (is_public);
comment on table public.curated_report_publications_v1 is
  'Reviewed light-report public snapshots only. Revocation: set is_public=false. Private source reports retain account authorization.';
