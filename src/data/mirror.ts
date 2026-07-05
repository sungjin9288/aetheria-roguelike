/**
 * 에테르 거울 (Essence Mirror) — 에센스(meta.essence) 소비 영구 업그레이드 트리.
 *
 * 2026-07 감사 — 장르 갭 (a): 에센스는 획득처 3곳(승천 +200 / 일일 프로토콜 /
 *   rank1·8 배율)이 있었지만 소비처가 0건이라 StatsPanel "LEGACY ESSENCE" 표시만
 *   있는 죽은 통화였다. Hades의 "거울"(통화를 모아 선택적으로 영구 투자)을 이식해
 *   "한 판 더"의 명분을 만든다.
 *
 * 설계 원칙: 신규 메커닉 최소 — 7개 노드 모두 기존 시스템 파라미터의 "노드화"
 *   (시작 골드 / 시작 부트 선택지 / 캠프파이어 확률 / 유물 pity / 휴식 비용 /
 *   부활 / 에센스 획득). 단일 진실 원천은 systems/mirrorUpgrades.ts의
 *   getMirrorEffects(meta) — getPrestigeUnlocks 패턴을 그대로 모방한다.
 *
 * 저장: player.meta.mirror = { [nodeId]: level } — 레벨 0(또는 키 없음)은 미구매.
 */
import { BALANCE } from './constants.js';

export interface MirrorNodeDef {
    id: string;
    name: string;
    desc: string;
    maxLevel: number;
    /** 레벨별 누적 비용 배열 — costs[0]은 Lv0→1, costs[1]은 Lv1→2 ... */
    costs: number[];
}

export const MIRROR_NODES: MirrorNodeDef[] = [
    {
        id: 'start_gold',
        name: '유산의 금고',
        desc: '레벨당 시작 골드 +100',
        maxLevel: 3,
        costs: [60, 120, 240],
    },
    {
        id: 'start_boot_extra',
        name: '각성의 선택',
        desc: '시작 부트 유물 선택지 +1',
        maxLevel: 1,
        costs: [300],
    },
    {
        id: 'campfire_rate',
        name: '모닥불의 인도',
        desc: '레벨당 캠프파이어 발견율 +2%p',
        maxLevel: 2,
        costs: [100, 200],
    },
    {
        id: 'relic_pity',
        name: '유물 감응',
        desc: '레벨당 유물 pity 누적 +25%',
        maxLevel: 2,
        costs: [120, 240],
    },
    {
        id: 'rest_discount',
        name: '야영 기술',
        desc: '레벨당 휴식 비용 -20%',
        maxLevel: 2,
        costs: [80, 160],
    },
    {
        id: 'revive',
        name: '에테르 수호',
        desc: '런당 1회, 치명상 시 HP 30%로 부활',
        maxLevel: 1,
        costs: [500],
    },
    {
        id: 'essence_flow',
        name: '에센스 공명',
        desc: '레벨당 에센스 획득 +10%',
        maxLevel: 2,
        costs: [150, 300],
    },
];

// 배율/가산 계수는 밸런스 조정 대상이므로 BALANCE로 노출.
// (MIRROR_NODES.costs/maxLevel는 트리 구조라 데이터 파일에 유지 — relics.ts의
//  RELICS 배열과 동일 관례.)
export const MIRROR_EFFECT_VALUES = {
    START_GOLD_PER_LEVEL: BALANCE.MIRROR_START_GOLD_PER_LEVEL,
    CAMPFIRE_BONUS_PER_LEVEL: BALANCE.MIRROR_CAMPFIRE_BONUS_PER_LEVEL,
    RELIC_PITY_BONUS_PER_LEVEL: BALANCE.MIRROR_RELIC_PITY_BONUS_PER_LEVEL,
    REST_DISCOUNT_PER_LEVEL: BALANCE.MIRROR_REST_DISCOUNT_PER_LEVEL,
    ESSENCE_FLOW_BONUS_PER_LEVEL: BALANCE.MIRROR_ESSENCE_FLOW_BONUS_PER_LEVEL,
    REVIVE_HP_RATIO: BALANCE.MIRROR_REVIVE_HP_RATIO,
};

export const getMirrorNode = (nodeId: string): MirrorNodeDef | undefined =>
    MIRROR_NODES.find((n) => n.id === nodeId);
