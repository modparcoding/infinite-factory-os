import fs from "node:fs";
import path from "node:path";

import { PublishingEventSchema, PublishingMemorySnapshotSchema, PublishingMemoryInputFixtureSchema } from "@ifos/contracts";
import { buildPublishingMemory } from "@ifos/services-publishing-memory";

interface PublishingFixtureCase {
  case_id: string;
  input_events: unknown[];
  expected_snapshot: {
    memory_id: string;
  };
}

interface PublishingFailureCase {
  case_id: string;
  source_events: unknown[];
  expected_failure: string;
}

function loadJson<T>(fixturePath: string): T {
  const fullPath = path.resolve(process.cwd(), fixturePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T;
}

export function runPublishingMemoryContractChecks() {
  const cases = loadJson<PublishingFixtureCase[]>("tests/replay/publishing-memory.snapshots.json");
  const failures = loadJson<PublishingFailureCase[]>("tests/replay/publishing-memory.failures.json");

  for (const item of cases) {
    const sourceEvents = item.input_events.map((event) => PublishingEventSchema.parse(event));
    const fixture = PublishingMemoryInputFixtureSchema.parse({
      source_events: sourceEvents,
      memory_id: item.expected_snapshot.memory_id,
    });

    const snapshot = buildPublishingMemory(fixture);
    PublishingMemorySnapshotSchema.parse(snapshot);

    const expected = PublishingMemorySnapshotSchema.parse(item.expected_snapshot);
    if (JSON.stringify(snapshot) !== JSON.stringify(expected)) {
      throw new Error(`PublishingMemory fixture ${item.case_id} deterministic replay mismatch`);
    }
  }

  const seenErrors: string[] = [];

  for (const item of failures) {
    const parsed = PublishingMemoryInputFixtureSchema.safeParse({
      source_events: item.source_events,
      memory_id: `failure-${item.case_id}`,
    });

    if (parsed.success) {
      try {
        buildPublishingMemory(parsed.data);
        throw new Error(`PublishingMemory failure fixture ${item.case_id} unexpectedly succeeded`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes(item.expected_failure)) {
          throw new Error(`PublishingMemory failure fixture ${item.case_id} expected '${item.expected_failure}', got '${message}'`);
        }
      }
      continue;
    }

    if (!parsed.error.issues.some((issue) => issue.message.includes(item.expected_failure))) {
      seenErrors.push(item.case_id);
    }
  }

  if (seenErrors.length > 0) {
    throw new Error(`PublishingMemory failures did not match expected reasons: ${seenErrors.join(",")}`);
  }

  return {
    case_count: cases.length,
    failure_count: failures.length,
  };
}

export const publishingContractTestResult = runPublishingMemoryContractChecks();
