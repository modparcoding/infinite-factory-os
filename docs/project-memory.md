# Project Memory

## Purpose
This repository is the durable substrate for the Infinite Factory Agentic Platform, focused on
relationship-aware audience progression, attribution integrity, and low-touch agent development.

## Provenance and continuity
- Preserved direction: relationship-aware orchestration, relationship pacing, and attribution lineage.
- Not in scope: full autonomous orchestration, generalized AGI infrastructure, or large-scale production pipelines.
- Existing code-owned delivery runner and proven commercial systems were preserved via continuity in contracts, replay fixtures, and service boundaries.

## Current operating context
- Live scope: proving-lane substrate and early operational validation for the Baby Sleep niche.
- Primary innovation lane: relationship progression + trust pacing + campaign-aware planning.
- Core entities in active use:
  - `AudienceJourney`
  - `JourneyStage`
  - `ValueArc`
  - `Campaign`
  - `CampaignTheme`
  - `BacklogItem`
  - `Asset`
  - `PublishedPost`
  - `PerformanceRecord`
  - `PublishingMemory`
  - `RelationshipState`

## What is operational today
- Repository monorepo + workspace is executable.
- Workstream contracts and gating schema are present.
- Canonical attribution lineage schema and replay validation are implemented.
- PublishingMemory v1 derivation is executable and replayable.
- RelationshipState heuristic derivation is executable and replayable.
- Render QA block-condition fixtures and deterministic scoring are in place.
- Baby Sleep proving lane artifacts are present (BacklogItems, journey stages, publication package, telemetry fixtures).

## What is scaffold-grade
- Provider clients and many services are interface-bound scaffolds.
- No self-modifying planner logic.
- No generalized AI inference in relationship or render engines.
- No full CI/CD automation beyond lightweight validation scaffolding.

## Governance and execution constraints
- Human approval required for:
  - Architecture changes
  - Schema changes
  - Monetization/commercial pacing policy
  - Trust/pacing policy changes
  - Production deployment
- Orchestrator remains lightweight:
  - status + dependency + ownership aware
  - enforces human-gating for blocked/invalid states
  - does not self-plan or execute recursively

## Active proving lane
- Niche: Parenting / SubNiche: Baby Sleep
- Current phase: transition from scaffold hardening to real-world operational publishing readiness.
- Sequence bias in lane design:
  - `Resonance` and `Relief` lead
  - `Trust` as the primary conversion-to-trust stage
  - `Lead Capture` and `Monetization` introduced only after sustained trust signals

## Key risks to watch
- Over-commercialization pressure too early in sequence.
- Emotional mismatch between copy tone and `JourneyStage`.
- Attribution linkage gaps (missing stage/arc/campaign references).
- Deterministic replay drift from manual content edits.

- Deterministic rendering regressions when bridge-adapting from legacy carousel request shape to the new rendering contracts.

## Recurrent truth sources
- Canonical architecture notes: [docs/architecture/current-status.md](docs/architecture/current-status.md)
- Runbook entry points:
  - [docs/runbooks/handoff.md](docs/runbooks/handoff.md)
  - [docs/runbooks/onboarding.md](docs/runbooks/onboarding.md)
- Workstream contracts:
  - `workstreams/queue/*.yaml`
  - `workstreams/templates/workstream.template.json`

## Next priorities (ordered)
1. Stand up the Rendering Capability Family v1 as the migration-first output layer for slide generation.
1. Keep replay fixtures and validation outputs current after any content or rule edits.
2. Prepare first real telemetry intake and comparison loop.
3. Monitor trust/commercial pacing thresholds and tune heuristics.
4. Add branch-level policy checks for required review gates.
