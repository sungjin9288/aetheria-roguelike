import { MSG } from '../data/messages';
import { calculateFullStats } from '../utils/statsCalculator';
import type { Item, ItemType, Player, StatusId } from '../types/index.js';

type ConsumableReason =
    | 'INVALID_ITEM'
    | 'NO_POTION'
    | 'FULL_HP'
    | 'FULL_MP'
    | 'STATUS_ABSENT'
    | 'BUFF_DOMINATED';

type ConsumableLog = { type: string; text: string };

export type ConsumableEffectResult = {
    ok: true;
    reason: null;
    player: Player;
    log: ConsumableLog;
} | {
    ok: false;
    reason: ConsumableReason;
    player: Player;
    message: string;
};

const RECOVERY_TYPES = new Set(['hp', 'mp']);
// CURE_EFFECTS 4종은 StatusId(8종) 문자 그대로의 부분집합이다 — 정화 판정과
// player.status 배열 판별을 같은 타입으로 묶어 캐스트 지점을 하나로 좁힌다.
const CURE_EFFECTS = new Set<StatusId>(['poison', 'burn', 'freeze', 'curse']);
const BUFF_EFFECTS = new Set(['atk_up', 'def_up', 'all_up']);

const isFinitePositive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isCanonicalElixir = (item: Item | null | undefined) => item?.type === 'hp' && item?.name === '엘릭서';

/** RECOVERY_TYPES.has()에 타입 서술을 씌운 것 — 반환 boolean은 동일, item.type을 좁혀 준다. */
const isRecoveryItemType = (type: ItemType | undefined): type is 'hp' | 'mp' => RECOVERY_TYPES.has(type as 'hp' | 'mp');

const rejection = (player: Player, reason: ConsumableReason): ConsumableEffectResult => ({
    ok: false,
    reason,
    player,
    message: reason === 'NO_POTION'
        ? MSG.CHALLENGE_NO_CONSUMABLE
        : reason === 'FULL_HP'
            ? MSG.CONSUMABLE_FULL_HP
            : reason === 'FULL_MP'
                ? MSG.CONSUMABLE_FULL_MP
                : reason === 'STATUS_ABSENT'
                    ? MSG.CONSUMABLE_STATUS_ABSENT
                    : reason === 'BUFF_DOMINATED'
                        ? MSG.CONSUMABLE_BUFF_DOMINATED
                        : MSG.CONSUMABLE_INVALID,
});

const effectiveMaximum = (player: Player, key: 'maxHp' | 'maxMp') => {
    const calculated = calculateFullStats(player)?.[key];
    if (isFinitePositive(calculated)) return calculated;
    return isFinitePositive(player?.[key]) ? player[key] : null;
};

const removeOneInventoryInstance = (inventory: Item[], item: Item) => {
    const selectedIndex = inventory.findIndex((entry) => entry === item);
    const fallbackIndex = selectedIndex >= 0
        ? selectedIndex
        : inventory.findIndex((entry) => entry?.id === item?.id);
    if (fallbackIndex < 0) return inventory;
    return [...inventory.slice(0, fallbackIndex), ...inventory.slice(fallbackIndex + 1)];
};

/** Keeps a slot for a remaining duplicate ID, but never for the exact consumed instance. */
export const sanitizeConsumedQuickSlots = (slots: Array<Item | null> | null | undefined, item: Item, inventory: Item[]) => {
    const ids = new Set(inventory.map((entry) => entry?.id).filter(Boolean));
    return Array.from({ length: 3 }, (_: unknown, index: number) => (Array.isArray(slots) ? slots[index] : null) ?? null)
        .map((slot) => (slot === item ? null : slot?.id && ids.has(slot.id) ? slot : null));
};

const getBuff = (item: Item) => {
    // 호출부(resolveConsumableEffect의 버프 분기)가 이미 isFinitePositive(item.val)로
    // 확정한 뒤에만 부른다 — Item.val은 optional이라 여기서는 그 보장을 캐스트로 명시.
    const val = item.val as number;
    return {
        atk: item.effect === 'atk_up' || item.effect === 'all_up' ? Math.round((val - 1) * 1_000_000) / 1_000_000 : 0,
        def: item.effect === 'def_up' || item.effect === 'all_up' ? Math.round((val - 1) * 1_000_000) / 1_000_000 : 0,
        turn: item.turn,
        name: item.name,
    };
};

const isDominatedByCurrentBuff = (current: Player['tempBuff'], candidate: ReturnType<typeof getBuff>) => (
    Number.isFinite(current?.atk)
    && Number.isFinite(current?.def)
    && Number.isFinite(current?.turn)
    && (current?.turn ?? 0) > 0
    && (current?.atk ?? 0) >= candidate.atk
    && (current?.def ?? 0) >= candidate.def
    && (current?.turn ?? 0) >= (candidate.turn ?? 0)
);

/**
 * Consumable transaction authority used by both reducer paths and hooks.
 * Rejections preserve the original player reference so callers can make exact no-op decisions.
 */
export const resolveConsumableEffect = ({ player, item }: { player: Player; item: Item }): ConsumableEffectResult => {
    if (!player || !item || typeof item.type !== 'string') return rejection(player, 'INVALID_ITEM');
    if (!['hp', 'mp', 'cure', 'buff'].includes(item.type)) return rejection(player, 'INVALID_ITEM');
    if (player.challengeModifiers?.includes('noPotion')) return rejection(player, 'NO_POTION');

    const inventory = Array.isArray(player.inv) ? player.inv : [];
    if (!inventory.some((entry) => entry === item || entry?.id === item.id)) return rejection(player, 'INVALID_ITEM');
    const itemName = typeof item.name === 'string' && item.name ? item.name : MSG.CONSUMABLE_NAME_FALLBACK;

    if (isRecoveryItemType(item.type)) {
        if (!isFinitePositive(item.val)) return rejection(player, 'INVALID_ITEM');
        const maximum = effectiveMaximum(player, item.type === 'hp' ? 'maxHp' : 'maxMp');
        if (!maximum) return rejection(player, 'INVALID_ITEM');
        const current = player[item.type] ?? 0;
        if (!Number.isFinite(current)) return rejection(player, 'INVALID_ITEM');
        if (current >= maximum) return rejection(player, item.type === 'hp' ? 'FULL_HP' : 'FULL_MP');
        // Number(item.val) — isFinitePositive(item.val) 확인을 이미 통과했으므로 실수치이지만,
        //   Item.val이 optional이라 산술 연산자에는 number 단언이 필요하다(값 변화 없음).
        const restored = isCanonicalElixir(item)
            ? maximum
            : Math.min(maximum, current + Number(item.val));
        if (restored <= current) return rejection(player, item.type === 'hp' ? 'FULL_HP' : 'FULL_MP');
        return {
            ok: true,
            reason: null,
            player: {
                ...player,
                [item.type]: restored,
                inv: removeOneInventoryInstance(inventory, item),
            },
            log: { type: 'success', text: MSG.ITEM_USE_SIMPLE(itemName) },
        };
    }

    if (item.type === 'cure') {
        // item.effect as StatusId — CURE_EFFECTS(Set<StatusId>)에 대한 멤버십 검사 지점.
        //   Item.effect는 열린 string이라 검사 전엔 좁혀지지 않는다(런타임 동작은 무변경 —
        //   Set.has()는 값 비교만 하고 타입 단언에 영향받지 않는다).
        const cureEffect = item.effect as StatusId;
        if (!CURE_EFFECTS.has(cureEffect)) return rejection(player, 'INVALID_ITEM');
        // Player.status: StatusId[] | undefined로 닫혀 있고, dataMigration.ts가 로드 시점에
        // 레거시 스칼라를 이미 배열로 승격시킨다 — `?? []`가 타입상 동치다.
        const status: StatusId[] = player.status ?? [];
        if (!status.includes(cureEffect)) return rejection(player, 'STATUS_ABSENT');
        return {
            ok: true,
            reason: null,
            player: {
                ...player,
                status: status.filter((entry) => entry !== cureEffect),
                inv: removeOneInventoryInstance(inventory, item),
            },
            log: { type: 'success', text: MSG.ITEM_USE_CURE(itemName) },
        };
    }

    // String(item.effect) / Number(item.val) / Number(item.turn) — 전부 도달 시점에 이미
    //   유효함이 확정된 값의 순수 타입 캐스트다(OR 체인이라 앞 조건이 거짓이어야 다음
    //   조건이 평가되므로, item.val<=1 평가 시점엔 이미 isFinitePositive(item.val)=true다).
    if (!BUFF_EFFECTS.has(String(item.effect)) || !isFinitePositive(item.val) || Number(item.val) <= 1 || !Number.isInteger(item.turn) || Number(item.turn) <= 0) {
        return rejection(player, 'INVALID_ITEM');
    }
    const candidate = getBuff(item);
    if (isDominatedByCurrentBuff(player.tempBuff, candidate)) return rejection(player, 'BUFF_DOMINATED');
    return {
        ok: true,
        reason: null,
        player: {
            ...player,
            tempBuff: candidate,
            inv: removeOneInventoryInstance(inventory, item),
        },
        log: { type: 'success', text: MSG.ITEM_USE_BUFF(itemName) },
    };
};
