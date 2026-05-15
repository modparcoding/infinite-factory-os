import { z } from "zod";

const workstreamFileRef = z
  .string()
  .min(2)
  .regex(/^[^\n\r]+$/);

const ioRefSchema = z.object({
  name: z.string().min(1),
  required: z.boolean(),
  description: z.string().min(3),
  schemaRef: z.string().optional(),
});

export const WorkstreamStatusSchema = z.enum([
  "queued",
  "blocked",
  "ready",
  "in_progress",
  "completed",
  "closed",
  "deprecated",
]);

export const WorkstreamRiskSchema = z.enum(["low", "medium", "high", "critical"]);

export const HumanReviewStateSchema = z.enum(["required", "resolved", "not_required", "waived"]);

export const WorkstreamContractSchema = z.object({
  workstream_id: z.string().min(3).regex(/^WS-[A-Z]{3}-[0-9]{3}$/),
  title: z.string().min(3),
  objective: z.string().min(3),
  scope: z.string().min(3),
  allowed_files: z.array(workstreamFileRef),
  forbidden_files: z.array(workstreamFileRef),
  dependencies: z.array(z.string().min(3)),
  inputs: z.array(ioRefSchema),
  outputs: z.array(ioRefSchema),
  acceptance_criteria: z.array(z.string().min(3)),
  tests_required: z.array(z.string().min(3)),
  risk_level: WorkstreamRiskSchema,
  requires_human_review: z.boolean(),
  human_review_status: HumanReviewStateSchema.default("required"),
  replay_validation_result_file: z.string().optional(),
  replay_validation_status: z.enum(["not_run", "passed", "failed"]).default("not_run"),
  owner_agent: z.string().min(3),
  status: WorkstreamStatusSchema,
  blocked_reason: z.string().optional(),
  owner_notes: z.string().optional(),
});

export type WorkstreamContract = z.infer<typeof WorkstreamContractSchema>;

export function parseWorkstreamContract(value: unknown): WorkstreamContract {
  return WorkstreamContractSchema.parse(value);
}

export function isWorkstreamQueued(value: WorkstreamContract) {
  return value.status === "queued";
}
