import { getRegionTheme } from '../utils/regionTheme';
import type { GameMap } from '../types/map';

/**
 * 2026-11 오버월드 3단계 — 지역 지도의 바이옴(타일 무늬 · 색). 소유자 결정 2026-11-16 "바이옴 8종을 숲처럼 코드로 그린다".
 * 바이옴은 지역 색 테마(`utils/regionTheme` — 이름 키워드 + 종류)에서 도출한다 — 데이터 필드를 더하지 않는다.
 * 테마 9종 중 사막(피라미드 · 고대 보물고 — 둘 다 옛 구조물)은 폐허 바이옴으로 묶는다. 길 잃은 여행이면 화면이 테마를
 * 숨기므로(`getVisibleRegionTheme`) 바이옴도 가장 중립적인 폐허로 그린다. 판정 · 난수와 무관한 표시 도출이다.
 */

export type FieldBiome = 'forest' | 'water' | 'ember' | 'frost' | 'sky' | 'arcane' | 'abyss' | 'ruin';

export const FIELD_BIOMES: readonly FieldBiome[] = ['forest', 'water', 'ember', 'frost', 'sky', 'arcane', 'abyss', 'ruin'];

const THEME_TO_BIOME: Readonly<Record<string, FieldBiome>> = {
    forest: 'forest',
    water: 'water',
    ember: 'ember',
    frost: 'frost',
    storm: 'sky',
    arcane: 'arcane',
    abyss: 'abyss',
    ruin: 'ruin',
    desert: 'ruin',
    haven: 'ruin',
};

export const getFieldBiome = (loc: string | null | undefined, mapData: GameMap | null | undefined, hidden = false): FieldBiome => {
    if (hidden) return 'ruin';
    return THEME_TO_BIOME[getRegionTheme(loc, mapData).key] ?? 'ruin';
};
