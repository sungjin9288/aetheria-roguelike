/**
 * mapSignatureHints.js — 맵(지역) 단위 signature 드롭 집계.
 *
 * MapNavigator가 "이 맵에 전설 각인 떨어진다" 배지를 그리는 데 사용.
 * 플레이어가 맵을 고르는 순간 anticipation을 유도 (combat 진입 전).
 *
 * 빌드 시 monsters × DROP_TABLES × SIGNATURE_ITEM_REGISTRY를 교차해서
 * 맵별 인덱스를 미리 구축. 런타임 조회는 O(1).
 */

import { MAPS } from '../data/maps.js';
import { DROP_TABLES } from '../data/dropTables.js';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';
import type { Player } from '../types/index.js';
import { isSignatureDiscovered } from './signatureDiscovery.js';

interface MapSignatureDrop {
    name: string;
    rate: number;
}

const buildMapIndex = (): Readonly<Record<string, readonly MapSignatureDrop[]>> => {
    const index: Record<string, readonly MapSignatureDrop[]> = {};
    for (const [mapName, map] of Object.entries(MAPS)) {
        const monsters = Array.isArray(map?.monsters) ? map.monsters : [];
        const bossMonsters = Array.isArray(map?.bossMonsters) ? map.bossMonsters : [];
        // cycle 69: map.boss 단일 필드도 포함 (신성한 호수의 고대 호수의 수호신처럼
        // 단일 보스 정의에 signature drop이 있는 경우 hint 인덱스에서 누락되던 버그 수정).
        const singleBoss = typeof map?.boss === 'string' ? [map.boss] : [];
        const allMonsters: string[] = [...monsters, ...bossMonsters, ...singleBoss];
        // signature name → best rate (동일 signature가 여러 몬스터에서 드롭 가능할 때 최고 rate만 남김)
        const seen = new Map<string, number>();
        for (const monsterName of allMonsters) {
            const drops = DROP_TABLES[monsterName];
            if (!Array.isArray(drops)) continue;
            for (const drop of drops) {
                const itemName = drop?.item;
                if (!itemName || !SIGNATURE_ITEM_REGISTRY[itemName]) continue;
                const rate = Number(drop.rate) || 0;
                if (!seen.has(itemName) || (seen.get(itemName) ?? 0) < rate) {
                    seen.set(itemName, rate);
                }
            }
        }
        const drops = [...seen.entries()]
            .map(([name, rate]) => ({ name, rate }))
            .sort((a, b) => b.rate - a.rate);
        index[mapName] = Object.freeze(drops);
    }
    return Object.freeze(index);
};

const MAP_INDEX = buildMapIndex();

/**
 * 주어진 맵에서 드롭 가능한 signature 목록 (rate 내림차순, unique by name).
 *
 * @param {string | null | undefined} mapName
 * @returns {ReadonlyArray<MapSignatureDrop>}
 */
export const getMapSignatureDrops = (mapName: string | null | undefined) => {
    if (!mapName || typeof mapName !== 'string') return [];
    return MAP_INDEX[mapName] || [];
};

/**
 * 2026-10 Wave 103 (소유자 결정 §107.6 "전설 각인 획득처는 얻은 뒤에만 공개"): 이 지역에서 나오는 각인 중 이미 도감에 있는 것만.
 * 지도가 읽는다 — 다시 노릴 곳은 보이고, 아직 없는 각인의 획득처와 개수는 보이지 않는다.
 */
export const getMapDiscoveredSignatureDrops = (mapName: string | null | undefined, player: Player | null | undefined) => (
    player ? getMapSignatureDrops(mapName).filter(({ name }) => isSignatureDiscovered(name, player)) : []
);
