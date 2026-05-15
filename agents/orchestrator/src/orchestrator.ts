import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parseWorkstreamContract, WorkstreamContract } from "@ifos/contracts";
import { readJsonOrYamlFile } from "@ifos/shared-utils";

type WorkstreamEnvelope = { source: string; contract: WorkstreamContract };

type ReplayValidationSummary = {
  status: "passed" | "failed" | "not_run" | "missing";
  file: string | null;
};

const args = new Map(
  process.argv
    .slice(2)
    .flatMap((item, index, all) => (item.startsWith("--") ? [[item.slice(2), all[index + 1]]] : [])),
);

const queuePath = path.resolve(process.cwd(), args.get("queue") || "workstreams/queue");
const showBlocked = args.has("show-blocked");

async function evaluateReplayValidation(contract: WorkstreamContract): Promise<ReplayValidationSummary> {
  const resultFile = contract.replay_validation_result_file;
  if (!resultFile) {
    if (contract.replay_validation_status === "passed") {
      return { status: "passed", file: null };
    }
    return { status: contract.replay_validation_status, file: null };
  }

  const resolvedPath = path.resolve(process.cwd(), resultFile);
  const normalized = path.relative(process.cwd(), resolvedPath);

  try {
    await fs.access(resolvedPath);
  } catch {
    return { status: "missing", file: normalized };
  }

  try {
    const payload = await readJsonOrYamlFile<{
      status: "passed" | "failed";
      workstream_id?: string;
      checks?: unknown;
    }>(resolvedPath);

    if (payload?.status === "passed") {
      return { status: "passed", file: normalized };
    }

    return { status: "failed", file: normalized };
  } catch {
    return { status: "failed", file: normalized };
  }
}

async function loadWorkstreams(dir: string): Promise<WorkstreamEnvelope[]> {
  const files = await fs.readdir(dir, { withFileTypes: true });
  const targets = files.filter((file) => file.isFile() && file.name.endsWith(".yaml"));
  const loaded: WorkstreamEnvelope[] = [];

  for (const file of targets) {
    const fullPath = path.join(dir, file.name);
    const raw = await readJsonOrYamlFile<unknown>(fullPath);

    try {
      const contract = parseWorkstreamContract(raw);
      loaded.push({ source: file.name, contract });
      continue;
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid_contract";
      loaded.push({
        source: file.name,
        contract: {
          workstream_id: `invalid-${file.name}`,
          title: "Invalid workstream contract",
          objective: "Unknown",
          scope: "Review contract format",
          allowed_files: [],
          forbidden_files: [],
          dependencies: [],
          inputs: [],
          outputs: [],
          acceptance_criteria: ["valid_contract"],
          tests_required: [],
          risk_level: "low",
          requires_human_review: true,
          human_review_status: "required",
          replay_validation_status: "not_run",
          replay_validation_result_file: undefined,
          owner_agent: "orchestrator",
          status: "blocked",
          owner_notes: `contract_parse_error: ${message}`,
        },
      });
    }
  }

  return loaded;
}

type DependencyState = {
  missingDependencies: string[];
  unreadyDependencies: string[];
  duplicates: string[];
};

function buildDependencyMap(envelopes: WorkstreamEnvelope[]) {
  const map = new Map(envelopes.map((item) => [item.contract.workstream_id, item]));
  const ready = new Set<string>(
    envelopes
      .filter((item) => item.contract.status === "completed" || item.contract.status === "closed")
      .map((item) => item.contract.workstream_id),
  );
  const blocked = new Set<string>();
  const dependencyStateById = new Map<string, DependencyState>();

  for (const item of envelopes) {
    if (item.contract.status !== "queued" && item.contract.status !== "ready") {
      continue;
    }

    const uniqueDependencies = [...new Set(item.contract.dependencies)];
    const duplicates = item.contract.dependencies.filter((dep, index) => item.contract.dependencies.indexOf(dep) !== index);
    const missing = uniqueDependencies.filter((dep) => !map.has(dep));
    const unready = uniqueDependencies.filter((dep) => map.has(dep) && !ready.has(dep));

    dependencyStateById.set(item.contract.workstream_id, {
      missingDependencies: missing,
      unreadyDependencies: unready,
      duplicates,
    });

    if (missing.length > 0 || unready.length > 0 || duplicates.length > 0) {
      blocked.add(item.contract.workstream_id);
    }
  }

  return { map, ready, blocked, dependencyStateById };
}

async function evaluateQueue(envelopes: WorkstreamEnvelope[]) {
  const { ready, blocked, dependencyStateById } = buildDependencyMap(envelopes);

  const report = await Promise.all(
    envelopes.map(async (item) => {
      const contract = item.contract;
      const blockedReasons: string[] = [];
      const depBlocked = blocked.has(contract.workstream_id);
      const dependencyState = dependencyStateById.get(contract.workstream_id);

      if (depBlocked) {
        if (dependencyState?.missingDependencies.length) {
          blockedReasons.push("dependencies_missing");
        }
        if (dependencyState?.unreadyDependencies.length) {
          blockedReasons.push("dependencies_unresolved");
        }
        if (dependencyState?.duplicates.length) {
          blockedReasons.push("dependencies_duplicate");
        }
      }

      const unresolvedReview = contract.requires_human_review && contract.human_review_status === "required";
      if (unresolvedReview) {
        blockedReasons.push("human_review_required");
      }

      const replay = await evaluateReplayValidation(contract);
      if (replay.status === "not_run" || replay.status === "missing") {
        blockedReasons.push(`replay_${replay.status}`);
      }
      if (replay.status === "failed") {
        blockedReasons.push("replay_validation_failed");
      }

      if (contract.status === "queued") {
        blockedReasons.push("status_queued");
      }
      if (contract.status === "in_progress") {
        blockedReasons.push("status_in_progress");
      }
      if (contract.status === "ready" && dependencyState) {
        if (dependencyState.duplicates.length > 0 || dependencyState.missingDependencies.length > 0 || dependencyState.unreadyDependencies.length > 0) {
          blockedReasons.push("invalid_transition_to_ready");
        }
      }
      if (contract.status === "completed" && !dependencyState && contract.replay_validation_status !== "passed") {
        blockedReasons.push("completed_without_passed_replay");
      }

      const canStart = contract.status === "ready" && blockedReasons.length === 0;
      const currentStatus = canStart ? "ready" : blockedReasons.length > 0 ? "blocked" : contract.status;

      return {
        source: item.source,
        workstream_id: contract.workstream_id,
        title: contract.title,
        owner_agent: contract.owner_agent,
        current_status: currentStatus,
        risk_level: contract.risk_level,
        requires_human_review: contract.requires_human_review,
        blocked_by: depBlocked ? dependencyState?.unreadyDependencies ?? [] : [],
        blocked_reasons: blockedReasons,
        can_start: canStart,
        outputs: contract.outputs.map((entry) => entry.name),
        replay_validation_file: replay.file ?? contract.replay_validation_result_file,
      };
    }),
  );

  return report;
}

async function main() {
  const envelopes = await loadWorkstreams(queuePath);
  const report = await evaluateQueue(envelopes);
  const filtered = showBlocked ? report.filter((item) => item.current_status === "blocked") : report;

  console.log(
    JSON.stringify(
      {
        queue: path.relative(process.cwd(), queuePath),
        total: report.length,
        blocked: report.filter((item) => item.current_status === "blocked").length,
        ready: report.filter((item) => item.can_start).length,
        entries: filtered,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("orchestrator failed", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
