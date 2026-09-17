-- Explicitly deny Data API access. The table is read only by the narrowly
-- scoped SECURITY DEFINER authorization helper.

begin;

create policy platform_admin_users_no_client_access on public.platform_admin_users
as restrictive
for all to authenticated
using (false)
with check (false);

commit;
