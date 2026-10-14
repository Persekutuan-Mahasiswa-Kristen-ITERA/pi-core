---
name: rbac-permissions
description: Use when adding or changing roles, positions, permissions, scope rules (organization/unit/self), the can() function, authorization middleware, or any endpoint or screen that depends on who the user is. Load before writing any endpoint that reads or mutates member, assignment, period, role, or integration data.
---

# RBAC & permissions skill

Source of truth: `docs/ARCHITECTURE.md` section 3. Code of truth: `packages/shared` (permission catalog, role seeds, `can()`).

## Model recap
Member -> assignments (unit x position x period) -> `position_roles` -> roles -> permissions with scope O/U/S. Only the **active period** counts. `super_admin` comes from `system_grants`.

## Rules
1. One pure function `can(actor, permission, target?)`; actor context is built once per request from the DB (active-period assignments + grants) and cached only within the request.
2. Every route handler: authenticate -> build actor -> `can(...)` -> then data access. A route with no check must fail a repo-level test.
3. Scope U must be enforced **in the SQL query** (subtree filter), not by filtering in memory. Target-based checks (e.g., editing one assignment) also verify the target's unit is inside the actor's subtree.
4. Rank rule: U-scoped `assignment:manage` can only touch positions strictly more junior than the actor's own in that subtree.
5. Never trust roles/permissions from the client or from tokens issued to other apps; recompute server-side.
6. Adding a permission = update catalog + default matrix + migration/seed + tests + `docs/ARCHITECTURE.md` matrix + (if UI) hide/disable affordances (cosmetic only).
7. Changing the matrix or position->role mapping is an architectural change: write an ADR and ask the owner.

## Required tests (per permission added/changed)
- Allowed case for each role that should have it, **denied** case for each that should not, for O, U (inside and outside subtree) and S.
- Period switch: access changes after activating another period; ended assignments grant nothing.
- Escalation attempts: self-grant, assigning a senior position, removing the last super_admin.

## Output
Report the final matrix diff and the test names covering it.
