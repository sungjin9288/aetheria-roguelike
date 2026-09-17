import { MSG } from '../data/messages';
import { calculateFullStats } from '../utils/statsCalculator';

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
    player: any;
    log: ConsumableLog;
} | {
    ok: false;
    reason: ConsumableReason;
    player: any;
    message: string;
};

const RECOVERY_TYPES = new Set(['hp', 'mp']);
const CURE_EFFECTS = new Set(['poison', 'burn', 'freeze', 'curse']);
const BUFF_EFFECTS = new Set(['atk_up', 'def_up', 'all_up']);

const isFinitePositive = (value: any) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isCanonicalElixir = (item: any) => item?.type === 'hp' && item?.name === '엘릭서';

const rejection = (player: any, reason: ConsumableReason): ConsumableEffectResult => ({
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

const effectiveMaximum = (player: any, key: 'maxHp' | 'maxMp') => {
    const calculated = calculateFullStats(player)?.[key];
    if (isFinitePositive(calculated)) return calculated;
    return isFinitePositive(player?.[key]) ? player[key] : null;
};

const removeOneInventoryInstance = (inventory: any[], item: any) => {
    const selectedIndex = inventory.findIndex((entry: any) => entry === item);
    const fallbackIndex = selectedIndex >= 0
        ? selectedIndex
        : inventory.findIndex((entry: any) => entry?.id === item?.id);
    if (fallbackIndex < 0) return inventory;
    return [...inventory.slice(0, fallbackIndex), ...inventory.slice(fallbackIndex + 1)];
};

/** Keeps a slot for a remaining duplicate ID, but never for the exact consumed instance. */
export const sanitizeConsumedQuickSlots = (slots: any, item: any, inventory: any[]) => {
    const ids = new Set(inventory.map((entry: any) => entry?.id).filter(Boolean));
    return Array.from({ length: 3 }, (_: any, index: any) => (Array.isArray(slots) ? slots[index] : null) ?? null)
        .map((slot: any) => (slot === item ? null : slot?.id && ids.has(slot.id) ? slot : null));
};

const getBuff = (item: any) => ({
    atk: item.effect === 'atk_up' || item.effect === 'all_up' ? Math.round((item.val - 1) * 1_000_000) / 1_000_000 : 0,
    def: item.effect === 'def_up' || item.effect === 'all_up' ? Math.round((item.val - 1) * 1_000_000) / 1_000_000 : 0,
    turn: item.turn,
    name: item.name,
});

const isDominatedByCurrentBuff = (current: any, candidate: any) => (
    Number.isFinite(current?.atk)
    && Number.isFinite(current?.def)
    && Number.isFinite(current?.turn)
    && current.turn > 0
    && current.atk >= candidate.atk
    && current.def >= candidate.def
    && current.turn >= candidate.turn
);

/**
 * Consumable transaction authority used by both reducer paths and hooks.
 * Rejections preserve the original player reference so callers can make exact no-op decisions.
 */
export const resolveConsumableEffect = ({ player, item }: { player: any; item: any }): ConsumableEffectResult => {
    if (!player || !item || typeof item.type !== 'string') return rejection(player, 'INVALID_ITEM');
    if (!['hp', 'mp', 'cure', 'buff'].includes(item.type)) return rejection(player, 'INVALID_ITEM');
    if (player.challengeModifiers?.includes('noPotion')) return rejection(player, 'NO_POTION');

    const inventory = Array.isArray(player.inv) ? player.inv : [];
    if (!inventory.some((entry: any) => entry === item || entry?.id === item.id)) return rejection(player, 'INVALID_ITEM');
    const itemName = typeof item.name === 'string' && item.name ? item.name : '소모품';

    if (RECOVERY_TYPES.has(item.type)) {
        if (!isFinitePositive(item.val)) return rejection(player, 'INVALID_ITEM');
        const maximum = effectiveMaximum(player, item.type === 'hp' ? 'maxHp' : 'maxMp');
        if (!maximum) return rejection(player, 'INVALID_ITEM');
        const current = player[item.type] ?? 0;
        if (!Number.isFinite(current)) return rejection(player, 'INVALID_ITEM');
        if (current >= maximum) return rejection(player, item.type === 'hp' ? 'FULL_HP' : 'FULL_MP');
        const restored = isCanonicalElixir(item)
            ? maximum
            : Math.min(maximum, current + item.val);
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
        if (!CURE_EFFECTS.has(item.effect)) return rejection(player, 'INVALID_ITEM');
        const status = Array.isArray(player.status) ? player.status : player.status ? [player.status] : [];
        if (!status.includes(item.effect)) return rejection(player, 'STATUS_ABSENT');
        return {
            ok: true,
            reason: null,
            player: {
                ...player,
                status: status.filter((entry: any) => entry !== item.effect),
                inv: removeOneInventoryInstance(inventory, item),
            },
            log: { type: 'success', text: MSG.ITEM_USE_CURE(itemName) },
        };
    }

    if (!BUFF_EFFECTS.has(item.effect) || !isFinitePositive(item.val) || item.val <= 1 || !Number.isInteger(item.turn) || item.turn <= 0) {
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
