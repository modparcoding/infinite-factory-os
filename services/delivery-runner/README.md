# Delivery Runner Service Scaffold

Permanent placement recommendation:
- Keep the existing code-owned worker at `../infinite-factory-os/workers/lead-magnet-delivery-runner`.
- Consume this worker through a thin adapter contract in this service.
- Do not copy its execution logic into this repo during bootstrap.

Bounded scope:
- contract registry and adapter boundary only.
- no Make-orchestrated rewrite of proof send path.
