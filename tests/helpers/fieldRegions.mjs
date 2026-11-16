import { BALANCE } from '../../src/data/constants.js';

/**
 * 2026-11 오버월드 3단계 — 사냥 지역은 모두 지도 지역이다(`BALANCE.FIELD_MAP_REGIONS`). 지도가 아닌 지역의 탐험 경로(구역 보스
 * 도전 카드 · 결과 카드의 '계속 탐험' …)를 고정하는 계약은 이 도우미로 목록을 잠시 바꾼다 — 실제 게임에서 그 경로는 지도가 아닌
 * 지역(혼돈의 심연)에 남는다. 돌려준 함수가 목록을 되돌린다(자연 플레이 드라이버의 `--field forest`와 같은 방식).
 */
export const setFieldMapRegions = (regions) => {
    const backup = [...BALANCE.FIELD_MAP_REGIONS];
    BALANCE.FIELD_MAP_REGIONS.splice(0, BALANCE.FIELD_MAP_REGIONS.length, ...regions);
    return () => {
        BALANCE.FIELD_MAP_REGIONS.splice(0, BALANCE.FIELD_MAP_REGIONS.length, ...backup);
    };
};
