import { canTransition, StateMachine } from "./orchestrator-state.js";

export interface RelationshipContext {
  trustDelta: number;
  lastSignalConfidence: number;
}

export interface RelationshipStateMachineSnapshot {
  journey_stage: string;
  trust_level: string;
}

export const relationshipStateMachine: StateMachine<RelationshipContext, RelationshipStateMachineSnapshot> = {
  name: "relationship-stage-state",
  stateField: "journey_stage",
  states: ["not_started", "intro", "nurture", "activation", "close"],
  transitions: [
    {
      from: "not_started",
      to: "intro",
      when: ({ trustDelta }) => trustDelta > 0,
      reason: "insufficient_trust_signal",
    },
    {
      from: "intro",
      to: "nurture",
      when: ({ trustDelta }) => trustDelta >= 2,
      reason: "trust_gate_not_met",
    },
    {
      from: "nurture",
      to: "activation",
      when: ({ trustDelta, lastSignalConfidence }) => trustDelta >= 1 && lastSignalConfidence >= 0.8,
      reason: "signal_confidence_low",
    },
    {
      from: "activation",
      to: "close",
      when: ({ trustDelta }) => trustDelta > 0,
      reason: "activation_complete_gate_not_met",
    },
  ],
};

export function evaluateRelationshipTransition(currentState: string, context: RelationshipContext, target?: string) {
  return canTransition(relationshipStateMachine, currentState, context, target);
}
