import type { Item } from '../types/index.js';
import signatureRegistry from '../data/signatureRegistry.json' with { type: 'json' };
import signatureSets from '../data/signatureSets.json' with { type: 'json' };
import { BALANCE } from '../data/constants.js';
import { isTwoHandWeapon } from './equipmentUtils.js';
import { findItemByName } from './gameUtils.js';

/**
 * Signature 세트 보너스 계산. prefix 기반 기존 setBonus와 병행 동작.
 *
 * 계산 순서:
 *   1. player.equip(weapon/armor/offhand)에 착용된 signature 아이템의 setGroup 수집
 *   2. 같은 setGroup이 2개 이상이면 count 기준 bonus 매핑
 *   3. 최고 count 기준 bonus 반환 (예: 3세트면 2세트 효과 대체)
 *
 * 2H 무기 = 2피스 카운트 (fix/signature-set-two-hand):
 *   signatureSets.json 멤버 다수가 양손(2H) 무기다. weapon/armor/offhand 3슬롯 중
 *   2H 무기는 offhand를 봉쇄하므로 실질적으로 "무기+보조" 두 슬롯을 혼자 차지한다.
 *   1H 유저는 무기+방패 두 슬롯으로 2피스를 채울 수 있으니, 같은 두 슬롯을 혼자
 *   점유하는 2H 무기를 2피스로 카운트하는 것이 공정하다(ARPG 표준 해법). 이 규칙이
 *   없으면 무기 1개 + 갑옷 1개 = 최대 2피스만 가능해 3피스+ 티어가 영원히 도달
 *   불가능하고, dimension 세트(차원 방패 이지스 + 차원 마왕의 낫 2H)는 낫이 방패
 *   슬롯을 막아 2세트조차 발동 불가능했다.
 */

const REGISTRY: Record<string, any> = signatureRegistry.entries || {};
const SETS: Record<string, any> = signatureSets.sets || {};

const getRegistryEntry = (item: Item | null | undefined) => {
    if (!item?.name) return null;
    return REGISTRY[item.name] || null;
};

/**
 * item이 2H 무기인지 판정. equip에 저장된 인스턴스(makeItem 산출물)는 보통 DB
 * 원본의 `hands` 필드를 그대로 보유하지만, 테스트 픽스처 등 최소 shape(`{ name }`)만
 * 있는 경우를 대비해 DB 원본(findItemByName) fallback으로 보완한다.
 */
const isTwoHandSignatureWeapon = (item: Item | null | undefined) => {
    if (!item) return false;
    if (isTwoHandWeapon(item)) return true;
    if (item.hands != null) return false; // hands가 명시돼 있으면 그 값을 신뢰(1H 확정).
    const dbItem = findItemByName(item.name);
    return isTwoHandWeapon(dbItem);
};

/** slot별 setGroup 카운트 가중치: 2H 무기는 weapon+offhand 두 슬롯을 혼자 점유하므로 2. */
const getSlotWeight = (slot: string, item: Item | null | undefined) => (
    slot === 'weapon' && isTwoHandSignatureWeapon(item) ? 2 : 1
);

/**
 * @param {object} equip player.equip { weapon, armor, offhand }
 * @returns {{
 *   atkMult: number,
 *   defMult: number,
 *   hpMult: number,
 *   activeSet: { key: string, name: string, tone: string, count: number, desc: string } | null
 * }}
 */
export const computeSignatureSetBonus = (equip: any) => { // EquipSlots-like (런타임 동적 슬롯 호환).
    const neutral: any = { atkMult: 1, defMult: 1, hpMult: 1, activeSet: null };
    if (!equip) return neutral;

    // slot별 setGroup + 가중치(2H 무기는 2) 수집.
    // 설계 보정(리뷰 피드백): 2H 가중치는 "티어 도달 공정성"용이고, 발동 자체는
    // 서로 다른 세트 아이템 SIGNATURE_SET_MIN_ITEMS(2)개 이상을 "모아야" 한다 —
    // 세트의 메리트는 수집에서 나온다는 원칙. 즉 2H 단독은 발동 불가(카운트 2여도),
    // 2H+갑옷은 아이템 2개 + 카운트 3으로 상위 티어 도달.
    const groups: any[] = [];
    const counts: Record<string, number> = {};
    const itemCounts: Record<string, number> = {};
    for (const slot of ['weapon', 'armor', 'offhand']) {
        const item = equip[slot];
        const meta = getRegistryEntry(item);
        if (!meta?.setGroup) continue;
        groups.push(meta.setGroup);
        counts[meta.setGroup] = (counts[meta.setGroup] || 0) + getSlotWeight(slot, item);
        itemCounts[meta.setGroup] = (itemCounts[meta.setGroup] || 0) + 1;
    }
    if (groups.length === 0) return neutral;

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
    if ((itemCounts[bestKey] || 0) < BALANCE.SIGNATURE_SET_MIN_ITEMS) return neutral;

    const setDef = SETS[bestKey];
    if (!setDef?.bonuses) return neutral;

    // 가능한 최고 tier 선택 (bestCount 이하 중 가장 높은 키)
    const availableTiers = Object.keys(setDef.bonuses)
        .map((k: any) => Number(k))
        .filter((n: any) => Number.isFinite(n) && n <= bestCount)
        .sort((a: any, b: any) => b - a);
    if (availableTiers.length === 0) return neutral;

    const bonus = setDef.bonuses[String(availableTiers[0])];
    if (!bonus) return neutral;

    const atkMult = bonus.atkMult || 1;
    const defMult = bonus.defMult || 1;
    const hpMult = bonus.hpMult || 1;

    // cycle 426: activeSet 내부의 atkMult/defMult/hpMult 3 필드 복원 — cycle 348의
    //   잘못된 dead 판정 정정. StatsPanel.tsx (line 220/228/236)이 stats.activeSignatureSet
    //   .atkMult / .defMult / .hpMult를 직접 read해서 formatMultDelta로 표시. 제거 시
    //   2-set 착용 시 ATK/DEF/HP delta 모두 '—'로 표시되던 silent UI 결손.
    //   부모 return의 동일 필드는 statsCalculator의 stat 합산용 (별도 path).
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
export const getSignatureSet = (key: any) => SETS[key] || null;

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
 *   twoHandCounted: boolean,
 *   nextBonus: { atkMult: number, defMult: number, hpMult: number, desc: string } | null,
 *   isActive: boolean
 * } | null}
 */
export const getSignatureSetProgress = (equip: any) => {
    if (!equip) return null;

    // group별 장착 아이템명 목록(표시용, 1회씩)과 count(2H 가중치 반영)를 분리 추적.
    const equippedByGroup = new Map<string, string[]>();
    const countByGroup = new Map<string, number>();
    let anyTwoHandCounted = false;
    for (const slot of ['weapon', 'armor', 'offhand']) {
        const item = equip[slot];
        const meta = getRegistryEntry(item);
        if (!meta?.setGroup) continue;
        const list = equippedByGroup.get(meta.setGroup) || [];
        list.push(item.name);
        equippedByGroup.set(meta.setGroup, list);

        const weight = getSlotWeight(slot, item);
        if (weight > 1) anyTwoHandCounted = true;
        countByGroup.set(meta.setGroup, (countByGroup.get(meta.setGroup) || 0) + weight);
    }
    if (equippedByGroup.size === 0) return null;

    let bestKey = null;
    let bestCount = 0;
    for (const [key, count] of countByGroup.entries()) {
        if (count > bestCount) {
            bestKey = key;
            bestCount = count;
        }
    }
    if (!bestKey) return null;

    // 최종 표시 대상 세트가 2H 가중치로 카운트를 얻었는지 여부 (해당 세트 한정).
    const bestGroupHasTwoHand = anyTwoHandCounted && (() => {
        for (const slot of ['weapon', 'armor', 'offhand']) {
            const item = equip[slot];
            const meta = getRegistryEntry(item);
            if (meta?.setGroup === bestKey && getSlotWeight(slot, item) > 1) return true;
        }
        return false;
    })();

    const setDef = SETS[bestKey];
    if (!setDef) return null;

    const tierNumbers = Object.keys(setDef.bonuses || {})
        .map((k: any) => Number(k))
        .filter((n: any) => Number.isFinite(n))
        .sort((a: any, b: any) => a - b);

    const members = [...(setDef.members || [])];
    const equippedMembers = equippedByGroup.get(bestKey) || [];
    const missingMembers = members.filter((name: any) => !equippedMembers.includes(name));

    // 발동 게이트(compute와 동일): 서로 다른 세트 아이템 MIN_ITEMS(2)개 미만이면
    // 카운트가 티어에 닿아도 미발동 — "세트는 모아야 메리트" 원칙. 2H 단독(카운트 2,
    // 아이템 1)의 currentTier는 null이고, nextTier는 가중 카운트 기준 다음 목표를
    // 그대로 안내한다 (2H 보유자는 아이템 1개만 더 모으면 카운트 3 티어에 도달).
    const meetsMinItems = equippedMembers.length >= BALANCE.SIGNATURE_SET_MIN_ITEMS;
    const currentTier = meetsMinItems
        ? ([...tierNumbers].reverse().find((n: any) => n <= bestCount) ?? null)
        : null;
    const nextTier = meetsMinItems
        ? (tierNumbers.find((n: any) => n > bestCount) ?? null)
        // 미발동 상태: 아이템 1개를 더 모으면 카운트 bestCount+1 — 그때 실제로 발동될
        // 최고 티어를 다음 목표로 안내 (2H 단독 count 2 → +1아이템 = count 3 → tier 3).
        : ([...tierNumbers].reverse().find((n: any) => n <= bestCount + 1) ?? tierNumbers[0] ?? null);
    const nextBonusRaw = nextTier != null ? setDef.bonuses[String(nextTier)] : null;

    // cycle 349: members / equippedMembers 2 출력 dead 필드 제거 — 둘 다 외부 read 0건이라
    //   missingMembers 계산용 internal const로만 사용. currentTier / isActive는 test-active 보존.
    return {
        key: bestKey,
        name: setDef.name,
        tone: setDef.tone,
        equippedCount: bestCount,
        totalMembers: members.length,
        missingMembers,
        currentTier,
        nextTier,
        // 2H 시그니처 무기가 이번 count에 +2로 반영됐는지 여부. UI(EquipmentPanel)가
        // "양손 무기는 2피스로 계산" 힌트를 조건부로 렌더링할 때만 사용 — 컴포넌트에는
        // 로직을 넣지 않고 이 플래그만 읽어 렌더링한다.
        twoHandCounted: bestGroupHasTwoHand,
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
