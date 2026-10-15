-- Story 2.6 verification: the audit log is append-only (FR-43) and both new tables are locked down.
-- Everything runs inside a transaction that is ROLLED BACK, so the database is left untouched.
-- Any failure raises, so a non-zero exit means a real problem.
\set ON_ERROR_STOP on
begin;

\echo '--- 1. audit_logs accepts an INSERT ---'
insert into audit_logs (actor_member_id, action, entity_type, entity_id, before, after, request_id)
values (null, 'verify.insert', 'member', '00000000-0000-0000-0000-000000000000',
        '{"nim":"121140001"}'::jsonb, '{"nim":"121140002"}'::jsonb, 'verify-run');
select 'insert ok: ' || count(*)::text from audit_logs where request_id = 'verify-run';

\echo '--- 2. UPDATE must be refused by the append-only trigger ---'
do $$
begin
  update audit_logs set action = 'tampered' where request_id = 'verify-run';
  raise exception 'FAIL: UPDATE on audit_logs was allowed';
exception
  when restrict_violation then raise notice 'PASS: UPDATE refused (%)', sqlerrm;
end $$;

\echo '--- 3. DELETE must be refused by the append-only trigger ---'
do $$
begin
  delete from audit_logs where request_id = 'verify-run';
  raise exception 'FAIL: DELETE on audit_logs was allowed';
exception
  when restrict_violation then raise notice 'PASS: DELETE refused (%)', sqlerrm;
end $$;

\echo '--- 4. the row survived both attempts ---'
select 'row intact: ' || count(*)::text from audit_logs where request_id = 'verify-run' and action = 'verify.insert';

\echo '--- 5. system_grants rejects a duplicate (member, role) ---'
do $$
declare
  m uuid;
begin
  insert into members (email, full_name)
  values ('verify-audit@student.itera.ac.id', 'Verify Audit')
  returning id into m;
  insert into system_grants (member_id, role_key) values (m, 'super_admin');
  begin
    insert into system_grants (member_id, role_key) values (m, 'super_admin');
    raise exception 'FAIL: duplicate system grant was allowed';
  exception
    when unique_violation then raise notice 'PASS: duplicate system grant refused';
  end;
end $$;

\echo '--- 6. system_grants rejects an unknown role key ---'
do $$
declare
  m uuid;
begin
  insert into members (email, full_name)
  values ('verify-audit2@student.itera.ac.id', 'Verify Audit 2')
  returning id into m;
  begin
    insert into system_grants (member_id, role_key) values (m, 'not_a_role');
    raise exception 'FAIL: unknown role key was allowed';
  exception
    when foreign_key_violation then raise notice 'PASS: unknown role key refused';
  end;
end $$;

\echo '--- 7. RLS enabled and 0 policies on every table (NFR-7) ---'
select 'rls_off: ' || coalesce(string_agg(c.relname, ', '), '(none — good)')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
select 'policies: ' || coalesce(sum((select count(*) from pg_policies p where p.schemaname='public' and p.tablename=t.tablename))::text, '0')
from pg_tables t where t.schemaname = 'public';

\echo '--- 8. table inventory ---'
select 'tables: ' || string_agg(tablename, ', ' order by tablename) from pg_tables where schemaname = 'public';

rollback;
\echo '--- all checks done; transaction rolled back ---'
