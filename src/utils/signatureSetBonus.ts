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
    for (const [key, count] of Object.entries(counts) as Array<[string, number]>) {
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

    const atkMult = bonus.atkMult || 1;
    const defMult = bonus.defMult || 1;
    const hpMult = bonus.hpMult || 1;

    return {
        atkMult,
        defMult,
        hpMult,
        activeSet: {
            key: bestKey,
            name: setDef.name,
            tone: setDef.tone,
            count: bestCount,
            tier: availableTiers[0],
            desc: bonus.desc,
            atkMult,
            defMult,
            hpMult,
        },
    };
};

/** UI 도움용: 세트 정의 전체 조회. */
export const getSignatureSetDefinitions = () => SETS;

/** UI 도움용: 특정 setGroup의 정의. */
export const getSignatureSet = (key) => SETS[key] || null;

/**
 * 현재 장착 구성에서 가장 "가까운" signature 세트의 진행도를 반환.
 *
 * - 장착된 signature 아이템이 0개면 null.
 * - 장착된 signature 중 가장 많은 setGroup을 선택(동률 시 첫 발견).
 * - 해당 세트의 다음 티어(equippedCount+1 기준의 최소 tier 이상) bonus를 찾아 "다음 보상"으로 반환.
 * - 모든 티어를 이미 달성한 경우 nextTier=null.
 *
 * EquipmentPanel의 "세트 진행도" 카드에서 사용 — 플레이어가 1세트만 장착해도
 * "1개 더 장착 시 +X% 공격" 힌트로 빌드 방향을 안내한다.
 *
 * @param {object} equip player.equip { weapon, armor, offhand }
 * @returns {{
 *   key: string,
 *   name: string,
 *   tone: string,
 *   equippedCount: number,
 *   totalMembers: number,
 *   members: string[],
 *   equippedMembers: string[],
 *   missingMembers: string[],
 *   currentTier: number | null,
 *   nextTier: number | null,
 *   nextBonus: { atkMult: number, defMult: number, hpMult: number, desc: string } | null,
 *   isActive: boolean
 * } | null}
 */
export const getSignatureSetProgress = (equip) => {
    if (!equip) return null;

    const equippedByGroup = new Map();
    for (const slot of ['weapon', 'armor', 'offhand']) {
        const item = equip[slot];
        const meta = getRegistryEntry(item);
        if (!meta?.setGroup) continue;
        const list = equippedByGroup.get(meta.setGroup) || [];
        list.push(item.name);
        equippedByGroup.set(meta.setGroup, list);
    }
    if (equippedByGroup.size === 0) return null;

    let bestKey = null;
    let bestCount = 0;
    for (const [key, list] of equippedByGroup.entries()) {
        if (list.length > bestCount) {
            bestKey = key;
            bestCount = list.length;
        }
    }
    if (!bestKey) return null;

    const setDef = SETS[bestKey];
    if (!setDef) return null;

    const tierNumbers = Object.keys(setDef.bonuses || {})
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);

    const currentTier = [...tierNumbers].reverse().find((n) => n <= bestCount) ?? null;
    const nextTier = tierNumbers.find((n) => n > bestCount) ?? null;
    const nextBonusRaw = nextTier != null ? setDef.bonuses[String(nextTier)] : null;

    const members = [...(setDef.members || [])];
    const equippedMembers = equippedByGroup.get(bestKey) || [];
    const missingMembers = members.filter((name) => !equippedMembers.includes(name));

    return {
        key: bestKey,
        name: setDef.name,
        tone: setDef.tone,
        equippedCount: bestCount,
        totalMembers: members.length,
        members,
        equippedMembers,
        missingMembers,
        currentTier,
        nextTier,
        nextBonus: nextBonusRaw
            ? {
                atkMult: nextBonusRaw.atkMult || 1,
                defMult: nextBonusRaw.defMult || 1,
                hpMult: nextBonusRaw.hpMult || 1,
                desc: nextBonusRaw.desc,
            }
            : null,
        isActive: currentTier != null,
    };
};
