import { BALANCE } from '../data/constants.js';

const CHAIN_REWARD_TYPES = new Set([
    'combat_bonus',
    'gold',
    'info',
    'item',
    'legendary_item',
    'relic',
    'stat_bonus',
]);
const CHAIN_OUTCOME_TYPES = new Set(['chain_advance', 'chain_advance_fail', 'nothing']);
const NUMERIC_REWARD_FIELDS = ['amount', 'atk', 'atkMult', 'def', 'duration', 'hp', 'mp'];

const compareText = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

/**
 * 이 감사가 받는 입력은 5개 데이터 파일(eventChains/boundedEncounters/
 * structuredFallbackEvents/maps/items/relics) + 2개 빌더(campfireEvent/scoutEvent) 산출물이다.
 * 전부 `Array.isArray`/`typeof`로 방어적으로 파싱하므로(런타임 계약이 곧 이 파일의 목적) 이 계약이
 * 이 파일의 타입이다 — 리프 값은 `unknown`(검증 전이라 확정 불가), 컨테이너는 얕은 형태만 선언한다.
 * (`Array.isArray(x) ? x : []`가 변수 어노테이션 없이는 표준 lib 타입상 전체가 `any`로
 * 뭉개져 콜백 파라미터 noImplicitAny를 유발하므로, 아래 모든 그런 자리는 선언된 배열 타입을 갖는다.)
 */
interface ItemCatalogEntry {
    name: string;
    tier?: unknown;
    [key: string]: unknown;
}

const itemCatalog = (items: Record<string, unknown> | undefined): Map<string, ItemCatalogEntry> => new Map(
    Object.values(items || {})
        .flatMap((bucket): ItemCatalogEntry[] => Array.isArray(bucket) ? bucket : [])
        .filter((item) => typeof item?.name === 'string')
        .map((item): [string, ItemCatalogEntry] => [item.name, item]),
);

const highestAvailableTier = (level: number) => (
    Object.entries(BALANCE.TIER_REQ_LEVEL)
        .filter(([, requiredLevel]) => Number(requiredLevel) <= level)
        .reduce((highest, [tier]) => Math.max(highest, Number(tier)), 1)
);

const isFiniteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

interface ChainRewardInput {
    type?: string;
    name?: string;
    relicId?: string;
    [field: string]: unknown;
}

interface ChainOutcomeInput {
    type?: string;
    reward?: ChainRewardInput | null;
}

interface ChainStepInput {
    step?: number;
    loc?: string;
    event?: {
        choices?: unknown[];
        outcomes?: ChainOutcomeInput[];
    };
}

interface EventChainInput {
    id?: string;
    steps?: ChainStepInput[];
}

interface MapEntryInput {
    level?: unknown;
    boss?: unknown;
    monsters?: unknown;
}

interface BoundedChoiceInput {
    id?: string;
    cost?: Record<string, unknown>;
    outcome?: { item?: string; gold?: unknown; buff?: unknown } & Record<string, unknown>;
}

interface BoundedEncounterInput {
    id?: string;
    region?: string;
    choices?: BoundedChoiceInput[];
}

interface FallbackTransactionInput {
    id?: unknown;
    cost?: { type?: string; amount?: unknown };
    grossGold?: unknown;
    netGold?: unknown;
}

interface BuiltEventOutcome {
    scoutEffect?: unknown;
    buff?: unknown;
}

interface ChoiceOutcomeEvent {
    choices?: unknown[];
    outcomes?: BuiltEventOutcome[];
}

interface EventRewardCoherenceInput {
    chains?: unknown;
    boundedEncounters?: unknown;
    fallbackTransactions?: unknown;
    campfireEvent?: ChoiceOutcomeEvent | null;
    scoutEvent?: ChoiceOutcomeEvent | null;
    maps?: Record<string, MapEntryInput>;
    items?: Record<string, unknown>;
    relics?: unknown;
    frequency?: {
        scoutChance?: unknown;
        campfireChance?: unknown;
        eventMultiplier?: unknown;
        minimumNarrativeGap?: unknown;
    };
}

export interface EventRewardCoherenceReport {
    schemaVersion: 1;
    catalog: {
        chainCount: number;
        chainStepCount: number;
        chainOutcomeCount: number;
        boundedEncounterCount: number;
        boundedChoiceCount: number;
        fallbackTransactionCount: number;
        campfireChoiceCount: number;
        scoutChoiceCount: number;
    };
    frequency: {
        scoutChance: number;
        campfireChance: number;
        eventMultiplier: number;
        minimumNarrativeGap: number;
    };
    rows: Array<Record<string, unknown>>;
    errors: string[];
}

export const canonicalizeEventRewardCoherenceReport = (
    report: EventRewardCoherenceReport,
): EventRewardCoherenceReport => ({
    schemaVersion: 1,
    catalog: { ...report.catalog },
    frequency: { ...report.frequency },
    rows: report.rows.map((row) => ({ ...row })).sort((left, right) => (
        compareText(String(left.id), String(right.id))
    )),
    errors: [...new Set(report.errors)].sort(compareText),
});

export const buildEventRewardCoherenceReport = ({
    chains,
    boundedEncounters,
    fallbackTransactions,
    campfireEvent,
    scoutEvent,
    maps,
    items,
    relics,
    frequency,
}: EventRewardCoherenceInput): EventRewardCoherenceReport => {
    const errors = new Set<string>();
    const rows: Array<Record<string, unknown>> = [];
    const knownItems = itemCatalog(items);
    const relicList: Array<{ id?: string }> = Array.isArray(relics) ? relics : [];
    const knownRelics = new Set(relicList.map((relic) => relic?.id));
    const chainList: EventChainInput[] = Array.isArray(chains) ? chains : [];
    const boundedList: BoundedEncounterInput[] = Array.isArray(boundedEncounters) ? boundedEncounters : [];
    const fallbackList: FallbackTransactionInput[] = Array.isArray(fallbackTransactions) ? fallbackTransactions : [];

    let chainStepCount = 0;
    let chainOutcomeCount = 0;
    const chainIds = new Set<string>();
    for (const chain of chainList) {
        const chainId = typeof chain?.id === 'string' ? chain.id : '<invalid>';
        if (chainIds.has(chainId)) errors.add(`CHAIN_ID_DUPLICATE:${chainId}`);
        chainIds.add(chainId);
        const steps: ChainStepInput[] = Array.isArray(chain?.steps) ? chain.steps : [];
        chainStepCount += steps.length;
        steps.forEach((stepData, stepIndex: number) => {
            const step = stepData?.step;
            if (step !== stepIndex) errors.add(`CHAIN_STEP_INVALID:${chainId}:${String(step)}`);
            const location = stepData?.loc;
            const map = maps?.[location ?? ''];
            if (!map) errors.add(`CHAIN_LOCATION_UNKNOWN:${chainId}:${String(step)}:${String(location)}`);
            const choices: unknown[] = Array.isArray(stepData?.event?.choices) ? stepData.event.choices : [];
            const outcomes: ChainOutcomeInput[] = Array.isArray(stepData?.event?.outcomes) ? stepData.event.outcomes : [];
            if (choices.length !== outcomes.length || choices.length < 2) {
                errors.add(`CHAIN_CHOICE_OUTCOME_MISMATCH:${chainId}:${String(step)}`);
            }
            chainOutcomeCount += outcomes.length;
            outcomes.forEach((outcome, choiceIndex: number) => {
                const id = `chain:${chainId}:${String(step)}:${choiceIndex}`;
                const reward = outcome?.reward;
                const rewardType = reward?.type ?? null;
                if (!CHAIN_OUTCOME_TYPES.has(String(outcome?.type))) {
                    errors.add(`CHAIN_OUTCOME_TYPE_INVALID:${chainId}:${String(step)}:${choiceIndex}`);
                }
                if (reward && !CHAIN_REWARD_TYPES.has(String(rewardType))) {
                    errors.add(`CHAIN_REWARD_TYPE_INVALID:${chainId}:${String(step)}:${choiceIndex}:${String(rewardType)}`);
                }
                if (reward) {
                    for (const field of NUMERIC_REWARD_FIELDS) {
                        if (Object.hasOwn(reward, field) && !isFiniteNumber(reward[field])) {
                            errors.add(`CHAIN_REWARD_NUMBER_INVALID:${chainId}:${String(step)}:${choiceIndex}:${field}`);
                        }
                    }
                }

                const itemName = rewardType === 'item' || rewardType === 'legendary_item'
                    ? reward?.name
                    : null;
                const item = typeof itemName === 'string' ? knownItems.get(itemName) : null;
                if (itemName && !item) {
                    errors.add(`CHAIN_ITEM_UNKNOWN:${chainId}:${String(step)}:${choiceIndex}:${itemName}`);
                }
                if (item && Number.isFinite(Number(map?.level)) && Number.isFinite(Number(item.tier))) {
                    const expectedMinimum = Math.max(1, highestAvailableTier(Number(map?.level)) - 1);
                    if (Number(item.tier) < expectedMinimum) {
                        errors.add(
                            `CHAIN_ITEM_TIER_TOO_LOW:${chainId}:${String(step)}:${choiceIndex}:${itemName}:T${String(item.tier)}:MIN_T${expectedMinimum}`,
                        );
                    }
                }

                const relicId = reward?.relicId;
                if (relicId && !knownRelics.has(relicId)) {
                    errors.add(`CHAIN_RELIC_UNKNOWN:${chainId}:${String(step)}:${choiceIndex}:${String(relicId)}`);
                }
                rows.push({
                    id,
                    occurrenceClass: 'one-time-chain',
                    location,
                    mapLevel: map?.level ?? null,
                    outcomeType: outcome?.type ?? null,
                    rewardType,
                    itemName,
                    itemTier: item?.tier ?? null,
                    relicId: relicId ?? null,
                });
            });
        });
    }

    const boundedIds = new Set<string>();
    let boundedChoiceCount = 0;
    for (const encounter of boundedList) {
        const encounterId = typeof encounter?.id === 'string' ? encounter.id : '<invalid>';
        if (boundedIds.has(encounterId)) errors.add(`BOUNDED_ID_DUPLICATE:${encounterId}`);
        boundedIds.add(encounterId);
        if (!maps?.[encounter?.region ?? '']) errors.add(`BOUNDED_LOCATION_UNKNOWN:${encounterId}:${String(encounter?.region)}`);
        const choices = Array.isArray(encounter?.choices) ? encounter.choices : [];
        boundedChoiceCount += choices.length;
        if (choices.length !== 2) errors.add(`BOUNDED_CHOICE_COUNT_INVALID:${encounterId}`);
        for (const choice of choices) {
            const choiceId = typeof choice?.id === 'string' ? choice.id : '<invalid>';
            const sections: Array<['cost' | 'outcome', Record<string, unknown> | undefined]> = [
                ['cost', choice?.cost],
                ['outcome', choice?.outcome],
            ];
            for (const [section, sectionValue] of sections) {
                for (const [field, value] of Object.entries(sectionValue || {})) {
                    if (['gold', 'hp', 'mp'].includes(field) && !isFiniteNumber(value)) {
                        errors.add(`BOUNDED_NUMBER_INVALID:${encounterId}:${choiceId}:${section}.${field}`);
                    }
                }
            }
            const itemName = choice?.outcome?.item;
            if (itemName && !knownItems.has(itemName)) {
                errors.add(`BOUNDED_ITEM_UNKNOWN:${encounterId}:${choiceId}:${String(itemName)}`);
            }
            rows.push({
                id: `bounded:${encounterId}:${choiceId}`,
                occurrenceClass: 'repeatable-bounded',
                location: encounter?.region ?? null,
                rewardType: itemName ? 'item' : choice?.outcome?.gold ? 'gold' : choice?.outcome?.buff ? 'buff' : 'recovery',
                itemName: itemName ?? null,
            });
        }
    }

    for (const transaction of fallbackList) {
        const id = String(transaction?.id);
        const amount = transaction?.cost?.amount;
        const grossGold = transaction?.grossGold;
        const netGold = transaction?.netGold;
        // isSafeInteger가 true인 뒤에만 산술 비교가 실행되므로(||의 단락 평가) 이 지점에선
        // 실제로 유한 정수임이 보장된다 — Number(...)는 그 사실을 타입에 반영하는 항등 변환.
        if (!Number.isSafeInteger(amount) || Number(amount) <= 0
            || !Number.isSafeInteger(grossGold) || Number(grossGold) < 0
            || !Number.isSafeInteger(netGold) || Number(netGold) < 0) {
            errors.add(`FALLBACK_NUMBER_INVALID:${id}`);
        } else {
            const expectedNet = transaction?.cost?.type === 'gold' ? Number(grossGold) - Number(amount) : Number(grossGold);
            if (netGold !== expectedNet) errors.add(`FALLBACK_NET_MISMATCH:${id}`);
        }
        rows.push({
            id: `fallback:${id}`,
            occurrenceClass: 'repeatable-fallback',
            costType: transaction?.cost?.type ?? null,
            costAmount: amount ?? null,
            grossGold: grossGold ?? null,
            netGold: netGold ?? null,
        });
    }

    const addBuiltEventRows = (occurrenceClass: string, event: ChoiceOutcomeEvent | null | undefined) => {
        const choices = Array.isArray(event?.choices) ? event.choices : [];
        const outcomes = Array.isArray(event?.outcomes) ? event.outcomes : [];
        if (choices.length !== outcomes.length) errors.add(`${occurrenceClass.toUpperCase()}_CHOICE_OUTCOME_MISMATCH`);
        outcomes.forEach((outcome, choiceIndex: number) => {
            rows.push({
                id: `${occurrenceClass}:${choiceIndex}`,
                occurrenceClass,
                rewardType: outcome?.scoutEffect || (outcome?.buff ? 'buff' : 'recovery'),
            });
        });
    };
    addBuiltEventRows('campfire', campfireEvent);
    addBuiltEventRows('scout', scoutEvent);

    // 리포트 스키마(EventRewardCoherenceReport.frequency)는 number로 닫혀 있다 — 검증은
    // 아래 루프가 하고, 결과는(유효하든 아니든) 입력값을 그대로 투영한다.
    const frequencySnapshot: EventRewardCoherenceReport['frequency'] = {
        scoutChance: frequency?.scoutChance as number,
        campfireChance: frequency?.campfireChance as number,
        eventMultiplier: frequency?.eventMultiplier as number,
        minimumNarrativeGap: frequency?.minimumNarrativeGap as number,
    };
    for (const [field, value] of Object.entries(frequencySnapshot)) {
        const isGap = field === 'minimumNarrativeGap';
        const valid = isGap
            ? Number.isSafeInteger(value) && Number(value) >= 1
            : isFiniteNumber(value) && Number(value) > 0 && Number(value) <= 1;
        if (!valid) errors.add(`FREQUENCY_INVALID:${field}`);
    }

    if (chainList.length !== 13) errors.add('CHAIN_COUNT_MISMATCH');
    if (chainStepCount !== 39) errors.add('CHAIN_STEP_COUNT_MISMATCH');
    if (chainOutcomeCount !== 84) errors.add('CHAIN_OUTCOME_COUNT_MISMATCH');
    if (boundedList.length !== 8) errors.add('BOUNDED_COUNT_MISMATCH');
    if (boundedChoiceCount !== 16) errors.add('BOUNDED_CHOICE_COUNT_MISMATCH');
    if (fallbackList.length !== 3) errors.add('FALLBACK_COUNT_MISMATCH');
    if (campfireEvent?.choices?.length !== 2) errors.add('CAMPFIRE_CHOICE_COUNT_MISMATCH');
    if (scoutEvent?.choices?.length !== 3) errors.add('SCOUT_CHOICE_COUNT_MISMATCH');

    return canonicalizeEventRewardCoherenceReport({
        schemaVersion: 1,
        catalog: {
            chainCount: chainList.length,
            chainStepCount,
            chainOutcomeCount,
            boundedEncounterCount: boundedList.length,
            boundedChoiceCount,
            fallbackTransactionCount: fallbackList.length,
            campfireChoiceCount: campfireEvent?.choices?.length ?? 0,
            scoutChoiceCount: scoutEvent?.choices?.length ?? 0,
        },
        frequency: frequencySnapshot,
        rows,
        errors: [...errors],
    });
};
