# ADR-0001 Workstream Contract as Operational Unit

Status: Accepted

Rationale:
- Existing context requires explicit coordination and governance.
- Workstream contracts give bounded scope and replayable expectations.
- Human governance gates can be attached at contract level.

Decision:
- Every implementation candidate enters `workstreams/queue` with the required schema.
- Orchestrator reads and evaluates workstream dependencies.
