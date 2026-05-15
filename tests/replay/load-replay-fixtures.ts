import { readJsonFile } from "@ifos/shared-utils";

const fixtures = [
  "tests/replay/baby-sleep-proving-lane.json",
  "tests/replay/backlog-items.json",
  "tests/replay/journey-stages.json",
  "tests/replay/publishing-memory.snapshots.json",
  "tests/replay/relationship-state.snapshots.json",
  "tests/replay/engagement-replays.json",
  "tests/replay/attribution-lineage.snapshots.json",
  "tests/replay/attribution-lineage.failures.json",
  "tests/replay/publishing-memory.failures.json",
  "tests/replay/relationship-state.failures.json",
  "tests/replay/attribution-lineage.validation.result.json",
  "tests/replay/publishing-memory.validation.result.json",
  "tests/replay/relationship-state.validation.result.json",
  "tests/replay/render-qa-baby-sleep-carousels.json",
  "tests/replay/render-qa-block-cases.json",
  "tests/replay/rendering-capability-baseline.json",
  "tests/replay/rendering-capability-archetype-replay.json",
  "tests/replay/rendering-capability-visual-state-replay.json",
  "tests/replay/rendering-capability-token-replay.json",
  "tests/replay/rendering-capability-bounded-edit-replay.json",
  "tests/replay/rendering-capability-export-manifest-replay.json",
  "tests/replay/rendering-capability-mutation-cases.json",
  "tests/replay/end-to-end-attribution-publishing-relationship.json",
  "tests/replay/baby-sleep-live-telemetry-batch-1-12.json",
  "tests/replay/baby-sleep-live-telemetry-ingestion-batch-1-12.json",
] as const;

async function main() {
  const loaded = await Promise.all(
    fixtures.map(async (fixture) => ({ fixture, payload: await readJsonFile<unknown>(fixture) })),
  );
  console.log(`loaded_replay_fixtures=${loaded.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
