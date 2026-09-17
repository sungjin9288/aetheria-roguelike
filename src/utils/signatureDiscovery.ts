import { ITEMS } from '../data/items.js';
import signatureRegistryData from '../data/signatureRegistry.json' with { type: 'json' };
import signatureSetsData from '../data/signatureSets.json' with { type: 'json' };
import type { Player } from '../types/player.js';

type CodexBucket = 'weapons' | 'armors' | 'shields';

const SIGNATURE_NAMES = Object.keys(signatureRegistryData?.entries || {});
const SIGNATURE_NAME_SET = new Set(SIGNATURE_NAMES);
const SIGNATURE_SETS = Object.values(signatureSetsData?.sets || {}) as any[];

const ITEM_BUCKETS = new Map<string, CodexBucket>([
    ...(ITEMS.weapons || []),
    ...(ITEMS.armors || []),
].map((item: any) => [
    item.name,
    item.type === 'weapon' ? 'weapons' : item.type === 'shield' ? 'shields' : 'armors' as CodexBucket,
]));

const isSignatureDiscovered = (name: string, player: Player) => {
    const bucket = ITEM_BUCKETS.get(name);
    return bucket ? Boolean(player.stats?.codex?.[bucket]?.[name]) : false;
};

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
