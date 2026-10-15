/**
 * The one place authorization is decided (`docs/ARCHITECTURE.md` §3: "Permissions are checked
 * server-side through one function `can(actor, permission, target?)` in `packages/shared` (pure,
 * unit-tested)").
 *
 * It is **pure**: no I/O, no clock, no globals — so every matrix cell can be tested directly.
 * Loading the actor (roles, unit scope, ranks) and, later, a database-edited matrix is the
 * caller's job (story 2.6).
 *
 * Rules:
 *  - **Deny by default.** An unknown permission, or one no role grants, is denied.
 *  - `O` — organization-wide: allowed regardless of target.
 *  - `S` — self only: allowed only when the target *is* the actor.
 *  - `U` — the holder's own unit subtree: allowed only when the target names an org unit inside
 *    `actor.unitScope`.
 *  - `U*` rank guard (§3 footnote): `assignment:manage` at `U` scope additionally requires the
 *    target assignment's position `rank` to be **strictly greater** (more junior) than the actor's
 *    own highest rank in that unit. Held at `O` scope (super_admin/organization_admin) there is no
 *    rank limit.
 */
import { isPermissionKey, type PermissionKey } from "./permissions";
import {
  DEFAULT_MATRIX,
  SCOPE_BREADTH,
  type PermissionMatrix,
  type RoleKey,
  type Scope,
} from "./matrix";

/** Permissions that carry the §3 `U*` rank guard when held at `U` scope. */
const RANK_GUARDED: ReadonlySet<PermissionKey> = new Set<PermissionKey>(["assignment:manage"]);

/** Who is asking. Story 2.6 builds this from the active period's assignments. */
export interface Actor {
  /** The member the actor is; used to resolve self-scoped targets. */
  memberId: string;
  /** Role keys the actor effectively holds (`position_roles` + system grants + implicit `anggota`). */
  roles: readonly RoleKey[];
  /** Org unit ids the actor's `U` scope covers: their own unit and its descendants. */
  unitScope?: readonly string[];
  /**
   * The actor's own highest position `rank` per in-scope unit. Lower numbers are more senior
   * (Ketua Umum 10 … Staff 70), so the guard requires `target.positionRank > this`.
   */
  highestRankByUnit?: Readonly<Record<string, number>>;
}

/** What the action is aimed at. Omitted means an organization-wide question. */
export type Target =
  | { kind: "self" }
  | { kind: "org" }
  | { kind: "unit"; orgUnitId: string }
  | { kind: "member"; memberId: string; orgUnitId?: string | null }
  | { kind: "assignment"; orgUnitId: string; positionRank: number };

/**
 * The broadest scope `actor` holds `permission` at, or `undefined` when they hold it nowhere.
 * Useful for UI affordances ("show the edit button?"), never as the authorization decision.
 */
export function scopeFor(
  actor: Actor,
  permission: PermissionKey,
  matrix: PermissionMatrix = DEFAULT_MATRIX,
): Scope | undefined {
  let best: Scope | undefined;
  for (const role of actor.roles) {
    const scope = matrix.get(role)?.get(permission);
    if (scope && (best === undefined || SCOPE_BREADTH[scope] > SCOPE_BREADTH[best])) {
      best = scope;
    }
  }
  return best;
}

function isSelfTarget(actor: Actor, target: Target | undefined): boolean {
  if (!target) return false;
  if (target.kind === "self") return true;
  return target.kind === "member" && target.memberId === actor.memberId;
}

function targetUnitId(target: Target | undefined): string | undefined {
  if (!target) return undefined;
  switch (target.kind) {
    case "unit":
    case "assignment":
      return target.orgUnitId;
    case "member":
      return target.orgUnitId ?? undefined;
    default:
      return undefined;
  }
}

/**
 * Is `permission` allowed for `actor` on `target`?
 *
 * `matrix` defaults to the seeded §3 matrix; pass a database-loaded one once role/permission
 * mappings become editable (custom roles, `permission-mapping:manage`).
 */
export function can(
  actor: Actor,
  permission: PermissionKey,
  target?: Target,
  matrix: PermissionMatrix = DEFAULT_MATRIX,
): boolean {
  if (!isPermissionKey(permission)) return false;

  const scope = scopeFor(actor, permission, matrix);
  if (scope === undefined) return false;

  if (scope === "O") return true;
  if (scope === "S") return isSelfTarget(actor, target);

  // scope === "U": the target must sit inside the actor's own subtree.
  const unitId = targetUnitId(target);
  if (unitId === undefined || !actor.unitScope?.includes(unitId)) return false;

  if (RANK_GUARDED.has(permission)) {
    // §3 footnote: only strictly more junior positions, and only where we know the actor's rank.
    if (target?.kind !== "assignment") return false;
    const ownRank = actor.highestRankByUnit?.[unitId];
    if (ownRank === undefined || !(target.positionRank > ownRank)) return false;
  }

  return true;
}
