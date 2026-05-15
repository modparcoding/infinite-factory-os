import { parseWorkstreamContract, WorkstreamContract } from "@ifos/contracts";

export interface ProvisioningTruthRecord {
  truth_id: string;
  workstream_id: string;
  data: Record<string, unknown>;
  created_at: string;
}

export function asProvisioningTruth(input: unknown): ProvisioningTruthRecord {
  const contract = parseWorkstreamContract((input as { payload?: unknown })?.payload ?? input);
  return {
    truth_id: contract.workstream_id,
    workstream_id: contract.workstream_id,
    data: input as Record<string, unknown>,
    created_at: new Date().toISOString(),
  };
}

export function canWriteProvisioning(workstream: WorkstreamContract): boolean {
  return ![
    "architecture_changes",
    "monetization_logic",
    "policy_modification",
    "human_launch_decisions",
  ].includes(workstream.owner_agent);
}
