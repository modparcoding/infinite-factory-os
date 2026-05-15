# Provider Boundaries

This doc is the canonical contract map for external systems.

- Airtable client: record read/write + schema drift guard (contract scoped).
- Brevo client: lead submission + readback + route-level mapping.
- Cloudflare client: worker execution + worker identity governance.
- GitHub client: issue/task handoff for human review.
- Make client: optional/orchestration-only, non-default.

All providers are intentionally boundary-only in bootstrap.
