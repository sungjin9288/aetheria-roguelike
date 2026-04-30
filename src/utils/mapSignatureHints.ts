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

/**
 * @typedef {{ name: string, rate: number }} MapSignatureDrop
 */

/** @returns {Readonly<Record<string, ReadonlyArray<MapSignatureDrop>>>} */
const buildMapIndex = () => {
    /** @type {Record<string, MapSignatureDrop[]>} */
    const index = {};
    for (const [mapName, map] of Object.entries(MAPS)) {
        const monsters = Array.isArray(map?.monsters) ? map.monsters : [];
        // signature name → best rate (동일 signature가 여러 몬스터에서 드롭 가능할 때 최고 rate만 남김)
        const seen = new Map();
        for (const monsterName of monsters) {
            const drops = DROP_TABLES[monsterName];
            if (!Array.isArray(drops)) continue;
            for (const drop of drops) {
                const itemName = drop?.item;
                if (!itemName || !SIGNATURE_ITEM_REGISTRY[itemName]) continue;
                const rate = Number(drop.rate) || 0;
                if (!seen.has(itemName) || seen.get(itemName) < rate) {
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
export const getMapSignatureDrops = (mapName) => {
    if (!mapName || typeof mapName !== 'string') return [];
    return MAP_INDEX[mapName] || [];
};

/**
 * 맵의 signature 중 플레이어가 아직 도감에 등록하지 않은 것만 반환.
 *
 * @param {string | null | undefined} mapName
 * @param {{ stats?: { codex?: object } } | null | undefined} player
 * @returns {ReadonlyArray<MapSignatureDrop>}
 */
export const getMapUndiscoveredSignatures = (mapName, player) => {
    const drops = getMapSignatureDrops(mapName);
    if (drops.length === 0) return [];
    const codex = player?.stats?.codex || {};
    const weapons = codex.weapons || {};
    const armors = codex.armors || {};
    const shields = codex.shields || {};
    return drops.filter(({ name }) => !(weapons[name] || armors[name] || shields[name]));
};
