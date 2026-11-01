import { CLASSES } from '../data/classes.js';
import { MSG } from '../data/messages';
import type { ClassJourneyRecord, ExpeditionSummary } from '../types/player.js';

interface ClassJourneySummaryProps {
    job: string;
    record?: ClassJourneyRecord;
    latestSummary?: ExpeditionSummary | null;
    className?: string;
}

const last = <T,>(values?: T[]) => values?.[values.length - 1];

const branchLabel = (job: string, branchId?: string) => {
    if (!branchId) return null;
    const separator = branchId.lastIndexOf(':');
    if (separator < 1) return branchId;

    const skillName = branchId.slice(0, separator);
    const choice = branchId.slice(separator + 1);
    const branch = CLASSES[job]?.skillBranches?.[skillName]?.find((candidate) => candidate.choice === choice);
    return branch?.label || skillName;
};

const summaryBranchId = (job: string, skillChoices?: Record<string, string>) => {
    const branchSkills = CLASSES[job]?.skillBranches;
    if (!branchSkills || !skillChoices) return undefined;

    const skillName = Object.keys(branchSkills).find((name) => skillChoices[name]);
    return skillName ? `${skillName}:${skillChoices[skillName]}` : undefined;
};

const ClassJourneySummary = ({
    job,
    record,
    latestSummary,
    className = '',
}: ClassJourneySummaryProps) => {
    if (!record || record.expeditionIds.length === 0) {
        return (
            <section
                data-testid="class-journey-summary"
                className={`ae-well ae-class-journey min-w-0 overflow-hidden px-3 py-2.5 ${className}`}
            >
                <div className="aether-type-label font-readable font-semibold text-ae-gold-text">
                    {MSG.CLASS_JOURNEY_TITLE(job)}
                </div>
                <p className="aether-type-body mt-1 break-words font-readable text-ae-ink-2">
                    {MSG.CLASS_JOURNEY_EMPTY}
                </p>
            </section>
        );
    }

    const isRepresentativeSummary = latestSummary?.job === job
        && latestSummary.id === record.representativeExpeditionId;
    const region = isRepresentativeSummary
        ? latestSummary.lastLocation || latestSummary.destination
        : last(record.regions);
    const boss = isRepresentativeSummary ? last(latestSummary.bossNames) : last(record.bossNames);
    const discoveredBranch = branchLabel(
        job,
        isRepresentativeSummary
            ? summaryBranchId(job, latestSummary.skillChoices)
            : last(record.skillBranches),
    );
    const signature = isRepresentativeSummary
        ? last(latestSummary.signatureItems) || last(record.signatureItems)
        : last(record.signatureItems);
    const equipment = isRepresentativeSummary ? last(latestSummary.equipmentNames) : null;
    const buildDiscovery = signature || equipment;
    const encounterDiscovery = isRepresentativeSummary
        ? last(latestSummary.encounterDiscoveries) || last(record.encounterDiscoveries)
        : last(record.encounterDiscoveries);
    const nextDiscovery = record.skillBranches.length === 0
        ? MSG.CLASS_JOURNEY_NEXT_BRANCH
        : record.signatureItems.length === 0
            ? MSG.CLASS_JOURNEY_NEXT_SIGNATURE
            : record.bossNames.length === 0
                ? MSG.CLASS_JOURNEY_NEXT_BOSS
                : record.regions.length === 0
                    ? MSG.CLASS_JOURNEY_NEXT_REGION
                    : record.encounterDiscoveries.length === 0
                        ? MSG.CLASS_JOURNEY_NEXT_ENCOUNTER
                        : MSG.CLASS_JOURNEY_NEXT_REGION_BOSS;

    return (
        <section
            data-testid="class-journey-summary"
            className={`ae-well ae-class-journey min-w-0 overflow-hidden px-3 py-2.5 ${className}`}
        >
            <div className="aether-type-label font-readable font-semibold text-ae-gold-text">
                {MSG.CLASS_JOURNEY_TITLE(job)}
            </div>
            <div className="mt-1.5 space-y-1 font-readable text-ae-ink">
                <p data-testid="class-journey-representative" className="aether-type-body break-words">
                    {isRepresentativeSummary ? MSG.CLASS_JOURNEY_REPRESENTATIVE : MSG.CLASS_JOURNEY_FOOTPRINT} · {region || MSG.CLASS_JOURNEY_NO_REGION}{boss ? ` · ${boss}` : ''}
                </p>
                <p data-testid="class-journey-build" className="aether-type-body break-words">
                    {MSG.CLASS_JOURNEY_BUILD} · {discoveredBranch || MSG.CLASS_JOURNEY_NO_BRANCH}{buildDiscovery ? ` · ${buildDiscovery}` : ''}
                </p>
                {encounterDiscovery && (
                    <p
                        data-testid="class-journey-encounter"
                        className="aether-type-body break-words text-ae-ink-2"
                    >
                        {MSG.CLASS_JOURNEY_ENCOUNTER} · {encounterDiscovery.family} · {encounterDiscovery.choiceLabel}
                    </p>
                )}
                <p data-testid="class-journey-next" className="aether-type-meta text-ae-ink-3">
                    {MSG.CLASS_JOURNEY_NEXT} · {nextDiscovery}
                </p>
            </div>
        </section>
    );
};

export default ClassJourneySummary;
