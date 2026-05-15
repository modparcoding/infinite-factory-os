# Baby Sleep Live Telemetry Readiness Runbook

## Purpose
Use this runbook to execute and validate the 12-post proving lane as a live telemetry-ready batch.

## Artifact
- `tests/replay/baby-sleep-live-telemetry-batch-1-12.json`
- `tests/replay/baby-sleep-live-telemetry-ingestion-batch-1-12.json`

## What is validated before launch
1. Post metadata includes canonical attribution lineage through `journey_id`, `journey_stage_id`, `value_arc_id`, `campaign_id`, `campaign_theme_id`, `backlog_item_id`, `asset_id`, `chain_id`, and `performance_record_id` where available.
2. Publish-ready metadata includes `hook`, `caption`, `visual`, `CTA` and `success_metric`.
3. Post-by-post expected telemetry bands are present for saves/shares/follows and lead captures where applicable.
4. Comparison plan exists with:
   - progression expectation checkpoints,
   - validates_model_when list,
   - invalidates_model_when list,
   - risk and sensitivity notes.
5. Ingestion readiness notes are present (expected fields, required sources, capture instructions).

## Recommended publishing cadence
- Two posts per day, morning/evening windows.
- Sequence gap used in the manifest: 12 hours.
- Keep maximum of 2 posts per day in first window.
- Run one post at a time if any critical drift rule triggers.

## Live telemetry fields (expected)
- `PublishedPost ID`
- `saves`, `shares`, `follows`, `comments`
- `watch_time_seconds` (optional)
- `lead_captures` (optional, mainly post 12 onward)
- `captured_at` (UTC)
- Attribution IDs

## Comparison outputs (expected vs actual)
Per post:
- `expected_engagement_bands`
- `expected_relationship_effect`
- `expected_publishing_memory`
- `expected_relationship_state`
- `confirm_if`
- `invalidate_if`

Batch-level comparison:
- `comparison_plan.simulated_progression_expectations`
- `comparison_plan.real_telemetry_validation_signals`

## Drift detection triggers
1. `DRIFT-SAVES-01`: savings ratio below threshold.
2. `DRIFT-TRUST-02`: trust score drift exceeds threshold.
3. `DRIFT-REPETITION-03`: repetition risk increases beyond tolerance.
4. `DRIFT-COMMERCIAL-04`: commercial density drift exceeds threshold.

## Over-commercialization triggers
1. `OC-CHECK-01`: commercial density windowed threshold exceeded (default 0.12).
2. `OC-CHECK-02`: saves-to-follows ratio drops below ratio tolerance.

## Human review checklist before publishing
Use this exact list from manifest:
- Confirm no post has sales tone before trust is clearly present.
- Verify attribution lineage IDs are complete for all 12 posts.
- Confirm cadence ≤ 2 posts/day.
- Confirm commercial density remains below 0.12 through post 11.
- Confirm lead capture appears only in the planned capture slot and context.
- Confirm first three resonance posts remain safe and supportive.

## How to run
- Validate fixture parseability by loading replay fixtures.
- Verify one post is queued with the expected published schedule.
- Capture live metrics once each post exits its recommended publish window.

