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

const ITEM_BUCKETS = new Map<string, CodexBucket>(
    [...(ITEMS.weapons || []), ...(ITEMS.armors || [])]
        .filter((item): item is Item & { name: string } => Boolean(item.name))
        .map((item): [string, CodexBucket] => [
            item.name,
            item.type === 'weapon' ? 'weapons' : item.type === 'shield' ? 'shields' : 'armors',
        ]),
);

/** 장비 이름이 도감(무기 · 방어구 · 방패)에 있는가 — 전설 각인이 아닌 장비도 같은 판정이다(Wave 103 직업 세트 목록). */
export const isEquipmentDiscovered = (name: string, player: Player) => {
    const bucket = ITEM_BUCKETS.get(name);
    return bucket ? Boolean(player.stats?.codex?.[bucket]?.[name]) : false;
};

export const isSignatureDiscovered = isEquipmentDiscovered;

export const isSignatureName = (name: unknown): name is string => (
    typeof name === 'string' && SIGNATURE_NAME_SET.has(name)
);

export const countDiscoveredSignatures = (player: Player) => (
    SIGNATURE_NAMES.filter((name) => isSignatureDiscovered(name, player)).length
);

export const getDiscoveredSignatureNames = (player: Player): string[] => (
    SIGNATURE_NAMES.filter((name) => isSignatureDiscovered(name, player))
);

export const countCompletedSignatureSets = (player: Player) => (
    SIGNATURE_SETS.filter((setDefinition) => {
        const members = setDefinition?.members || [];
        return members.length > 0 && members.every((name: string) => isSignatureDiscovered(name, player));
    }).length
);

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
