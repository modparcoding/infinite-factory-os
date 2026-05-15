export type TransitionOutcome = "ok" | "blocked" | "invalid";

export interface StateTransition<Context> {
  from: string;
  to: string;
  when: (context: Context) => boolean;
  reason: string;
}

export interface StateMachine<Context, Snapshot> {
  name: string;
  stateField: keyof Snapshot;
  states: string[];
  transitions: StateTransition<Context>[];
}

export function canTransition<Context, Snapshot>(
  machine: StateMachine<Context, Snapshot>,
  state: string,
  context: Context,
  target?: string,
): { allowed: boolean; outcome: TransitionOutcome; reason: string } {
  const transition = machine.transitions.find((item) => item.from === state && (!target || item.to === target));
  if (!transition) {
    return { allowed: false, outcome: "invalid", reason: "transition_not_defined" };
  }

  const allowed = transition.when(context);
  return {
    allowed,
    outcome: allowed ? "ok" : "blocked",
    reason: allowed ? "ok" : transition.reason,
  };
}

