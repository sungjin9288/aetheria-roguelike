/**
 * Signature items — "family art" 대신 아이템별 고유 wearable/item art를 가진 장비.
 *
 * ## 왜 분리하는가
 * - 일반/언커먼/레어(아이템 전체의 ~90%)는 family wearable + palette swap으로 커버 (작업비 ≈ 0).
 * - 레전더리/보스 드롭/스토리 고유템(10~20개)만 고유 아트. 드롭 "와" 모먼트를 희귀할 때만 쏟아내기.
 * - Hades/Moonlighter/Dead Cells가 실제로 쓰는 하이브리드 방식.
 *
 * ## 기존 인프라 재사용
 * 현재 `itemVisuals.js`의 `SPECIAL_ITEM_ICON_KEYS`가 사실상 signature 시스템이다.
 * 이 파일은 그 위에 얇은 타입 레이어 + 큐레이션 리스트 + 확장 후보만 추가한다.
 *
 * ## 자산 경로 규칙
 * - Item art (상점/인벤토리):  /assets/equipment-exact/{spriteKey}.png
 * - Wearable overlay (아바타 착용): /assets/equipment-wearable-exact/{spriteKey}.png (옵션 — 없으면 family fallback)
 *
 * ## 새 signature 아이템 추가 절차
 * 1. items.js에 아이템 등록.
 * 2. 아래 `SIGNATURE_ITEM_REGISTRY`에 `itemId -> spriteKey` 매핑 추가.
 * 3. itemVisuals.js의 `SPECIAL_ITEM_ICON_KEYS`에도 `itemName -> spriteKey` 추가 (backwards compat).
 * 4. /assets/equipment-exact/{spriteKey}.png 파일 배치 (artPalette.json rule 준수).
 * 5. Optional: /assets/equipment-wearable-exact/{spriteKey}.png 배치하면 아바타도 고유 art로.
 */

import registrySource from './signatureRegistry.json' with { type: 'json' };

// NOTE: 이전 버전에서는 `../utils/itemVisuals.js`의 SPECIAL_ITEM_ICON_KEYS를 import했으나,
// signatureItems는 src/data 소속(→ game-data 청크)이고 itemVisuals는 utils 소속(기본 청크)이라
// Rollup chunk 그래프에 game-combat → game-data → game-combat circular warning이 발생했음.
// tint-based named 아이템 탐색은 itemVisuals 쪽에서 이미 `SIGNATURE_SPRITE_KEY_BY_NAME` +
// `SPECIAL_ITEM_ICON_KEYS` 폴백으로 처리하므로 signatureItems는 dedicated 레지스트리만 책임진다.

/**
 * 현재 items.js는 id 필드를 쓰지 않으므로 name을 키로 한다.
 * 실제 데이터는 signatureRegistry.json에 있고, 이 파일은 런타임 헬퍼를 노출한다.
 *
 * sprite 파일은 `scripts/generate_signature_sprites.py`가 생성하며,
 * - item view: /assets/equipment-exact/{spriteKey}.png
 * - wearable overlay: /assets/equipment-wearable-exact/{spriteKey}.png
 * 에 배치된다.
 */
export const SIGNATURE_ITEM_REGISTRY = Object.freeze(
    Object.fromEntries(
        Object.entries(registrySource.entries).map(([name, meta]: any) => [name, Object.freeze({ ...meta })])
    )
);

/**
 * 시그니처 우선순위 제작 큐 — 아트 사이클에서 고유 wearable을 만들 후보.
 *
 * 선정 기준 (art direction 리뷰 요약):
 *   1. 플레이어 기억에 강렬히 남는 이정표 드롭 (마왕/보스 전리품)
 *   2. 세트/시너지의 핵심 아이템 (UI상 중요도 높음)
 *   3. 프레스티지/엔딩 연계 서사 아이템
 *   4. 실루엣이 family 공용과 확연히 다른 쪽 (고유 art의 가치가 큰 쪽)
 *
 * 리스트는 제작 순서로 정렬 (위에서부터 먼저 만들 것).
 */
export const SIGNATURE_CANDIDATES = Object.freeze([
    // ── Tier S: 마왕/엔딩 드롭 (서사 이정표)
    { itemName: '성검 에테르니아', slot: 'weapon', reason: '진 엔딩 이정표 · 빛 속성 원-핸드 상징' },
    { itemName: '마왕의 대낫', slot: 'weapon', reason: '마왕 전용 드롭 · 2H 대낫 실루엣' },
    { itemName: '라그나로크', slot: 'weapon', reason: '최상위 2H · 종말 테마' },
    { itemName: '차원 마왕의 낫', slot: 'weapon', reason: '차원 마왕 드롭 · Abyss 루트 상징' },
    { itemName: '천공 성전', slot: 'shield', reason: '최상위 방패 · 성광 엠블럼' },

    // ── Tier A: 주요 보스 드롭 / 세트 핵심
    { itemName: '드래곤로드 갑주', slot: 'armor', reason: '드래곤로드 처치 드롭 · 용비늘 실루엣' },
    { itemName: '암흑 군주의 망토', slot: 'armor', reason: '암흑 군주 드롭 · 흑마법사 세트 핵심' },
    { itemName: '세계수의 지팡이', slot: 'weapon', reason: '세계수 드롭 · 자연 세트 핵심' },
    { itemName: '차원 방패 이지스', slot: 'shield', reason: '차원 세트 방패 · 최상위 가드' },
    { itemName: '에테르 그리모어', slot: 'shield', reason: 'focus offhand · 캐스터 세트' },

    // ── Tier B: 확장 후보 (다음 사이클)
    { itemName: '천벌의 지팡이', slot: 'weapon', reason: '빛 속성 최상위 스태프' },
    { itemName: '빙결의 왕관검', slot: 'weapon', reason: '냉기 원-핸드 시그니처' },
    { itemName: '바람의 궁극', slot: 'weapon', reason: '궁극 아처 드롭' },
    { itemName: '그림자 절단기', slot: 'weapon', reason: '그림자 주군 세트 핵심' },
    { itemName: '성스러운 창', slot: 'weapon', reason: '팔라딘 창 — lance family와 차별 실루엣' },
    { itemName: '용의 화염', slot: 'weapon', reason: '화염 용 드롭 · 화염 세트' },
    { itemName: '세계수의 검', slot: 'weapon', reason: '자연 세트 검' },
    { itemName: '신전 도시의 지팡이', slot: 'weapon', reason: '홀리 캐스터 세트' },
    { itemName: '광기의 갑주', slot: 'armor', reason: '버서커 세트 핵심' },
    { itemName: '세계수의 로브', slot: 'armor', reason: '자연 세트 핵심' },
]);

/** 아이템이 dedicated signature인지 확인 (Tier S/A/B 고유 아트 보유). */
export const isSignatureItem = (item: any) => (
    Boolean(item?.name && SIGNATURE_ITEM_REGISTRY[item.name])
);

/** 아이템의 dedicated signature sprite key 반환 (없으면 null). */
export const getSignatureSpriteKey = (item: any) => {
    if (!item || !item.name) return null;
    const meta = SIGNATURE_ITEM_REGISTRY[item.name];
    return meta ? meta.spriteKey : null;
};

/** 진짜 고유 아트가 있는지 (tint 기반 named는 제외) — UI badge/effects에 사용. */
export const hasDedicatedSignatureArt = (item: any) => (
    Boolean(item?.name && SIGNATURE_ITEM_REGISTRY[item.name])
);

/** signature 메타데이터 반환 (tier, category, tone, artNote). 없으면 null. */
export const getSignatureMetadata = (item: any) => {
    if (!item?.name) return null;
    return SIGNATURE_ITEM_REGISTRY[item.name] || null;
};

/** 현재 dedicated signature를 가진 아이템 수 (telemetry용). */
export const getSignatureItemCount = () => {
    const dedicated = Object.keys(SIGNATURE_ITEM_REGISTRY).length;
    return { total: dedicated, dedicated };
};

/**
 * 플레이어의 signature 도감 진행도 조회.
 *
 * player.stats.codex.{weapons|armors|shields}에서 SIGNATURE_ITEM_REGISTRY에 등록된
 * 이름이 발견됐는지 검사. family 아이템은 별도로 다른 레코드가 있으므로 섞이지 않는다.
 *
 * Dashboard/Codex 탭 뱃지, Achievement 카운터 등에서 재사용.
 *
 * @param {{ stats?: { codex?: object } } | null | undefined} player
 * @returns {{ discovered: number, total: number, percent: number }}
 */
export const getSignatureDiscoveryProgress = (player: any) => {
    const total = Object.keys(SIGNATURE_ITEM_REGISTRY).length;
    const codex = player?.stats?.codex || null;
    if (!codex) return { discovered: 0, total, percent: 0 };

    const weapons = codex.weapons || {};
    const armors = codex.armors || {};
    const shields = codex.shields || {};

    let discovered = 0;
    for (const name of Object.keys(SIGNATURE_ITEM_REGISTRY)) {
        if (weapons[name] || armors[name] || shields[name]) {
            discovered += 1;
        }
    }

    const percent = total > 0 ? Math.round((discovered / total) * 100) : 0;
    return { discovered, total, percent };
};
