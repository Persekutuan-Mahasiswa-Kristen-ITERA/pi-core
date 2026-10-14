# DESIGN — PI-CORE

Source of truth: Figma file **PMK-CORE** — https://www.figma.com/design/18T2e8GH2l2zTzn7vkP1ax/PMK-CORE?node-id=0-1
(file key `18T2e8GH2l2zTzn7vkP1ax`). The Figma prototype is **mobile-only** (phone frames). Always read Figma through the Figma MCP before building a screen
(see skill `figma-to-code`). Values in this file marked *(approx.)* were eyeballed from a PDF export and MUST be replaced by exact values from Figma.

## Identity
Brand: Persekutuan Mahasiswa Kristen ITERA (logo: cross inside heart, alpha/omega, circular badge). Warm, calm, church-organization feel. Greeting: "Shalom, {name}!".
Logo asset: export from Figma (do not recreate). Used on Login header and Settings.

## Tokens *(approx., verify via Figma)*
- Brown (primary, buttons, login header, greeting pill): ~`#5C3D1E` / header ~`#6B4F2E`
- Gold: ~`#C9A227` (dark) and ~`#E5C45A` (light; drawer background)
- Cream background: ~`#F7F4F0`; card/surface tint: ~`#F0E6DC` with a thin warm border
- Accent for icons/active nav: warm brown-orange ~`#A8641A`; inactive nav/icons: slate gray-blue
- Text: near-black navy for headings, slate for secondary. Positive delta green, negative delta red.
- Typography: rounded geometric sans (looks like Manrope for UI; Poppins-style for the wide-tracked "LOGIN" and org title). Confirm families/weights in Figma.
- Shape: large radius (pill buttons, ~16–24px cards), soft shadow on primary buttons. Spacing roughly 8px grid.
Implement tokens once: CSS variables + Tailwind theme (web) and a TS token object (mobile). Do not hardcode hex values in components.

## Layout patterns (mobile)
- Top bar: hamburger (left), centered screen title, notification bell (right).
- Bottom nav (4 tabs): Home, Directory, Reports, Profile. Active tab uses the accent color.
- Drawer (gold): Dashboard, Members, Roles, Periods, Assignments, Integrations, Setting.
- Directory has top tabs: Members | Roles | Periods.
- Cards on cream background; list rows are rounded tinted pills.

## Screen inventory (from the prototype)
| Screen | Content | Notes |
|---|---|---|
| Login | Org title on brown curved header, logo, email/password fields, LOG IN, "Log in with Google" | See deviation D1 |
| Dashboard | Greeting pill; stat cards (Total Members, Active Period, Available Roles) with % delta; Quick Access (Members, Roles, Events, Settings) | Delta semantics unclear (D4); Events is deferred |
| Members | "Create Member"; search; Filter Role [ALL]; Filter Period [year]; rows: name, role, period, edit, delete | Delete = soft-delete with confirmation |
| Create/Edit Member | **Not in prototype** (page 8 is an empty frame) | Must be designed from tokens; report as missing |
| Roles | "Create Role"; grid of role cards (name, Total Members); role detail: member list with position, Edit Role, Delete Role | System roles locked (D3) |
| Periods | "Create Period"; list e.g. 2026/2027 Active; others "Set Active"; Edit | One active period only |
| Assignments | Form: Assign Member, Role, Position, Period + Save; list rows: user, role, position, period | See D2 |
| Integrations | Cards: PMK NEXUS, FINANCE, NOTULENSI, PANITIA, INVENTORY with Connected / Not Connected | Meaning defined in ARCHITECTURE §6 |
| Settings | Logo + org name; "Authentication Configuration" with toggles: Email & Password, Google Sign-In | See D1 |
| Reports, Profile, Events, Notifications | Tabs/icons exist, **no screens** | Reports/Events/Notifications deferred; Profile basic in MVP |

## Approved deviations (owner-approved decisions that differ from the prototype)
- **D1 — Google only.** Owner decided auth is Google-only. Login shows only "Continue with Google" (keep the brown header and logo). Remove email/password fields.
  Settings "Authentication Configuration" becomes: Google Sign-In (always on) + **Allowed email domains** list (editable by super admin). No email/password toggle.
- **D2 — Assignment form** uses Member, **Unit** (new, required by the org model), Position, Period. "Role" is derived from Position (shown read-only), not chosen freely.
- **D3 — Roles.** Prototype "Create/Edit/Delete Role" applies to custom roles only; system roles show a lock and read-only permissions.
- **D4 — Dashboard stats.** Replace ambiguous "14 Mo" and arbitrary deltas with: Total Members, Active Period (label + dates), Available Roles, with deltas shown only if real historical data exists.
- **D5 — Language.** Keep English labels as in Figma; wire all strings through i18n so Bahasa Indonesia can be added. Fix prototype typos ("Posiion", "Connnected").

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
