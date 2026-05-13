# Lead Magnet Delivery Runner

Proof-mode Cloudflare Worker for code-owned lead magnet delivery.

Current scope:

- reads the Airtable delivery contract
- checks duplicate evidence before send
- reads Brevo contact and template state
- verifies the stable delivery asset bytes/hash
- supports dry-run validation
- keeps real sending disabled unless `ENABLE_PROOF_SEND=1`

Required secrets:

- `AIRTABLE_TOKEN`
- `BREVO_API_KEY`
- `RUNNER_AUTH_SECRET`

Proof endpoint:

```text
POST /proof
Authorization: Bearer <RUNNER_AUTH_SECRET>
```

Body:

```json
{
  "mode": "proof",
  "contractId": "recpjWkUboIb7pOQB",
  "contractKey": "home-organization/family-reset-routines/7-day-family-reset-planner/v1",
  "brevoContactId": "1",
  "proofId": "ws34ea-home-organization-contact-1",
  "dryRun": true
}
```

The runner writes Airtable evidence only after Brevo accepts a send. Dry runs
never send and never write evidence.
