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
import type { EquipSlots, Item } from '../types/index.js';
import type { Player } from '../types/index.js';

export const isWeapon = (item: Item | null | undefined) => item?.type === 'weapon';
export const getWeaponHands = (weapon: Item | null | undefined) => Math.max(1, Number(weapon?.hands) || 1);
export const isTwoHandWeapon = (weapon: Item | null | undefined) => isWeapon(weapon) && getWeaponHands(weapon) >= 2;

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
export const canEquip = (item: Item, player: Pick<Player, 'job' | 'level'>, currentEquip: EquipSlots): CanEquipResult => {
    // `reqLevel`은 Item 도메인 타입엔 없는 인스턴스 전용 오버라이드 필드(카탈로그 데이터
    // 어디에도 없고 QA 시드 등에서만 붙는다) — `in`으로 존재를 좁혀 unknown으로 읽는다.
    // 없으면 tier 기반 BALANCE.TIER_REQ_LEVEL로 폴백(tier 없는 아이템은 -1로 lookup miss
    // 시켜 원래처럼 `?? 1` fallback을 그대로 유도).
    const reqLevel = Number(
        ('reqLevel' in item ? item.reqLevel : undefined) ?? (BALANCE.TIER_REQ_LEVEL?.[item.tier ?? -1] ?? 1)
    );
    if ((player.level || 1) < reqLevel) {
        return { ok: false, reason: 'level', reqLevel };
    }

    if (Array.isArray(item.jobs) && !item.jobs.includes(player.job ?? '')) {
        return { ok: false, reason: 'job' };
    }

    if (item.type === 'shield' && isTwoHandWeapon(currentEquip.weapon)) {
        return { ok: false, reason: 'two_hand_shield' };
    }

    return { ok: true };
};
