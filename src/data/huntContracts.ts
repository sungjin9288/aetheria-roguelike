/**
 * 지역 토벌 의뢰 (2026-10 Wave 80, 소유자 결정 "회차마다 다시 하는 지역 토벌 의뢰").
 *
 * 재미 리듬 감사(원장 §80 · §83)에서 Lv41 ~ 45 구간은 큰 순간이 가장 드문 구간이었다 — 이 구간의 레벨업은 천공 정원(41%) ·
 * 어둠의 지하 감옥(40%) · 지하 미궁(19%)에서 일어나고, 어둠의 지하 감옥에는 보스도 이야기 단계도 없다. 이 세 지역에 회차마다
 * 다시 하는 3단계 의뢰를 둔다: 처치 → 정예 처치 → 그 지역의 우두머리. 진행은 런 범위(`player.huntContracts`)다.
 */
export const HUNT_CONTRACTS = [
    { map: '천공 정원', champion: '폭풍을 부르는 자' },
    { map: '어둠의 지하 감옥', champion: '감옥의 간수장' },
    { map: '지하 미궁', champion: '미궁의 포식자' },
] as const;

export type HuntContractDef = typeof HUNT_CONTRACTS[number];
export type HuntContractMap = HuntContractDef['map'];

export const getHuntContract = (map: string | null | undefined): HuntContractDef | null => (
    HUNT_CONTRACTS.find((contract) => contract.map === map) ?? null
);
