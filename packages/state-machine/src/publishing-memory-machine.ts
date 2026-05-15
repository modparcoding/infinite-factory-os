import { canTransition, StateMachine } from "./orchestrator-state.js";

export interface PublishingContext {
  cadenceOk: boolean;
  qualityScore: number;
}

export interface PublishingMemorySnapshot {
  publishing_state: string;
}

export const publishingMemoryMachine: StateMachine<PublishingContext, PublishingMemorySnapshot> = {
  name: "publishing-memory-state",
  stateField: "publishing_state",
  states: ["cold", "staged", "queued", "published", "review_failed", "retired"],
  transitions: [
    {
      from: "cold",
      to: "staged",
      when: ({ cadenceOk }) => cadenceOk,
      reason: "cadence_restriction",
    },
    {
      from: "staged",
      to: "queued",
      when: ({ qualityScore }) => qualityScore >= 0.75,
      reason: "quality_threshold_not_met",
    },
    {
      from: "queued",
      to: "published",
      when: () => true,
      reason: "publish_condition_not_ready",
    },
    {
      from: "queued",
      to: "review_failed",
      when: ({ qualityScore }) => qualityScore < 0.4,
      reason: "quality_regression",
    },
  ],
};

export function evaluatePublishingTransition(currentState: string, context: PublishingContext, target?: string) {
  return canTransition(publishingMemoryMachine, currentState, context, target);
}
