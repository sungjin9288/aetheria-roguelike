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

const itemCatalog = (items: any) => new Map(
    Object.values(items || {})
        .flatMap((bucket) => Array.isArray(bucket) ? bucket : [])
        .filter((item: any) => typeof item?.name === 'string')
        .map((item: any) => [item.name, item]),
);

const highestAvailableTier = (level: number) => (
    Object.entries(BALANCE.TIER_REQ_LEVEL)
        .filter(([, requiredLevel]) => Number(requiredLevel) <= level)
        .reduce((highest, [tier]) => Math.max(highest, Number(tier)), 1)
);

const isFiniteNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

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
}: any): EventRewardCoherenceReport => {
    const errors = new Set<string>();
    const rows: Array<Record<string, unknown>> = [];
    const knownItems = itemCatalog(items);
    const knownRelics = new Set((Array.isArray(relics) ? relics : []).map((relic) => relic?.id));
    const chainList = Array.isArray(chains) ? chains : [];
    const boundedList = Array.isArray(boundedEncounters) ? boundedEncounters : [];
    const fallbackList = Array.isArray(fallbackTransactions) ? fallbackTransactions : [];

    let chainStepCount = 0;
    let chainOutcomeCount = 0;
    const chainIds = new Set<string>();
    for (const chain of chainList) {
        const chainId = typeof chain?.id === 'string' ? chain.id : '<invalid>';
        if (chainIds.has(chainId)) errors.add(`CHAIN_ID_DUPLICATE:${chainId}`);
        chainIds.add(chainId);
        const steps = Array.isArray(chain?.steps) ? chain.steps : [];
        chainStepCount += steps.length;
        steps.forEach((stepData: any, stepIndex: number) => {
            const step = stepData?.step;
            if (step !== stepIndex) errors.add(`CHAIN_STEP_INVALID:${chainId}:${String(step)}`);
            const location = stepData?.loc;
            const map = maps?.[location];
            if (!map) errors.add(`CHAIN_LOCATION_UNKNOWN:${chainId}:${String(step)}:${String(location)}`);
            const choices = Array.isArray(stepData?.event?.choices) ? stepData.event.choices : [];
            const outcomes = Array.isArray(stepData?.event?.outcomes) ? stepData.event.outcomes : [];
            if (choices.length !== outcomes.length || choices.length < 2) {
                errors.add(`CHAIN_CHOICE_OUTCOME_MISMATCH:${chainId}:${String(step)}`);
            }
            chainOutcomeCount += outcomes.length;
            outcomes.forEach((outcome: any, choiceIndex: number) => {
                const id = `chain:${chainId}:${String(step)}:${choiceIndex}`;
                const reward = outcome?.reward;
                const rewardType = reward?.type ?? null;
                if (!CHAIN_OUTCOME_TYPES.has(outcome?.type)) {
                    errors.add(`CHAIN_OUTCOME_TYPE_INVALID:${chainId}:${String(step)}:${choiceIndex}`);
                }
                if (reward && !CHAIN_REWARD_TYPES.has(rewardType)) {
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
                    const expectedMinimum = Math.max(1, highestAvailableTier(Number(map.level)) - 1);
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
        if (!maps?.[encounter?.region]) errors.add(`BOUNDED_LOCATION_UNKNOWN:${encounterId}:${String(encounter?.region)}`);
        const choices = Array.isArray(encounter?.choices) ? encounter.choices : [];
        boundedChoiceCount += choices.length;
        if (choices.length !== 2) errors.add(`BOUNDED_CHOICE_COUNT_INVALID:${encounterId}`);
        for (const choice of choices) {
            const choiceId = typeof choice?.id === 'string' ? choice.id : '<invalid>';
            for (const section of ['cost', 'outcome']) {
                for (const [field, value] of Object.entries(choice?.[section] || {})) {
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
        if (!Number.isSafeInteger(amount) || amount <= 0
            || !Number.isSafeInteger(grossGold) || grossGold < 0
            || !Number.isSafeInteger(netGold) || netGold < 0) {
            errors.add(`FALLBACK_NUMBER_INVALID:${id}`);
        } else {
            const expectedNet = transaction?.cost?.type === 'gold' ? grossGold - amount : grossGold;
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

    const addBuiltEventRows = (occurrenceClass: string, event: any) => {
        const choices = Array.isArray(event?.choices) ? event.choices : [];
        const outcomes = Array.isArray(event?.outcomes) ? event.outcomes : [];
        if (choices.length !== outcomes.length) errors.add(`${occurrenceClass.toUpperCase()}_CHOICE_OUTCOME_MISMATCH`);
        outcomes.forEach((outcome: any, choiceIndex: number) => {
            rows.push({
                id: `${occurrenceClass}:${choiceIndex}`,
                occurrenceClass,
                rewardType: outcome?.scoutEffect || (outcome?.buff ? 'buff' : 'recovery'),
            });
        });
    };
    addBuiltEventRows('campfire', campfireEvent);
    addBuiltEventRows('scout', scoutEvent);

    const frequencySnapshot = {
        scoutChance: frequency?.scoutChance,
        campfireChance: frequency?.campfireChance,
        eventMultiplier: frequency?.eventMultiplier,
        minimumNarrativeGap: frequency?.minimumNarrativeGap,
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
    if (boundedList.length !== 4) errors.add('BOUNDED_COUNT_MISMATCH');
    if (boundedChoiceCount !== 8) errors.add('BOUNDED_CHOICE_COUNT_MISMATCH');
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
