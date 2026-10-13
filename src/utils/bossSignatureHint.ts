/**
 * bossSignatureHint.js — 보스 조우 시 signature 각인 드롭 가능성을 예고.
 *
 * discover → anticipate → act 피드백 체인의 "anticipate" 레이어:
 *   - Drop overlay (act) 직전에, boss 등장 시 플레이어에게 "이 보스는 전설을 떨굴 수 있다"를 속삭인다.
 *   - Terminal legendary 로그로 emit (gold 스타일 재사용).
 *
 * DROP_TABLES(데이터)와 SIGNATURE_ITEM_REGISTRY(레지스트리)를 intersect만 할 뿐,
 * 실제 드롭 확률을 수정하지 않는다. 순수 UI 힌트.
 */

import { DROP_TABLES } from '../data/dropTables.js';
import { SIGNATURE_ITEM_REGISTRY } from '../data/signatureItems.js';
import type { Player } from '../types/index.js';
import { isSignatureDiscovered } from './signatureDiscovery.js';

/**
 * 주어진 몬스터의 drop table에서 signature 아이템만 추출.
 *
 * @param {string | null | undefined} baseName - 몬스터의 baseName (prefix 제외)
 * @returns {{ name: string, rate: number }[]} rate 내림차순 정렬
 */
export const getBossSignatureDrops = (baseName: string | null | undefined) => {
    if (!baseName || typeof baseName !== 'string') return [];
    const entries = DROP_TABLES[baseName];
    if (!Array.isArray(entries)) return [];

    const signatureDrops = [];
    for (const entry of entries) {
        if (!entry?.item) continue;
        if (!SIGNATURE_ITEM_REGISTRY[entry.item]) continue;
        signatureDrops.push({ name: entry.item, rate: Number(entry.rate) || 0 });
    }
    // rate 내림차순 — 최고 확률 signature가 hint 헤드라인이 됨
    signatureDrops.sort((a, b) => b.rate - a.rate);
    return signatureDrops;
};

/**
 * 2026-10 Wave 103 (소유자 결정 §107.6 "전설 각인 획득처는 얻은 뒤에만 공개"): 이 보스가 떨어뜨리는 각인 중 이미 도감에 있는 것만.
 * 보스 배너 · 보스 등장 기록이 읽는다 — 아직 없는 각인이 어디서 나오는지는 플레이어가 알아낸다.
 */
export const getDiscoveredBossSignatureDrops = (baseName: string | null | undefined, player: Player | null | undefined) => (
    player ? getBossSignatureDrops(baseName).filter(({ name }) => isSignatureDiscovered(name, player)) : []
);
