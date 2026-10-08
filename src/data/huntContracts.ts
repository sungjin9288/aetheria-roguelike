/**
 * 지역 토벌 의뢰 (2026-10 Wave 80, 소유자 결정 "회차마다 다시 하는 지역 토벌 의뢰").
 *
 * 재미 리듬 감사(원장 §80 · §83)에서 Lv41 ~ 45 구간은 큰 순간이 가장 드문 구간이었다 — 이 구간의 레벨업은 천공 정원(41%) ·
 * 어둠의 지하 감옥(40%) · 지하 미궁(19%)에서 일어나고, 어둠의 지하 감옥에는 보스도 이야기 단계도 없다. 이 세 지역에 회차마다
 * 다시 하는 3단계 의뢰를 둔다: 처치 → 정예 처치 → 그 지역의 우두머리. 진행은 런 범위(`player.huntContracts`)다.
 * Wave 81: 우두머리는 기척(2단계 완료) → 접근(그 지역 처치 `HUNT_CHAMPION_OMEN_KILLS`번) → 출현의 세 박자다.
 */
import type { StatusId } from '../types/index.js';

/**
 * Wave 82 (소유자 결정 "b, c 같이"): `status`는 그 지역 우두머리가 강타와 격노로 거는 상태 이상이다.
 */
export const HUNT_CONTRACTS: ReadonlyArray<{ readonly map: string; readonly champion: string; readonly status: StatusId }> = [
    // 2026-10 Wave 81 (소유자 결정 "B, C 같이"): 1회차 긴 공백이 시작되는 Lv26 ~ 40의 세 지역(고대 마법 탑 · 용의 둥지 · 용암 지대)을 더했다.
    // Wave 83 (소유자 결정 (c)): 2회차 긴 공백의 시작점 2위(몰락한 전초기지 Lv16 ~ 25).
    { map: '몰락한 전초기지', champion: '녹슨 철의 군주', status: 'bleed' },
    { map: '고대 마법 탑', champion: '탑의 대마도사', status: 'curse' },
    { map: '용의 둥지', champion: '둥지의 폭군', status: 'burn' },
    { map: '용암 지대', champion: '용암의 심장', status: 'burn' },
    { map: '천공 정원', champion: '폭풍을 부르는 자', status: 'stun' },
    { map: '어둠의 지하 감옥', champion: '감옥의 간수장', status: 'bleed' },
    { map: '지하 미궁', champion: '미궁의 포식자', status: 'poison' },
];

export type HuntContractDef = typeof HUNT_CONTRACTS[number];

export const getHuntContract = (map: string | null | undefined): HuntContractDef | null => (
    HUNT_CONTRACTS.find((contract) => contract.map === map) ?? null
);
