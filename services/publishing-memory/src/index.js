import { PublishingEventSchema, PublishingMemoryInputFixtureSchema, PublishingMemorySnapshotSchema, DistributionBucketSchema, } from "@ifos/contracts";
function normalizeBuckets(items) {
    const total = items.length || 1;
    const buckets = new Map();
    for (const value of items) {
        buckets.set(value, (buckets.get(value) ?? 0) + 1);
    }
    const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(sorted.map(([key, count]) => [
        key,
        {
            count,
            ratio: Number((count / total).toFixed(6)),
        },
    ]));
}
function bucketFromEvents(events, key) {
    return normalizeBuckets(events.map(key));
}
function assertSingleCampaignAndJourney(events) {
    const campaignIds = new Set(events.map((event) => event.campaign_id));
    const journeyIds = new Set(events.map((event) => event.journey_id));
    if (campaignIds.size > 1) {
        throw new Error("campaign_id_mismatch: all publishing events must belong to the same campaign_id");
    }
    if (journeyIds.size > 1) {
        throw new Error("journey_id_mismatch: all publishing events must belong to the same journey_id");
    }
}
function sortPublishingEvents(events) {
    return [...events].sort((left, right) => {
        const delta = left.captured_at.localeCompare(right.captured_at);
        if (delta !== 0) {
            return delta;
        }
        return left.event_id.localeCompare(right.event_id);
    });
}
function computeCommercialDensity(events) {
    const ratio = events.filter((item) => item.commercial_signal).length / events.length;
    return Number(ratio.toFixed(6));
}
function trendFromSeries(series) {
    if (series.length < 2) {
        return { delta: 0, direction: "flat", movement_strength: 0 };
    }
    const first = series[0];
    const last = series[series.length - 1];
    const delta = last - first;
    const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
    const movement_strength = Number((delta / 100).toFixed(6));
    return {
        delta,
        direction,
        movement_strength,
    };
}
function computeRepetitionRisk(events) {
    if (events.length <= 1) {
        return 0;
    }
    const assetCounts = new Map();
    for (const event of events) {
        assetCounts.set(event.asset_id, (assetCounts.get(event.asset_id) ?? 0) + 1);
    }
    const repeated = [...assetCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
    return Number((repeated / (events.length - 1)).toFixed(6));
}
function deriveEngagementRate(events) {
    if (events.length === 0) {
        return 0;
    }
    const totalEngagement = events.reduce((sum, event) => sum + event.saves + event.shares + event.follows, 0);
    return Number((totalEngagement / events.length).toFixed(6));
}
function deriveTrend(events) {
    const engagementSeries = events.map((event) => event.saves + event.shares + event.follows);
    return trendFromSeries(engagementSeries);
}
function makeBucketSchema(bucket) {
    return DistributionBucketSchema.parse(bucket);
}
export function buildDistributionFromEvents(events) {
    const source = {
        stage_distribution: bucketFromEvents(events, (event) => event.journey_stage),
        cta_distribution: bucketFromEvents(events, (event) => event.cta),
        value_type_mix: bucketFromEvents(events, (event) => event.value_type),
        emotional_tone_mix: bucketFromEvents(events, (event) => event.emotional_tone),
    };
    return {
        stage_distribution: makeBucketSchema(source.stage_distribution),
        cta_distribution: makeBucketSchema(source.cta_distribution),
        value_type_mix: makeBucketSchema(source.value_type_mix),
        emotional_tone_mix: makeBucketSchema(source.emotional_tone_mix),
    };
}
export function buildPublishingMemory(snapshotInput) {
    const parsed = PublishingMemoryInputFixtureSchema.parse(snapshotInput);
    if (parsed.source_events.length === 0) {
        throw new Error("PublishingMemory source_events must be non-empty");
    }
    assertSingleCampaignAndJourney(parsed.source_events);
    const sortedEvents = sortPublishingEvents(parsed.source_events);
    const campaignId = sortedEvents[0].campaign_id;
    const journeyId = sortedEvents[0].journey_id;
    const distributions = buildDistributionFromEvents(sortedEvents);
    const trend = deriveTrend(sortedEvents);
    const commercialDensity = computeCommercialDensity(sortedEvents);
    const repetitionRisk = computeRepetitionRisk(sortedEvents);
    const engagementRate = deriveEngagementRate(sortedEvents);
    const payload = {
        memory_id: parsed.memory_id,
        campaign_id: campaignId,
        journey_id: journeyId,
        derived_at: sortedEvents[sortedEvents.length - 1].captured_at,
        stage_distribution: distributions.stage_distribution,
        cta_distribution: distributions.cta_distribution,
        value_type_mix: distributions.value_type_mix,
        emotional_tone_mix: distributions.emotional_tone_mix,
        commercial_density: commercialDensity,
        saves_shares_follows_trends: {
            saves_delta: sortedEvents[sortedEvents.length - 1].saves - sortedEvents[0].saves,
            shares_delta: sortedEvents[sortedEvents.length - 1].shares - sortedEvents[0].shares,
            follows_delta: sortedEvents[sortedEvents.length - 1].follows - sortedEvents[0].follows,
            direction: trend.direction,
            movement_strength: trend.movement_strength,
        },
        repetition_risk: repetitionRisk,
        engagement_rate: engagementRate,
        snapshot_version: "v1.0.0",
        source_event_ids: sortedEvents.map((event) => event.event_id),
        immutable: true,
    };
    return PublishingMemorySnapshotSchema.parse(payload);
}
export function evaluatePublishingMemory(input) {
    const parsed = PublishingMemoryInputFixtureSchema.parse(input);
    return buildPublishingMemory(parsed);
}
export function evaluatePublishingMemoryFailureCase(sourceEvents, expectedFailure) {
    const parsed = PublishingMemoryInputFixtureSchema.safeParse({
        memory_id: "failure-memory",
        source_events: sourceEvents,
    });
    if (parsed.success) {
        return false;
    }
    const message = parsed.error.issues.map((issue) => issue.message).join(";");
    return message.includes(expectedFailure);
}
export function normalizePublishingEventRows(events) {
    return events.map((event) => PublishingEventSchema.parse(event));
}
export { buildCanonicalChain } from "@ifos/contracts";
