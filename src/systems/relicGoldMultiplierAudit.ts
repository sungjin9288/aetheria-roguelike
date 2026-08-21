import type { Relic } from '../types/relic.js';
import { CombatEngine } from './CombatEngine.js';
import { getStrongestNumericRelicValue } from './CombatEngine.actions.js';

type RejectionCode = 'INVALID_RELIC_EFFECT_VALUE' | 'ACCEPTED';

export interface RelicGoldMultiplierReport {
    schemaVersion: 1;
    classification: 'controlled-relic-gold-multiplier';
    actualPlayClaim: false;
    policy: {
        effect: 'gold_mult';
        stacking: 'strongest-only';
        goldMagnetValue: number;
        merchantSealValue: number;
        bothOrdersValue: [number, number];
        activeRunSnapshot: 'preserved';
    };
    catalog: {
        goldMagnet: { rarity: string; desc: string; value: number };
        merchantSeal: { rarity: string; desc: string; value: number };
    };
    reward: {
        enemyGold: 101;
        strongestValue: number;
        bothOrdersGold: [number, number];
        rounding: 'Math.floor';
    };
    malformedCases: Record<'undefined' | 'string' | 'nan' | 'infinity' | 'negative' | 'overflow', RejectionCode>;
    errors: string[];
}

const compareText = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

const numericValue = (relic: Relic | undefined) => (
    typeof relic?.val === 'number' && Number.isFinite(relic.val) && relic.val >= 0
        ? relic.val
        : 0
);

const makePlayer = (relics: readonly Relic[]) => ({
    level: 1,
    gold: 0,
    relics,
    stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0 },
});

const makeEnemy = (gold: number) => ({
    name: '골드 정책 허수아비',
    baseName: '골드 정책 허수아비',
    level: 1,
    hp: 1,
    maxHp: 1,
    atk: 1,
    def: 0,
    exp: 0,
    gold,
});

const settleGold = (relics: readonly Relic[], gold = 101) => (
    CombatEngine.handleVictory(makePlayer(relics), makeEnemy(gold), { expMult: 0, goldMult: 0 }, {}).goldGained
);

const rejectionCode = (relic: Relic, gold = 101): RejectionCode => {
    try {
        settleGold([relic], gold);
        return 'ACCEPTED';
    } catch (error) {
        return error instanceof Error && error.message.startsWith('INVALID_RELIC_EFFECT_VALUE')
            ? 'INVALID_RELIC_EFFECT_VALUE'
            : 'ACCEPTED';
    }
};

export const canonicalizeRelicGoldMultiplierReport = (
    report: RelicGoldMultiplierReport,
): RelicGoldMultiplierReport => ({
    schemaVersion: 1,
    classification: 'controlled-relic-gold-multiplier',
    actualPlayClaim: false,
    policy: {
        effect: 'gold_mult',
        stacking: 'strongest-only',
        goldMagnetValue: report.policy.goldMagnetValue,
        merchantSealValue: report.policy.merchantSealValue,
        bothOrdersValue: [...report.policy.bothOrdersValue] as [number, number],
        activeRunSnapshot: 'preserved',
    },
    catalog: {
        goldMagnet: { ...report.catalog.goldMagnet },
        merchantSeal: { ...report.catalog.merchantSeal },
    },
    reward: {
        enemyGold: 101,
        strongestValue: report.reward.strongestValue,
        bothOrdersGold: [...report.reward.bothOrdersGold] as [number, number],
        rounding: 'Math.floor',
    },
    malformedCases: {
        undefined: report.malformedCases.undefined,
        string: report.malformedCases.string,
        nan: report.malformedCases.nan,
        infinity: report.malformedCases.infinity,
        negative: report.malformedCases.negative,
        overflow: report.malformedCases.overflow,
    },
    errors: [...new Set(report.errors)].sort(compareText),
});

export const buildRelicGoldMultiplierReport = ({
    relics,
}: {
    relics: readonly Relic[];
}): RelicGoldMultiplierReport => {
    const errors = new Set<string>();
    const family = relics.filter((relic) => relic.effect === 'gold_mult');
    const goldMagnet = family.find((relic) => relic.id === 'gold_magnet');
    const merchantSeal = family.find((relic) => relic.id === 'merchant_seal');
    const familyIds = family.map((relic) => relic.id || '').sort(compareText);
    const goldMagnetValue = numericValue(goldMagnet);
    const merchantSealValue = numericValue(merchantSeal);
    const candidateGoldMagnet: Relic = { id: 'gold_magnet', effect: 'gold_mult', val: goldMagnetValue };
    const candidateMerchantSeal: Relic = { id: 'merchant_seal', effect: 'gold_mult', val: merchantSealValue };

    if (family.length !== 2 || familyIds[0] !== 'gold_magnet' || familyIds[1] !== 'merchant_seal') {
        errors.add('GOLD_MULT_FAMILY_IDS_MISMATCH');
    }
    if (goldMagnet?.rarity !== 'common'
        || goldMagnet?.desc !== '골드 획득 30% 증가'
        || goldMagnetValue !== 0.3) {
        errors.add('GOLD_MAGNET_POLICY_MISMATCH');
    }
    if (merchantSeal?.rarity !== 'rare'
        || merchantSeal?.desc !== '골드 획득 60% 증가 (공허의 왕좌 다음 등급)'
        || merchantSealValue !== 0.6) {
        errors.add('MERCHANT_SEAL_POLICY_MISMATCH');
    }

    const bothOrdersValue: [number, number] = [
        getStrongestNumericRelicValue([candidateGoldMagnet, candidateMerchantSeal], 'gold_mult'),
        getStrongestNumericRelicValue([candidateMerchantSeal, candidateGoldMagnet], 'gold_mult'),
    ];
    const bothOrdersGold: [number, number] = [
        settleGold([candidateGoldMagnet, candidateMerchantSeal]),
        settleGold([candidateMerchantSeal, candidateGoldMagnet]),
    ];
    if (bothOrdersValue[0] !== 0.6 || bothOrdersValue[1] !== 0.6) {
        errors.add('GOLD_MULT_ORDER_POLICY_MISMATCH');
    }
    if (bothOrdersGold[0] !== 161 || bothOrdersGold[1] !== 161) {
        errors.add('GOLD_MULT_REWARD_POLICY_MISMATCH');
    }

    const malformedCases = {
        undefined: rejectionCode({ id: 'undefined', effect: 'gold_mult', val: undefined }),
        string: rejectionCode({ id: 'string', effect: 'gold_mult', val: '0.6' }),
        nan: rejectionCode({ id: 'nan', effect: 'gold_mult', val: Number.NaN }),
        infinity: rejectionCode({ id: 'infinity', effect: 'gold_mult', val: Number.POSITIVE_INFINITY }),
        negative: rejectionCode({ id: 'negative', effect: 'gold_mult', val: -0.01 }),
        overflow: rejectionCode({ id: 'overflow', effect: 'gold_mult', val: Number.MAX_VALUE }, 2),
    } as const;
    if (Object.values(malformedCases).some((code) => code !== 'INVALID_RELIC_EFFECT_VALUE')) {
        errors.add('GOLD_MULT_MALFORMED_POLICY_MISMATCH');
    }

    return canonicalizeRelicGoldMultiplierReport({
        schemaVersion: 1,
        classification: 'controlled-relic-gold-multiplier',
        actualPlayClaim: false,
        policy: {
            effect: 'gold_mult',
            stacking: 'strongest-only',
            goldMagnetValue,
            merchantSealValue,
            bothOrdersValue,
            activeRunSnapshot: 'preserved',
        },
        catalog: {
            goldMagnet: {
                rarity: goldMagnet?.rarity || '',
                desc: goldMagnet?.desc || '',
                value: goldMagnetValue,
            },
            merchantSeal: {
                rarity: merchantSeal?.rarity || '',
                desc: merchantSeal?.desc || '',
                value: merchantSealValue,
            },
        },
        reward: {
            enemyGold: 101,
            strongestValue: Math.max(...bothOrdersValue),
            bothOrdersGold,
            rounding: 'Math.floor',
        },
        malformedCases,
        errors: [...errors],
    });
};
