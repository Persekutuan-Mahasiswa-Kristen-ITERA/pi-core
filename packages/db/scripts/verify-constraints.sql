-- Constraint verification for story 2.3 (periods / positions / assignments).
-- Every check runs inside the surrounding transaction, which is ROLLED BACK at the end, so the
-- database is left untouched. Run with:
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f packages/db/scripts/verify-constraints.sql

BEGIN;

INSERT INTO org_units (id, parent_id, type, name, slug) VALUES
  ('00000000-0000-0000-0000-00000000e001', NULL, 'organization', 'Test Root', 'test-root');
INSERT INTO org_units (id, parent_id, type, name, slug) VALUES
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000e001', 'division',   'Div A',  'div-a'),
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-00000000e001', 'division',   'Div B',  'div-b'),
  ('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-00000000e001', 'department', 'Dept A', 'dept-a');

INSERT INTO members (id, email, full_name) VALUES
  ('00000000-0000-0000-0000-00000000f001', 'constraint-a@itera.ac.id', 'Constraint A'),
  ('00000000-0000-0000-0000-00000000f002', 'constraint-b@itera.ac.id', 'Constraint B');

INSERT INTO positions (id, key, name, unit_type, rank, is_unique_per_unit) VALUES
  ('00000000-0000-0000-0000-00000000d001', 'test_kepala_divisi', 'Kepala Divisi', 'division', 60, true),
  ('00000000-0000-0000-0000-00000000d002', 'test_staff',         'Staff',         'division', 70, false);

INSERT INTO periods (id, label, start_date, end_date, is_active) VALUES
  ('00000000-0000-0000-0000-00000000c001', 'test-2025/2026', '2025-08-01', '2026-07-31', true);

\echo '--- check 1: a second ACTIVE period is rejected ---'
DO $$
BEGIN
  INSERT INTO periods (label, start_date, end_date, is_active)
  VALUES ('test-2026/2027', '2026-08-01', '2027-07-31', true);
  RAISE EXCEPTION 'FAIL: second active period was accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS: second active period rejected (periods_single_active_uq)';
END $$;

\echo '--- check 2: a valid assignment is accepted and the trigger fills derived columns ---'
INSERT INTO assignments (member_id, org_unit_id, position_id, period_id)
VALUES ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e002',
        '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001');
DO $$
DECLARE r record;
BEGIN
  SELECT unit_type, is_unique_per_unit INTO r FROM assignments
   WHERE member_id = '00000000-0000-0000-0000-00000000f001';
  IF r.unit_type = 'division' AND r.is_unique_per_unit THEN
    RAISE NOTICE 'PASS: derived columns filled from position (unit_type=%, is_unique_per_unit=%)',
      r.unit_type, r.is_unique_per_unit;
  ELSE
    RAISE EXCEPTION 'FAIL: derived columns wrong (%, %)', r.unit_type, r.is_unique_per_unit;
  END IF;
END $$;

\echo '--- check 3: a second holder of a UNIQUE-PER-UNIT position in the same unit+period is rejected ---'
DO $$
BEGIN
  INSERT INTO assignments (member_id, org_unit_id, position_id, period_id)
  VALUES ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000e002',
          '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001');
  RAISE EXCEPTION 'FAIL: second Kepala Divisi in the same unit/period was accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS: second unique-per-unit holder rejected (assignments_unique_per_unit_uq)';
END $$;

\echo '--- check 4: the SAME unique-per-unit position in a DIFFERENT unit is allowed ---'
INSERT INTO assignments (member_id, org_unit_id, position_id, period_id)
VALUES ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000e003',
        '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001');
\echo 'PASS: Kepala Divisi in Div B accepted (different unit)'

\echo '--- check 5: duplicate (member, unit, position, period) is rejected ---'
DO $$
BEGIN
  INSERT INTO assignments (member_id, org_unit_id, position_id, period_id)
  VALUES ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e002',
          '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001');
  RAISE EXCEPTION 'FAIL: duplicate assignment was accepted';
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'PASS: duplicate assignment rejected (assignments_member_unit_position_period_uq)';
END $$;

\echo '--- check 6: org_unit.type <> position.unit_type is rejected ---'
DO $$
BEGIN
  INSERT INTO assignments (member_id, org_unit_id, position_id, period_id)
  VALUES ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000e004',
          '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000c001');
  RAISE EXCEPTION 'FAIL: division position on a department unit was accepted';
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE 'PASS: unit type mismatch rejected (assignments_org_unit_type_fk)';
END $$;

\echo '--- check 7: a NON-unique position can be held by two members in one unit+period ---'
INSERT INTO assignments (member_id, org_unit_id, position_id, period_id)
VALUES ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e002',
        '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000c001');
INSERT INTO assignments (member_id, org_unit_id, position_id, period_id)
VALUES ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000e002',
        '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000c001');
\echo 'PASS: two Staff in the same unit/period accepted'

ROLLBACK;
\echo '--- rolled back; database untouched ---'
