# Orchestrator Scaffold

This orchestrator is intentionally non-autonomous. It:

- reads `workstreams/queue/*.yaml`
- parses each contract using `@ifos/contracts`
- computes readiness from declared dependencies
- marks workstreams as blocked when dependency prerequisites are missing
- prints a deterministic execution plan payload but does not execute work

Blocking rules:
- status transitions are only suggested when dependencies are satisfied and dependency workstreams are `completed` or `closed`.
- `requires_human_review` remains a gating signal (displayed only; not automatically cleared).

No recursive planning, no self-modifying behavior, no autonomous re-open loops.
