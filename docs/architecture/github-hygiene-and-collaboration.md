# GitHub Hygiene and Collaborative Workstream Setup (Initial)

## Branch protection recommendation notes
- Set default branch to `main`.
- Require pull request review before merging (minimum one approver).
- Require status checks:
  - `pnpm run build`
  - `pnpm run typecheck`
  - `pnpm run replay:validate`
- Restrict direct pushes to `main` and require signed commits if policy permits.
- Require up-to-date branch before merge.

## Initial labels recommendation
Create labels with clear operational intent:
- `workstream`
- `blocked`
- `ready`
- `completed`
- `high-risk`
- `human-review-required`
- `replay-failed`
- `replay-passed`
- `dependency-missing`
- `service-scaffold`
- `production-hardening`
- `baby-sleep-lane`
- `attribution`
- `publishing-memory`
- `relationship-state`
- `render-qa`

### Label use convention
- Prefixes may be used in body if needed:
  - `agent:measurement-agent`
  - `agent:provisioning-agent`
  - `agent:relationship-agent`
  - `agent:delivery-agent`
  - `agent:content-agent`

## GitHub Projects structure for agentic workstreams
- Use one project for platform ops, one board for proving lanes:
  - Project A: `Infinite Factory OS – Workstreams`
  - Project B: `Infinite Factory OS – Proving Lanes`
- Columns (single source of status truth):
  - Intake
  - Blocked
  - Ready
  - In Progress
  - Review/Validation
  - Completed
- Field recommendations:
  - `workstream_id`
  - `owner_agent`
  - `risk_level`
  - `requires_human_review`
  - `blocked_by`
  - `replay_file`
  - `contract_version`
- Tie PRs and issues to board items by workstream_id to keep orchestrator and manual flow aligned.
