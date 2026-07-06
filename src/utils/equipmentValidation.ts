/**
 * equipmentValidation.ts — 장비 착용 검증 순수함수 (2026-07 감사 R4).
 *
 * useInventoryActions.equipment.ts의 useItem 액션에 인라인으로 박혀 있던 검증
 * 3종(레벨/직업/양손무기+방패 충돌)을 canEquip()으로 추출. hook은 이 함수를
 * 호출하고 reason별 기존 MSG 로그만 출력한다 — 검증 로직 자체는 여기서만 담당.
 *
 * 순수함수: 입력 → { ok, reason, ... } 반환. side effect 없음.
 */
import { BALANCE } from '../data/constants';
import { isTwoHandWeapon } from './equipmentUtils';
import type { EquipSlots, Item } from '../types/index.js';
import type { Player } from '../types/index.js';

export type CanEquipReason = 'level' | 'job' | 'two_hand_shield';

export type CanEquipResult =
    | { ok: true }
    | { ok: false; reason: 'level'; reqLevel: number }
    | { ok: false; reason: 'job' }
    | { ok: false; reason: 'two_hand_shield' };

/**
 * 장비 착용 가능 여부를 판정한다. 원본 useItem의 검증 순서(레벨 → 직업 → 양손무기+방패)를
 * 그대로 보존 — 순서가 바뀌면 동시에 여러 조건을 위반하는 아이템의 로그 문구가 달라진다.
 */
export const canEquip = (item: Item, player: Player, currentEquip: EquipSlots): CanEquipResult => {
    const reqLevel = (item as any).reqLevel ?? (BALANCE.TIER_REQ_LEVEL?.[(item as any).tier] ?? 1);
    if (((player as any).level || 1) < reqLevel) {
        return { ok: false, reason: 'level', reqLevel };
    }

    if (Array.isArray((item as any).jobs) && !(item as any).jobs.includes(player.job)) {
        return { ok: false, reason: 'job' };
    }

    if (item.type === 'shield' && isTwoHandWeapon(currentEquip.weapon)) {
        return { ok: false, reason: 'two_hand_shield' };
    }

    return { ok: true };
};
