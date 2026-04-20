import signatureRegistry from '../data/signatureRegistry.json' with { type: 'json' };
import signatureSets from '../data/signatureSets.json' with { type: 'json' };

/**
 * Signature 세트 보너스 계산. prefix 기반 기존 setBonus와 병행 동작.
 *
 * 계산 순서:
 *   1. player.equip(weapon/armor/offhand)에 착용된 signature 아이템의 setGroup 수집
 *   2. 같은 setGroup이 2개 이상이면 count 기준 bonus 매핑
 *   3. 최고 count 기준 bonus 반환 (예: 3세트면 2세트 효과 대체)
 */

const REGISTRY = signatureRegistry.entries || {};
const SETS = signatureSets.sets || {};

const getRegistryEntry = (item) => {
    if (!item?.name) return null;
    return REGISTRY[item.name] || null;
};

/**
 * @param {object} equip player.equip { weapon, armor, offhand }
 * @returns {{
 *   atkMult: number,
 *   defMult: number,
 *   hpMult: number,
 *   activeSet: { key: string, name: string, tone: string, count: number, desc: string } | null
 * }}
 */
export const computeSignatureSetBonus = (equip) => {
    const neutral = { atkMult: 1, defMult: 1, hpMult: 1, activeSet: null };
    if (!equip) return neutral;

    const groups = [];
    for (const slot of ['weapon', 'armor', 'offhand']) {
        const meta = getRegistryEntry(equip[slot]);
        if (meta?.setGroup) groups.push(meta.setGroup);
    }
    if (groups.length < 2) return neutral;

    const counts = groups.reduce((acc, key) => {
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    // 가장 많이 착용된 세트 선택 (동률 시 첫 발견)
    let bestKey = null;
    let bestCount = 0;
    for (const [key, count] of Object.entries(counts)) {
        if (count > bestCount) {
            bestKey = key;
            bestCount = count;
        }
    }
    if (!bestKey || bestCount < 2) return neutral;

    const setDef = SETS[bestKey];
    if (!setDef?.bonuses) return neutral;

    // 가능한 최고 tier 선택 (bestCount 이하 중 가장 높은 키)
    const availableTiers = Object.keys(setDef.bonuses)
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n) && n <= bestCount)
        .sort((a, b) => b - a);
    if (availableTiers.length === 0) return neutral;

    const bonus = setDef.bonuses[String(availableTiers[0])];
    if (!bonus) return neutral;

    return {
        atkMult: bonus.atkMult || 1,
        defMult: bonus.defMult || 1,
        hpMult: bonus.hpMult || 1,
        activeSet: {
            key: bestKey,
            name: setDef.name,
            tone: setDef.tone,
            count: bestCount,
            tier: availableTiers[0],
            desc: bonus.desc,
        },
    };
};

/** UI 도움용: 세트 정의 전체 조회. */
export const getSignatureSetDefinitions = () => SETS;

/** UI 도움용: 특정 setGroup의 정의. */
export const getSignatureSet = (key) => SETS[key] || null;
