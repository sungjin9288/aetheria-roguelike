/**
 * 장비의 전투 상시 효과 — 원소 저항 · 턴 재생 (2026-10 Wave 57, 소유자 결정 "이번에 설계 · 구현").
 *
 * 장비 설명은 오래전부터 이 효과를 약속했다("불에 강한 갑옷", "모든 원소를 저항한다", "무한한 재생력을 부여한다").
 * 하지만 읽는 곳이 없었다(`elem`은 표시 · 아트 전용이다). 효과는 장비 행(`items.ts`)이 아니라 이 표에 둔다.
 * 장비 행은 장비 경제 증빙(`equipmentEconomyAudit`)이 다이제스트로 고정한 승인 대상이라, 행에 필드를 더하면
 * 승인된 가격 증빙을 다시 핀해야 한다. 조회는 표준 장비 정체성(`resolveEquipmentBaseIdentity`)으로 하므로
 * 접두어가 붙은 장비와 이 표가 생기기 전에 얻은 장비 인스턴스에도 같은 효과가 붙는다.
 *
 * - `resist`: 그 원소의 적 공격 피해 × `BALANCE.EQUIP_ELEMENT_RESIST_MULT`(0.5). 적 공격의 원소는 적 자신의 원소다.
 * - `regenPerTurn`: 전투에서 행동마다 최대 생명의 비율만큼 회복(대지의 심장과 같은 틱).
 *
 * `tests/equipment-passives-contract.test.js`가 표의 모든 행이 실제 장비이고, 설명이 효과를 말하는 장비가 이 표에
 * 있다는 것을 대조한다.
 */
import type { ElementKey } from '../types/monster.js';

/** 장비가 막을 수 있는 원소 — `물리`는 원소가 아니다(적 원소가 `물리`인 공격은 저항 대상이 아니다). */
export type ResistElement = Exclude<ElementKey, '물리'>;

export const ALL_RESIST_ELEMENTS: readonly ResistElement[] = Object.freeze([
    '화염', '냉기', '대지', '바람', '빛', '어둠', '에테르', '자연',
] as const);

export interface EquipmentPassive {
    resist?: readonly ResistElement[];
    regenPerTurn?: number;
}

export type EquipmentPassiveSlotType = 'armor' | 'shield';

const ARMOR_PASSIVES: Readonly<Record<string, EquipmentPassive>> = Object.freeze({
    '화염 방어복': { resist: ['화염'] },
    '냉기 방어복': { resist: ['냉기'] },
    '화염술사 로브': { resist: ['화염'] },
    '세계수 갑주': { regenPerTurn: 0.03 },
    '세계수 뿌리 갑옷': { regenPerTurn: 0.05 },
});

const SHIELD_PASSIVES: Readonly<Record<string, EquipmentPassive>> = Object.freeze({
    '화염 방패': { resist: ['화염'] },
    '원시의 이지스': { resist: ALL_RESIST_ELEMENTS },
});

export const EQUIPMENT_PASSIVES: Readonly<Record<EquipmentPassiveSlotType, Readonly<Record<string, EquipmentPassive>>>> = Object.freeze({
    armor: ARMOR_PASSIVES,
    shield: SHIELD_PASSIVES,
});
