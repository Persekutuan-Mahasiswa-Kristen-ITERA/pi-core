---
title: PI-CORE — Product Brief
status: draft
created: 2026-10-15
updated: 2026-10-15
---

# Product Brief: PI-CORE (PMK ITERA Centralized Organization & Role Engine)

## Executive Summary

PI-CORE is the central identity, membership, organization-structure, role/permission and SSO service for the PMK ITERA digital ecosystem. Today each PMK ITERA app (PI-NEXUS, Finance, Notulensi, Panitia, Inventory) must reinvent members, roles and login for itself; nothing owns the single question *"who is this person, what may they do, and in which unit and period?"*. PI-CORE answers that once, for everyone.

It is delivered as (a) a native mobile app (Expo) for members and pengurus, (b) a desktop admin website, and (c) a shared HTTP API that also acts as an **OIDC provider**, so other apps can authenticate users through PI-CORE instead of building their own auth.

It matters because identity is the root of trust for the whole ecosystem: centralize it correctly, enforce authorization server-side, and audit every change — and every downstream app becomes simpler, safer and consistent. Get it wrong, and every app inherits the flaw.

## The Problem

- **No single source of truth for members.** Each app keeps its own copy; data drifts; nobody can say who the "official" member is.
- **Structure changes every period.** Kepengurusan (BPH, departments, bureau, divisions) rotates; roles/positions are not modeled, so apps hardcode names or re-ask users.
- **No centralized authorization.** Permissions are app-local, inconsistent, and unauditable; UI hiding masquerades as security.
- **Sensitive data has no access model.** NIM, phone and email are exposed to anyone who can read a member.
- **No shared login.** No SSO, no single sign-out, no central revocation when someone leaves a post.
- **No audit trail.** Nobody can reconstruct who granted or removed access.

*Who feels it:* pengurus who manage people and units; app builders forced to re-implement identity; and members who end up with inconsistent accounts across apps.

## The Solution

One service that owns identity and access for PMK ITERA:

- **Member directory** — invite-only, Google Sign-In only, domain-allowlisted.
- **Organization model** — units (BPH, departments, bureau, divisions), periods, positions, and assignments (member × unit × position × period).
- **Roles & permissions** — roles are permission bundles; one server-side `can()` enforced on every endpoint, deny-by-default, with unit scope (O/U/S).
- **OIDC provider** — other PMK apps register as integrations; PI-CORE returns a small ID token plus an access endpoint carrying the caller's active-period assignments, roles and permissions.
- **Audit log** — every mutation of members, assignments, periods, roles, integrations and settings is recorded.
- **Surfaces** — native mobile app (per the Figma prototype) and a desktop admin website.

## What Makes This Different

- Built for PMK ITERA's **real** structure (BPH / departments / bureau / divisions, period-based kepengurusan), not a generic identity product.
- **Periods are first-class**: access is granted by the *active period's* assignments, so the yearly handover is a data operation, not a code change.
- **Authorization is centralized and server-side** (one `can()`); consumers never trust client-supplied roles.
- **Google-only auth** removes password risk; invite-only + domain allowlist keeps membership closed.
- Honest moat: no novel technology — the advantage is *fit* (exact org + period model) and *consolidation* (one identity for the ecosystem).

## Who This Serves

- **Anggota (baseline members)** — all Christian students of ITERA. Primary: view the directory, manage their own profile.
- **Pengurus** — BPH (Ketua Umum, Sekjen, Sekum, Bendahara), Kepala Departemen/Biro, Sekretaris, Kepala Divisi, Staff. Manage members, assignments and (for BPH) structure and periods.
- **super_admin** — technical owner(s); manage roles, permissions, integrations and settings; cannot be self-granted.
- **Consumer apps** (PI-NEXUS, Finance, Notulensi, Panitia, Inventory) — OIDC clients needing identity + authorization from PI-CORE.

## Success Criteria

- PI-CORE is the **only** source of members, org structure, roles and login for the ecosystem; at least PI-NEXUS authenticates through PI-CORE OIDC.
- Every endpoint enforces authorization server-side; denied cases are tested; no route ships without a `can()` check.
- Org structure and periods are manageable end-to-end (create period → activate → assign members) **without developer involvement**.
- Every mutation of members/assignments/periods/roles/integrations/settings produces an audit row.
- The mobile app matches the Figma prototype (with approved deviations D1–D5); the admin website covers the same management surface on desktop.

## Scope

**In (MVP):** Google-only auth (domain allowlist, invite-only); member directory; org units; periods (one active); positions; roles & permission matrix; assignments; integrations (OIDC clients); settings / authentication configuration; audit log; admin website; native mobile app (Android first); shared HTTP API; OIDC provider.

**Out (MVP):** Reports tab; Events; Notifications; Panitia (event-scoped role); legacy member data import; optional TOTP step-up MFA; iOS (pending decision).

## Vision

PI-CORE becomes the identity root of the entire PMK ITERA digital ecosystem: every app — current and future — trusts PI-CORE for "who is this, what may they do, in which unit and period", and stops building its own auth. Kepengurusan history is preserved across periods, so the organization's structure and who held what stays queryable years later. Onboarding a new PMK app becomes: *register an OIDC client, done.*
