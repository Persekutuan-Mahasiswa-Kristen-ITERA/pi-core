# ADR-0004: iOS as a development target without a paid Apple Developer account
- Status: accepted
- Date: 2026-10-15
- Deciders: owner

## Context
OQ-4 asked whether mobile targets include iOS, which needs a paid Apple Developer account for TestFlight / App Store distribution. Owner: "iOS also, but no need for a paid Apple account."

## Options considered
1. Android only — rejected: the owner wants iOS in scope.
2. **iOS in scope as a development/simulator target; Android first; no paid Apple account** (chosen).

## Decision
- Android is the first mobile target (per `docs/DESIGN.md`).
- iOS is a **development target**: local/simulator builds only. No App Store / TestFlight distribution (those require a paid Apple Developer account).
- No paid Apple resources are created.

## Consequences
- Positive: the iOS code path exists and can be developed/tested locally at zero cost.
- Negative/risk: iOS cannot be distributed to real users without a paid account; treat iOS as "dev-ready, not distributable" until the owner changes this.

## Verification
- The Expo app targets both platforms; iOS builds verified on the simulator; iOS distribution stays out of MVP scope.
