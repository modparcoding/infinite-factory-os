import fs from "node:fs/promises";

import { buildAttributionLineage } from "@ifos/services-measurement";
import { buildPublishingMemory } from "@ifos/services-publishing-memory";
import { deriveRelationshipStateFromInput, deriveRelationshipStateFromMemory } from "@ifos/services-relationship-state";

function asNonEmptyTuple(items) {
  if (!items.length) {
    throw new Error("expected non-empty source events");
  }
  return items;
}

function topStageRatio(snapshot) {
  const values = Object.values(snapshot.stage_distribution);
  return values.length ? Math.max(...values.map((entry) => entry.ratio)) : 0;
}

async function main() {
  const laneRaw = await fs.readFile("tests/replay/baby-sleep-proving-lane.json", "utf-8");
  const lane = JSON.parse(laneRaw);

  const stageMap = new Map(lane.journey_stages.map((stage) => [stage.journey_stage_id, stage]));
  const arcMap = new Map(lane.value_arcs.map((arc) => [arc.value_arc_id, arc]));
  const themeMap = new Map(lane.campaign_themes.map((theme) => [theme.theme_id, theme]));
  const eventByAsset = new Map(lane.publishing_sequence.map((event) => [event.asset_id, event]));
  const canonicalJourneyStages = [...lane.journey_stages];
  const canonicalValueArcs = [...lane.value_arcs];

  const backlogItems = lane.backlog_items.map((item) => ({
    backlog_id: item.backlog_id,
    campaign_id: item.campaign_id,
    title: item.title,
    priority: item.priority,
    value: item.value,
    journey_stage: item.journey_stage,
    journey_stage_label: item.journey_stage_label,
    value_arc_id: item.value_arc_id,
    value_arc_label: item.value_arc_label,
    campaign_theme_id: item.campaign_theme_id,
    relationship_objective: item.relationship_objective,
    audience_state_before: item.audience_state_before,
    audience_state_after: item.audience_state_after,
    cta_policy: item.cta_policy,
    commercial_intent: item.commercial_intent,
    hook_direction: item.hook_direction,
    emotional_tone: item.emotional_tone,
    success_metric: item.success_metric,
    attribution_ids: item.attribution_ids,
  }));

  await fs.writeFile("tests/replay/backlog-items.json", `${JSON.stringify(backlogItems, null, 2)}\n`, "utf-8");
  await fs.writeFile("tests/replay/journey-stages.json", `${JSON.stringify(lane.journey_stages, null, 2)}\n`, "utf-8");

  const attributionCases = lane.backlog_items.map((item) => {
    const stage = stageMap.get(item.journey_stage);
    const arc = arcMap.get(item.value_arc_id);
    const theme = themeMap.get(item.campaign_theme_id);
    const event = eventByAsset.get(item.attribution_ids.asset_id);
    if (!stage || !arc || !theme || !event) {
      throw new Error(`incomplete lineage mapping for ${item.backlog_id}`);
    }

    const publishedAt = new Date(event.captured_at);
    const publishedAtIso = new Date(publishedAt.getTime() + 4 * 60 * 1000).toISOString();
    const capturedAtIso = new Date(publishedAt.getTime() + 28 * 60 * 1000).toISOString();
    const isMonetization = stage.journey_stage_id === "stage-baby-monetization";

    const source = {
      audience_journey: lane.audience_journey,
      journey_stages: canonicalJourneyStages.map((journeyStage) => ({
        journey_stage_id: journeyStage.journey_stage_id,
        journey_id: journeyStage.journey_id,
        name: journeyStage.name,
        sequence_order: journeyStage.sequence_order,
        trust_gate: journeyStage.trust_gate,
      })),
      value_arcs: canonicalValueArcs.map((valueArc) => ({
        value_arc_id: valueArc.value_arc_id,
        journey_id: valueArc.journey_id,
        label: valueArc.label,
        campaign_id: valueArc.campaign_id,
        stage_id: valueArc.stage_id,
      })),
      campaign_theme: {
        theme_id: theme.theme_id,
        label: theme.label,
        narrative: theme.narrative,
        campaign_id: theme.campaign_id,
      },
      campaign: {
        campaign_id: lane.campaign.campaign_id,
        campaign_name: lane.campaign.campaign_name,
        campaign_theme: theme.theme_id,
        objective: lane.campaign.objective,
        value_arc_ids: lane.campaign.value_arc_ids,
      },
      backlog_item: {
        backlog_id: item.backlog_id,
        title: item.title,
        priority: item.priority,
        campaign_id: item.campaign_id,
        value: item.value,
      },
      asset: {
        asset_id: item.attribution_ids.asset_id,
        source: "rendered-replay-asset",
        url: `https://cdn.infinite-factory.test/baby-sleep/${item.attribution_ids.asset_id}.mp4`,
        campaign_id: item.campaign_id,
        journey_stage_id: stage.journey_stage_id,
        stage_id: stage.journey_stage_id,
        backlog_id: item.backlog_id,
      },
      published_post: {
        published_post_id: item.attribution_ids.published_post_id,
        asset_id: item.attribution_ids.asset_id,
        platform: "instagram",
        published_at: publishedAtIso,
        platform_post_id: `ig-${item.attribution_ids.published_post_id}`,
      },
      performance_record: {
        performance_id: item.attribution_ids.performance_record_id,
        published_post_id: item.attribution_ids.published_post_id,
        impressions: 4200 + Number(item.backlog_id.split("-").at(-1)) * 310,
        engagement: event.saves + event.shares + event.follows,
        revenue: isMonetization ? 19.99 + Number(item.backlog_id.split("-").at(-1)) : 0,
        engagement_snapshot: {
          saves: event.saves,
          shares: event.shares,
          follows: event.follows,
        },
        captured_at: capturedAtIso,
      },
    };

    const chain = buildAttributionLineage({
      source,
      chain_id: item.attribution_ids.chain_id,
      chain_owner: "proof-agent",
    });

    return {
      case_id: `ATY-BABY-PROOF-${item.backlog_id.replace("bl-baby-sleep-", "")}`,
      seed: {
        source,
        chain_id: item.attribution_ids.chain_id,
        chain_owner: "proof-agent",
      },
      expected_signature: chain.deterministic_signature,
    };
  });

  await fs.writeFile(
    "tests/replay/attribution-lineage.snapshots.json",
    `${JSON.stringify(attributionCases, null, 2)}\n`,
    "utf-8",
  );

  const checkpointIndexes = [3, 6, 9, 12, 15, 18];
  const memoryByCheckpoint = new Map(
    checkpointIndexes
      .filter((index) => lane.publishing_sequence.length >= index)
      .map((index) => {
        const memory = buildPublishingMemory({
          memory_id: `memory-baby-sleep-proof-${String(index).padStart(2, "0")}`,
          source_events: asNonEmptyTuple(lane.publishing_sequence.slice(0, index)),
        });
        return [index, memory];
      }),
  );

  const fullMemory = memoryByCheckpoint.get(lane.publishing_sequence.length) ?? buildPublishingMemory({
    memory_id: "memory-baby-sleep-proof-full",
    source_events: asNonEmptyTuple(lane.publishing_sequence),
  });

  const publishingCases = checkpointIndexes
    .filter((index) => lane.publishing_sequence.length >= index)
    .map((index) => ({
      case_id: `PM-BABY-PROOF-${String(index).padStart(2, "0")}`,
      input_events: lane.publishing_sequence.slice(0, index),
      expected_snapshot: memoryByCheckpoint.get(index),
    }));

  await fs.writeFile(
    "tests/replay/publishing-memory.snapshots.json",
    `${JSON.stringify(publishingCases, null, 2)}\n`,
    "utf-8",
  );

  const progressionSteps = [
    { memoryIndex: 6, trust_score: 0.12, caseId: "RLS-BABY-PROOF-001", relationshipId: "rel-baby-sleep-proof-001" },
    { memoryIndex: 12, trust_score: 0.39, caseId: "RLS-BABY-PROOF-002", relationshipId: "rel-baby-sleep-proof-002" },
    { memoryIndex: 15, trust_score: 0.62, caseId: "RLS-BABY-PROOF-003", relationshipId: "rel-baby-sleep-proof-003" },
    { memoryIndex: 18, trust_score: 0.86, caseId: "RLS-BABY-PROOF-004", relationshipId: "rel-baby-sleep-proof-004" },
    { memoryIndex: 18, trust_score: 0.86, caseId: "RLS-BABY-PROOF-TRUSTED", relationshipId: "rel-baby-sleep-proof-005", previousTrustLevel: "trusted" },
  ];

  const relationshipCases = progressionSteps.map((step, index) => {
    const memory = memoryByCheckpoint.get(step.memoryIndex);
    const output = deriveRelationshipStateFromInput({
      relationship_id: step.relationshipId,
      campaign_id: lane.campaign.campaign_id,
      journey_id: lane.audience_journey.journey_id,
      memory_id: memory.memory_id,
      trust_score: step.trust_score,
      commercial_density: memory.commercial_density,
      repetition_risk: memory.repetition_risk,
      journey_stage_ratio: topStageRatio(memory),
      previous_trust_level: step.previousTrustLevel ?? (index === 0 ? undefined : progressionSteps[index - 1].expectedState?.trust_level),
    });

    const derivedState = output.relationship_state;
    progressionSteps[index].expectedState = derivedState;

    return {
      case_id: step.caseId,
      input: {
        relationship_id: step.relationshipId,
        campaign_id: lane.campaign.campaign_id,
        journey_id: lane.audience_journey.journey_id,
        memory_id: memory.memory_id,
        trust_score: step.trust_score,
        commercial_density: memory.commercial_density,
        repetition_risk: memory.repetition_risk,
        journey_stage_ratio: topStageRatio(memory),
        ...(step.previousTrustLevel ? { previous_trust_level: step.previousTrustLevel } : {}),
      },
      expected_state: {
        relationship_id: step.relationshipId,
        trust_level: derivedState.trust_level,
        trust_score: derivedState.trust_score,
        campaign_id: lane.campaign.campaign_id,
        journey_id: lane.audience_journey.journey_id,
      },
    };
  });

  await fs.writeFile(
    "tests/replay/relationship-state.snapshots.json",
    `${JSON.stringify(relationshipCases, null, 2)}\n`,
    "utf-8",
  );

  const endToEnd = {
    case_id: "E2E-BABY-SLEEP-PROOF-001",
    attribution_seed: {
      source: attributionCases[0].seed.source,
      chain_id: attributionCases[0].seed.chain_id,
      chain_owner: attributionCases[0].seed.chain_owner,
    },
    publishing_events: lane.publishing_sequence,
    expected_signature: buildAttributionLineage(attributionCases[0].seed).deterministic_signature,
    expected_memory_id: fullMemory.memory_id,
    expected_relationship_state: {
      relationship_id: `rel-${lane.audience_journey.journey_id}`,
      campaign_id: lane.campaign.campaign_id,
      journey_id: lane.audience_journey.journey_id,
      trust_level: "",
      trust_score: 0,
    },
  };

  const endToEndRelationship = deriveRelationshipStateFromMemory(fullMemory);

  endToEnd.expected_relationship_state.trust_level = endToEndRelationship.relationship_state.trust_level;
  endToEnd.expected_relationship_state.trust_score = endToEndRelationship.relationship_state.trust_score;

  await fs.writeFile(
    "tests/replay/end-to-end-attribution-publishing-relationship.json",
    `${JSON.stringify([endToEnd], null, 2)}\n`,
    "utf-8",
  );

  const engagementReplay = lane.publishing_sequence.map((event) => ({
    replay_id: event.event_id,
    captured_at: event.captured_at,
    journey_id: event.journey_id,
    journey_stage_id: event.journey_stage,
    asset_id: event.asset_id,
    saves: event.saves,
    shares: event.shares,
    follows: event.follows,
    commercial_signal: event.commercial_signal,
  }));

  await fs.writeFile(
    "tests/replay/engagement-replays.json",
    `${JSON.stringify(engagementReplay, null, 2)}\n`,
    "utf-8",
  );

  await fs.writeFile(
    "tests/replay/baby-sleep-proving-lane.json",
    `${JSON.stringify(lane, null, 2)}\n`,
    "utf-8",
  );

  console.log(
    JSON.stringify(
      {
        generated: {
          attribution_cases: attributionCases.length,
          backlog_items: backlogItems.length,
          publishing_cases: publishingCases.length,
          relationship_cases: relationshipCases.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
