# Migration Strategy

- Preserve and reference current proven runner under `infinite-factory-os/workers/lead-magnet-delivery-runner`.
- Do not redesign business architecture during bootstrap.
- Keep Make/Airtable/OpenAI/Cloudflare/Instagram integrations as boundaries in `packages/provider-clients`.
- Move toward service ownership through workstreams that only transition from `queued` to `ready` after schema checks and explicit blockers cleared.
