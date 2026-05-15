import { buildPublishingMemory } from "@ifos/services-publishing-memory";
import { deriveRelationshipStateFromMemory } from "@ifos/services-relationship-state";
import { readJsonFile } from "@ifos/shared-utils";
import { PublishingEventSchema } from "@ifos/contracts";

export interface RelationshipMachineIntegrationOutput {
  fixture_id: string;
  memory_id: string;
  relationship_state: string;
}

function asNonEmptyTuple<T>(items: T[]): [T, ...T[]] {
  if (!items || items.length === 0) {
    throw new Error("integration requires non-empty publishing events");
  }
  return items as [T, ...T[]];
}

export async function runRelationshipMachineIntegration() {
  const snapshots = await readJsonFile<unknown[]>("tests/replay/publishing-memory.snapshots.json");
  if (snapshots.length === 0) {
    throw new Error("No publishing-memory snapshots available");
  }

  const fixture = snapshots[0] as { case_id: string; input_events?: unknown[]; expected_snapshot: unknown };
  const parsedEvents = (fixture.input_events ?? []).map((row) => PublishingEventSchema.parse(row));
  const memory = buildPublishingMemory({
    memory_id: `memory-${fixture.case_id}`,
    source_events: asNonEmptyTuple(parsedEvents),
  });

  const relationship = deriveRelationshipStateFromMemory(memory);

  return {
    fixture_id: fixture.case_id,
    memory_id: memory.memory_id,
    relationship_state: relationship.relationship_state.trust_level,
  } satisfies RelationshipMachineIntegrationOutput;
}

export const _smoke = await runRelationshipMachineIntegration();
