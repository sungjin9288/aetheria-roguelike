import { ITEMS } from '../data/items.js';
import signatureRegistryData from '../data/signatureRegistry.json' with { type: 'json' };
import signatureSetsData from '../data/signatureSets.json' with { type: 'json' };
import type { Item } from '../types/item.js';
import type { Player } from '../types/player.js';

type CodexBucket = 'weapons' | 'armors' | 'shields';

export const SIGNATURE_NAMES = Object.keys(signatureRegistryData?.entries || {});
const SIGNATURE_NAME_SET = new Set(SIGNATURE_NAMES);
// resolveJsonModule이 signatureSets.json의 각 세트 모양(members/bonuses 등)을 이미
// 정확히 추론한다 — 캐스트 없이도 union 배열로 쓸 수 있다.
const SIGNATURE_SETS = Object.values(signatureSetsData?.sets || {});

const EQUIPMENT_NAMES = new Set<string>(
    [...(ITEMS.weapons || []), ...(ITEMS.armors || [])]
        .filter((item): item is Item & { name: string } => Boolean(item.name))
        .map((item) => item.name),
);

export const isSignatureName = (name: unknown): name is string => (
    typeof name === 'string' && SIGNATURE_NAME_SET.has(name)
);

const EQUIPMENT_BUCKETS: readonly CodexBucket[] = ['weapons', 'armors', 'shields'];

/**
 * 장비 이름이 이번 여정의 도감(무기 · 방어구 · 방패)에 있는가 — 도감은 사망하면 비워진다(Wave 108).
 * 이름은 칸을 가로질러 유일하므로 세 칸을 모두 본다(다른 칸에 적힌 이전 기록도 발견이다).
 */
const isInCodex = (name: string, player: Player) => (
    EQUIPMENT_NAMES.has(name) && EQUIPMENT_BUCKETS.some((bucket) => Boolean(player.stats?.codex?.[bucket]?.[name]))
);

const readSignatureNames = (value: unknown): string[] => (
    Array.isArray(value) ? value.filter(isSignatureName) : []
);

/**
 * 2026-10 Wave 125 (소유자 결정 "각인 수집만 계정 단위"): 이 계정이 지난 여정에서 발견한 전설 각인 — 사망 · 계승을 넘는다.
 * 기록은 `pickPermanentPlayerState` 한 곳이 도감을 비우기 직전에 남긴다(`collectSignatureLedger`) — 각인을 얻는 지점(전리품 ·
 * 정복 · 체인 · 보스 보상 · 제작 …)마다 쓰지 않는다(Wave 100 교훈: 하나만 빠져도 기록이 틀린다).
 * 장부가 없는 이전 세이브는 계정에 남아 있던 발견 흔적(회차 시작 기준점 · 직업 여정의 각인)으로 채운다.
 */
export const getSignatureLedger = (player: Pick<Player, 'stats' | 'meta' | 'classJourney'>): string[] => {
    const ledger = player.stats?.signatureLedger;
    if (Array.isArray(ledger)) return readSignatureNames(ledger);
    const journeyItems = Object.values(player.classJourney?.byJob || {})
        .flatMap((record) => readSignatureNames(record?.signatureItems));
    return [...new Set([...readSignatureNames(player.meta?.cycleStart?.signatures), ...journeyItems])];
};

/** 발견한 전설 각인 이름(규칙 표 순서) — 이번 여정 도감 ∪ 계정 장부. */
export const getDiscoveredSignatureNames = (player: Player): string[] => {
    const known = new Set(getSignatureLedger(player));
    return SIGNATURE_NAMES.filter((name) => known.has(name) || isInCodex(name, player));
};

/** 사망 · 계승이 넘기는 장부 — 지금까지의 장부 + 이번 여정 도감의 각인, 곧 지금 발견한 각인 전부다. */
export const collectSignatureLedger = getDiscoveredSignatureNames;

/** 전설 각인을 발견했는가 — 이번 여정의 도감 또는 계정 장부(Wave 125). 획득처 공개(Wave 103) · 수집 · 업적이 같이 읽는다. */
export const isSignatureDiscovered = (name: string, player: Player) => (
    isSignatureName(name) && (isInCodex(name, player) || getSignatureLedger(player).includes(name))
);

/**
 * 장비 이름을 안다(가진 적 있다) — 전설 각인은 계정 장부까지, 그 밖의 장비는 이번 여정 도감이다(Wave 103 직업 세트 목록).
 */
export const isEquipmentDiscovered = (name: string, player: Player) => (
    isInCodex(name, player) || isSignatureDiscovered(name, player)
);

/**
 * 이번 여정 도감에 오른 전설 각인 수 — 여정 임무(202 '전설 기록자')가 읽는다. 임무는 사망 · 계승마다 처음부터라 계정 수집을 읽으면
 * 받자마자 끝나는 임무가 된다(Wave 108: 여정 범위 진행은 여정 기록을 읽는다).
 */
export const countCodexSignatures = (player: Player) => (
    SIGNATURE_NAMES.filter((name) => isInCodex(name, player)).length
);

export const countDiscoveredSignatures = (player: Player) => getDiscoveredSignatureNames(player).length;

/** 전설 각인 수집 진행 — 도감 배지 · 계승 화면이 읽는다(계정 수집, Wave 125). */
export const getSignatureDiscoveryProgress = (player: Player | null | undefined) => {
    const total = SIGNATURE_NAMES.length;
    const discovered = player ? countDiscoveredSignatures(player) : 0;
    const percent = total > 0 ? Math.round((discovered / total) * 100) : 0;
    return { discovered, total, percent };
};

export const countCompletedSignatureSets = (player: Player) => {
    const known = new Set(getDiscoveredSignatureNames(player));
    return SIGNATURE_SETS.filter((setDefinition) => {
        const members = setDefinition?.members || [];
        return members.length > 0 && members.every((name: string) => known.has(name));
    }).length;
};

/**
 * 2026-10 Wave 103 (소유자 결정 §107.6 "전설 각인 획득처는 얻은 뒤에만 공개"): 제작소에 보일 제작법 — 결과물이 아직 도감에 없는
 * 전설 각인인 제작법은 숨긴다(제작법 자체가 획득처다). 각인을 다른 길로 얻으면 그 제작법이 보인다.
 */
export const getVisibleCraftRecipes = <T extends { name?: string }>(recipes: readonly T[], player: Player): T[] => (
    recipes.filter((recipe) => !isSignatureName(recipe.name) || isSignatureDiscovered(recipe.name as string, player))
);

/** 2026-10 Wave 103: 이름 목록에서 아직 도감에 없는 전설 각인을 뺀다 — 몬스터 도감의 전리품 칩이 읽는다(획득처는 플레이어가 알아낸다). */
export const withoutUndiscoveredSignatures = (names: readonly string[], player: Player | null | undefined): string[] => (
    names.filter((name) => !isSignatureName(name) || (player ? isSignatureDiscovered(name, player) : false))
);
