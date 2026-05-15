# ADR-0002 Attribution Lineage Mandatory

Status: Accepted

Rationale:
- Monetization and trust decisions must remain explainable and attributable.

Decision:
- Canonical chain is `AudienceJourney -> JourneyStage -> ValueArc -> Campaign -> CampaignTheme -> BacklogItem -> Asset -> PublishedPost -> PerformanceRecord`.
- Replay fixtures must preserve this order for testing and audit.
