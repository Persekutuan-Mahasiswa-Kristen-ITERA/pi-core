# ADR-0002: Organization admins — department & bureau heads hold `organization_admin`
- Status: accepted
- Date: 2026-10-15
- Deciders: owner (decided during PRD review) / agent (recorded)

## Context
`docs/ARCHITECTURE.md` §3 originally made only BPH (Ketua Umum, Sekjen, Sekum) `organization_admin`, with `super_admin` granted explicitly and not tied to a position. During PRD review (2026-10-15) the owner answered OQ-10: `super_admin` is held by the Kepala Divisi IT / Kepala Departemen CMIT plus a backup, and "make other departments also admin, but not super_admin".

## Options considered
1. Keep the original matrix (only BPH = `organization_admin`) — rejected: the owner wants department heads to be admins.
2. **All Kepala Departemen + Kepala Biro → `organization_admin`** (chosen) — the literal reading of "make other departments also admin".
3. Department-scoped admin (U scope) for heads — narrower; the existing `kepala_departemen` role already carries U-scoped powers.

## Decision
- `super_admin`: held by Kepala Divisi IT / Kepala Departemen CMIT plus one backup; granted explicitly (not tied to a position or period).
- `organization_admin`: in addition to BPH (Ketua Umum, Sekjen, Sekum), **all** Kepala Departemen and Kepala Biro also hold it.
- `organization_admin` remains barred from editing `super_admin` grants, roles and integrations (unchanged).

## Consequences
- Positive: department/bureau heads gain org-wide administrative capability (members, assignments, periods, org units, audit read) — matching the owner's stated governance intent.
- Negative/risk: `organization_admin` is **O-scoped (org-wide)**. This widens privileges for up to 8 people, including access to sensitive fields and the audit log. If the owner intended *department-scoped* admin, the matrix should instead add U-scoped create/deactivate for heads. **Flagged for owner confirmation.**
- Unchanged: deny-by-default, single `can()`, last-`super_admin` protection, audit on every grant change.

## Verification
- `docs/ARCHITECTURE.md` §3 updated. The RBAC seed (Phase 1 / Epic 2) must reflect this and its tests must cover allowed AND denied cases for both `organization_admin` and `kepala_departemen`.
