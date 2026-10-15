# ADR-0006: Default UI language is Bahasa Indonesia
- Status: accepted
- Date: 2026-10-15
- Deciders: owner

## Context
`docs/DESIGN.md` deviation **D5** said: keep English labels as in Figma, wire strings through i18n so Bahasa Indonesia can be added. OQ-7 asked which default the owner wants. Owner: "default is Bahasa Indonesia."

## Options considered
1. English default (Figma labels) with i18n — the original D5.
2. **Bahasa Indonesia default, i18n-ready** (chosen).

## Decision
- Default locale = **Bahasa Indonesia** for all UI (web + mobile).
- All strings still go through i18n; English remains available as a second locale.
- `docs/DESIGN.md` D5 is updated accordingly (prototype typo fixes still apply).

## Consequences
- Positive: matches the primary user base; no hardcoded English strings.
- Negative/risk: Indonesian labels differ in length from the Figma English labels; screens must be checked for fit and any layout impact recorded as a fidelity note during implementation.

## Verification
- The string/token layer is locale-driven; a smoke check switches locale and renders Bahasa Indonesia by default.
