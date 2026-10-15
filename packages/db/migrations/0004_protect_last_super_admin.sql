-- FR-28: the last super_admin cannot be removed.
--
-- Enforced as a trigger rather than in application code so the rule is atomic and race-free: two
-- concurrent revokes cannot both observe "one other super_admin remains" and both succeed. The
-- rows are locked in a deterministic order first, so the pair cannot deadlock. Like the
-- append-only trigger on audit_logs, this binds every role including the table owner (a REVOKE
-- would not, because we reach Postgres as the owner through Hyperdrive).
CREATE OR REPLACE FUNCTION system_grants_protect_last_super_admin() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role_key = 'super_admin' THEN
    PERFORM 1 FROM system_grants WHERE role_key = 'super_admin' ORDER BY member_id FOR UPDATE;
    IF (SELECT count(*) FROM system_grants WHERE role_key = 'super_admin') <= 1 THEN
      RAISE EXCEPTION 'cannot remove the last super_admin (FR-28)'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER system_grants_protect_last_super_admin_trg
  BEFORE DELETE ON "system_grants"
  FOR EACH ROW EXECUTE FUNCTION system_grants_protect_last_super_admin();
