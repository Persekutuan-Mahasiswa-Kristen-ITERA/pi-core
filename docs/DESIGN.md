# DESIGN — PI-CORE

Source of truth: Figma file **PMK-CORE** — https://www.figma.com/design/18T2e8GH2l2zTzn7vkP1ax/PMK-CORE?node-id=0-1
(file key `18T2e8GH2l2zTzn7vkP1ax`). The Figma prototype is **mobile-only** (phone frames). Always read Figma through the Figma MCP before building a screen
(see skill `figma-to-code`). Values previously marked *(approx.)* were replaced on 2026-10-15 with exact values read from Figma via the MCP (see Tokens below).

## Identity
Brand: Persekutuan Mahasiswa Kristen ITERA (logo: cross inside heart, alpha/omega, circular badge). Warm, calm, church-organization feel. Greeting: "Shalom, {name}!".
Logo asset: export from Figma (do not recreate). Used on Login header and Settings.

## Tokens — **verified from Figma** (2026-10-15, file `18T2e8GH2l2zTzn7vkP1ax`, page `0:1`)

Read via the Figma MCP (`get_design_context`). The file uses **no Figma variables/styles** (raw values), so these are the exact hexes.

### Color
- **Brown — primary / login header / buttons:** `#5A3E1B` (login header = `rgba(90,62,27,0.9)`, i.e. `#5A3E1B` at 90%)
- **Brown — dashboard header:** `#924603` (curved header on Dashboard)
- **Gold — drawer background:** `#E6C65C`
- **Cream — page/app background:** `#F8F7F6`
- **Warm tint — cards, list rows, search, chips, "Create Member" button:** `rgba(161,89,18,0.1)` (≈ `#F2E6D9` over cream)
- **Warm border:** `rgba(161,89,18,0.1)` (subtle) and `rgba(161,89,18,0.2)` (stronger / focused)
- **Accent — icons, active nav/tab, links:** `#A15912`
- **Text:** heading `#0F172A`; secondary heading `#1E293B`; body `#475569`; muted/labels `#64748B`; on-login heading `#2A1E09`; M3 on-surface `#1D1B20`
- **Deltas:** positive `#059669`; negative `#E11D48`
- **On brown:** `#FFFFFF`

### Typography
- **Manrope** — all UI text (Bold 700, SemiBold 600, Medium 500, Regular 400). Sizes: 24px (Dashboard title) / 18px (screen titles, drawer items, tabs) / 14px (body, inputs) / 12px (small, nav labels) / 11px (filter/meta).
- **Poppins** (Regular) — wide-tracked "LOGIN" wordmark (24px, tracking 5.76px) and the login org title (20px, tracking 1.4px).
- **Inter** (Regular) — login form fields/labels/button text (12px).
- Tracking: screen titles/drawer `-0.45px`; nav labels `0.3px`; "Welcome Back" uppercase `0.7px`. Line heights: nav labels 18px; drawer items 22.5px; body 21px; titles 22.5–32px.

### Shape / radius
- Phone frame `40px`; header curve `border-bottom-left-radius: 124px`; cards / list rows / inputs `12px`; small `8px`; pills/buttons `30px`–`9999px`.

### Elevation
- Phone frame `0 4px 4px rgba(0,0,0,0.25)`
- Curved header `1px 7px 8px 5px rgba(110,57,16,0.25)` + inset `29px 7px 20px -7px rgba(0,0,0,0.25)` (login) / `inset 45px 7px 20px -7px rgba(0,0,0,0.25)` (dashboard)
- App container `0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)`
- Card `0 1px 2px rgba(0,0,0,0.05)` / `0 1px 1px rgba(0,0,0,0.05)`
- Login input `4px 4px 4px rgba(0,0,0,0.25)`

### Spacing
- ~8px grid; common gaps 4 / 8 / 12 / 19px; screen padding 16px; card padding 17–21px.

Implement tokens once: CSS variables + Tailwind theme (web) and a TS token object (mobile). Do not hardcode hex values in components.

## Layout patterns (mobile)
- Top bar: hamburger (left), centered screen title, notification bell (right).
- Bottom nav (4 tabs): Home, Directory, Reports, Profile. Active tab uses the accent color.
- Drawer (gold): Dashboard, Members, Roles, Periods, Assignments, Integrations, Setting.
- Directory has top tabs: Members | Roles | Periods.
- Cards on cream background; list rows are rounded tinted pills.

## Screen inventory (verified via Figma MCP, 2026-10-15 — page `0:1`)
| Screen | Figma node | Content | Notes |
|---|---|---|---|
| Login | `22:38` (Android Large - 1) | Brown curved header (299px, bottom-left radius 124px) with logo + org title; email/password fields; LOG IN; "Log in with Google" | See deviation D1 |
| Dashboard | `32:6` (Android Large - 2) | Brown curved header (`#924603`) "Welcome Back / Admin Portal"; stat cards (Total Members, Active Period, Available Roles) with deltas (+5% green / -1% red); Quick Access | See D4; Events deferred |
| Members | `82:508` (Android Large - 3) | Top tabs Members\|Roles\|Periods; search; Filter Period / Filter Role; "Create Member"; rows name/role/period + edit/delete | Delete = soft-delete with confirmation |
| — (empty frame) | `88:612` (Android Large - 4) | Only a Navigation Bar + 4 icon labels; no content | The frame DESIGN.md called "page 8 empty" — Create/Edit Member must be designed (see below) |
| Roles (list) | `88:613` (Mobile Container Wrapper) | "Create Role"; role cards (BPH, KEPALA DEPARTEMEN, SEKERTARIS, BENDAHARA, STAFF, PANITIA) with Total Members | System roles locked (D3) |
| Role detail | `88:709` (Mobile Container Wrapper) | Role name; member list with position; Total Members; Edit Role; Delete Role | D3 |
| Periods | `99:785` (Android Large - 5) | List 2026/2027 Active, 2025/2026 Set Active, … Edit; "Create Period" | One active period only |
| Assignments | `123:226` (Android Large - 8) | Form: Assign Member, Role, Position, Period + Save; rows user/role/position/period | See D2 |
| Integrations | `120:152` (Android Large - 7) | Cards PMK NEXUS (Connected), FINANCE (Not Connnected), NOTULENSI (Not Connected), PANITIA (Connected), INVENTORY (Connected) | Meaning per ARCHITECTURE §6; fix typos (D5) |
| Settings | `107:38` (Android Large - 6) | Org name; "Authentication Configuration": Email & Password, Google Sign-In | See D1 |
| Drawer | `109:126` (Frame 31) | Gold (`#E6C65C`) drawer, 250px wide: Dashboard, Members, Roles, Periods, Assignments, Integrations, Setting | Hamburger in top bar |
| (component) | `65:487` (Group 10) | 316×71 element, no text — a component/section fragment | — |
| Reports, Profile, Events, Notifications | — | Tabs/icons exist, **no screens** | Reports/Events/Notifications deferred; Profile basic in MVP |

## Create/Edit Member — designed from tokens (not in the prototype)

The prototype has no Create/Edit Member screen (`88:612` is empty). Owner approved designing it (2026-10-15). Spec (mobile; the desktop website uses a side sheet):

- **Header:** standard top bar (hamburger/back, centered title "Tambah Anggota" / "Ubah Anggota").
- **Fields (from `ARCHITECTURE.md` §4 / FR-10):** `full_name`, `email`, `nim`, `faculty`, `study_program`, `cohort_year`, `phone`, avatar (photo picker). Inputs reuse the login field style (12px radius, warm tint `rgba(161,89,18,0.1)`, Manrope 14px labels).
- **Actions:** Save (primary `#5A3E1B`, pill) and Cancel.
- **Validation:** inline errors per field; email must be an allowed ITERA domain; NIM/phone format-checked.
- **States:** loading (skeleton), empty, error (with retry), success toast; destructive confirm on deactivate (edit mode).
- **Permissions:** create needs `member:create`; edit needs `member:update` (own profile uses `profile:update_own`); fields beyond the actor's permission are hidden/read-only; a forbidden state renders when the actor has neither.
- **Language:** Bahasa Indonesia by default (ADR-0006).

## Approved deviations (owner-approved decisions that differ from the prototype)
- **D1 — Google only.** Owner decided auth is Google-only. Login shows only "Continue with Google" (keep the brown header and logo). Remove email/password fields.
  Settings "Authentication Configuration" becomes: Google Sign-In (always on) + **Allowed email domains** list (editable by super admin). No email/password toggle.
- **D2 — Assignment form** uses Member, **Unit** (new, required by the org model), Position, Period. "Role" is derived from Position (shown read-only), not chosen freely.
- **D3 — Roles.** Prototype "Create/Edit/Delete Role" applies to custom roles only; system roles show a lock and read-only permissions.
- **D4 — Dashboard stats.** Replace ambiguous "14 Mo" and arbitrary deltas with: Total Members, Active Period (label + dates), Available Roles, with deltas shown only if real historical data exists.
- **D5 — Language (updated 2026-10-15, ADR-0006).** Default locale is **Bahasa Indonesia**; all strings go through i18n so English can be selected. Figma's English labels remain the source text for layout reference. Fix prototype typos ("Posiion", "Connnected").

- **D6 — Mobile Story 5.4 states and prototype data (2026-10-17):** Directory uses a real staging API health check to distinguish loading, offline, and server-error states, but member rows remain static until the authenticated mobile members adapter is implemented. CRUD callbacks are intentionally non-persistent. This preserves the prototype boundary and avoids implying that mobile mutations are wired.
- **D7 — Directory icon fallback (2026-10-17):** Directory action icons currently use existing text glyphs (`✎`, `×`) rather than a new icon asset. Their 40px buttons plus `hitSlop` meet the 44px touch-target intent; replace glyphs with the shared icon set when the mobile icon mapping is expanded.
- **D8 — Web Members table columns (2026-10-21):** The desktop Members page shows **Nama & Email · NIM · Status · Aksi** instead of the prototype's name/role/period + fakultas/prodi/unit columns. Reason: `GET /api/v1/members` returns identity, NIM (permission-gated) and status; role, unit and period live in `assignments` and are not part of that payload, and faculty/prodi/cohort are not stored on the row at all. Showing them would mean inventing values. Restore the richer columns when the list endpoint grows the assignment join. Consequence: the "Semua Unit" filter is removed and the status control is **Nonaktifkan only** — deactivation is a one-way soft delete with no reactivate endpoint.

Any further deviation: record it here (ID, reason, date) and mention it in the task report.

## Desktop admin website (no Figma exists) — design rule
Derive from mobile tokens and patterns; do not invent a new visual language.
- Persistent left sidebar = the mobile drawer items (Dashboard, Members, Roles, Periods, Assignments, Integrations, Settings, plus Audit Log). Top bar with user menu.
- Content max width ~1200px; stat cards in a row; tables (sortable, filterable, paginated) replace the pill lists; side sheet/dialog for create/edit.
- Same colors, radii, typography. Breakpoints: mobile web (<768) falls back to the bottom-nav layout; tablet collapses sidebar; desktop expands it.
- Propose the desktop layouts in the PR description with screenshots; owner reviews before Phase 6.

## Required states for every screen
Loading (skeleton), empty, error (with retry), forbidden (no permission), offline (mobile), success/confirm toasts, destructive confirmation dialogs.

## Accessibility
Contrast >= WCAG AA (check brown/gold/cream combos, especially gold text on cream), 44px minimum touch targets, visible focus rings, labels for icon-only buttons
(edit/delete/bell), screen-reader names, respect dynamic text sizes on mobile, keyboard navigation on web.

## Fidelity check
After implementing a screen: screenshot it, compare against the Figma frame (spacing, typography, color, radius, icon), list differences in the report. Do not claim "pixel-perfect" without a comparison.
