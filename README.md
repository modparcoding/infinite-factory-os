# Infinite Factory OS

Agentic substrate repo for relation-aware orchestration and campaign delivery.

## Purpose

This repository is intentionally bootstrap-only and contract-first. It provides bounded
scaffolding for specialist agents, replayable evaluation, and bounded development contracts.

Do not implement full platform behavior here; this repository is the foundation for
future low-touch agent execution.

## Top-level domains

- `packages/*` → contracts, shared schemas, policy primitives, provider boundaries.
- `services/*` → domain service scaffolds (truth stores + planners + measurement).
- `agents/*` → orchestrator and specialist agent scaffolds.
- `workstreams/*` → machine-readable workstream contracts and queue state.
- `tests/*` → replay and contract fixtures.
- `docs/*` → architecture/runbook/ADR memory that should govern behavior.

## Canonical memory

- [docs/project-memory.md](docs/project-memory.md) is the canonical cross-chat memory file.
- Any chat-facing decision or context update should flow here first, then propagate to runbooks/contracts as needed.
