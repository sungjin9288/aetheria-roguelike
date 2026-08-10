import { CLASSES } from '../data/classes.js';
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
                className={`min-w-0 overflow-hidden rounded-lg border border-[#d5b180]/16 bg-[#d5b180]/[0.045] px-3 py-2.5 ${className}`}
            >
                <div className="aether-type-label font-readable font-semibold text-[#d5b180]">
                    이 직업으로 남긴 것 · {job}
                </div>
                <p className="aether-type-body mt-1 break-words font-readable text-slate-300">
                    첫 원정을 떠나 이 직업의 여정을 남겨보세요.
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
    const nextDiscovery = record.skillBranches.length === 0
        ? '새로운 전투 분기'
        : record.signatureItems.length === 0
            ? '시그니처 장비'
            : record.bossNames.length === 0
                ? '처음 만나는 보스'
                : record.regions.length === 0
                    ? '새로운 지역'
                    : '새로운 지역의 보스';

    return (
        <section
            data-testid="class-journey-summary"
            className={`min-w-0 overflow-hidden rounded-lg border border-[#d5b180]/16 bg-[#d5b180]/[0.045] px-3 py-2.5 ${className}`}
        >
            <div className="aether-type-label font-readable font-semibold text-[#d5b180]">
                이 직업으로 남긴 것 · {job}
            </div>
            <div className="mt-1.5 space-y-1 font-readable text-slate-200">
                <p data-testid="class-journey-representative" className="aether-type-body break-words">
                    {isRepresentativeSummary ? '대표 원정' : '남긴 발자국'} · {region || '기록된 지역 없음'}{boss ? ` · ${boss}` : ''}
                </p>
                <p data-testid="class-journey-build" className="aether-type-body break-words">
                    전투 방식 · {discoveredBranch || '분기 미발견'}{buildDiscovery ? ` · ${buildDiscovery}` : ''}
                </p>
                <p data-testid="class-journey-next" className="aether-type-meta text-slate-400">
                    다음 기록 · {nextDiscovery}
                </p>
            </div>
        </section>
    );
};

export default ClassJourneySummary;
