-- Table privileges for Supabase's API roles.
-- Newer Supabase projects don't grant these automatically. Row Level Security (0001_schema.sql)
-- still decides which rows each person can see or change; these grants only open the door.

grant usage on schema public to anon, authenticated, service_role;

-- Visitors (not signed in): read the menu and opening settings only.
grant select on settings, service_categories, services, service_variants to anon;

-- Signed-in users: RLS policies limit them to their own rows (customers), assigned rows (staff)
-- or everything (admin). Tables without an insert/update policy stay read-only.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Server (secret key): used only by the website's API routes after checking permissions.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Keep the same rules for tables created later.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
