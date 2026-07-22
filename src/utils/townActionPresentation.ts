import type { Player } from '../types/index.js';

export type TownActionKey = 'explore' | 'move' | 'rest' | 'quests' | 'market' | 'class' | 'craft' | 'grave';

type TownPrimaryKind =
    | 'claim_quest'
    | 'explore'
    | 'open_class'
    | 'open_inventory'
    | 'open_move'
    | 'open_quest_board'
    | 'rest';

interface TownActionContext {
    player: Player;
    stats: { maxHp?: number; maxMp?: number };
    guidance: any;
    preparation: any;
    hasGrave: boolean;
    classes: Record<string, any>;
    recipes: any[];
    consumables: any[];
}

const FACILITY_KEYS: TownActionKey[] = ['rest', 'quests', 'market', 'class', 'craft'];
const FACILITY_LABELS: Record<string, string> = {
    rest: '휴식',
    quests: '임무',
    market: '상점',
    class: '전직',
    craft: '제작',
};

const PRIMARY_BUTTON_KEYS: Partial<Record<TownPrimaryKind, TownActionKey>> = {
    explore: 'explore',
    open_class: 'class',
    open_move: 'move',
    open_quest_board: 'quests',
    rest: 'rest',
};

const PRIMARY_TEST_IDS: Record<TownPrimaryKind, string> = {
    claim_quest: 'control-claim-quest-reward',
    explore: 'control-explore',
    open_class: 'control-class',
    open_inventory: 'control-town-open-inventory',
    open_move: 'control-expedition-start',
    open_quest_board: 'control-quests',
    rest: 'control-rest',
};

const countItems = (items: any[]) => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
        if (!item?.name) return;
        counts.set(item.name, (counts.get(item.name) || 0) + 1);
    });
    return counts;
};

const canCraftRecipe = (player: Player, recipes: any[]) => {
    const inventory = player.inv || [];
    const counts = countItems(inventory);
    return recipes.some((recipe) => (
        (player.gold || 0) >= (recipe.gold || 0)
        && (recipe.inputs || []).every((input: any) => (
            (counts.get(input.name) || 0) >= (input.qty || 0)
        ))
    ));
};

const getPrimaryKind = (guidance: any, preparation: any): TownPrimaryKind => {
    if (preparation?.isClaimable) return 'claim_quest';

    const guidedKind = guidance?.primaryAction?.kind as TownPrimaryKind | undefined;
    if (guidedKind && PRIMARY_TEST_IDS[guidedKind]) return guidedKind;

    return preparation?.tracker ? 'open_move' : 'open_quest_board';
};

const getPrimaryLabel = (kind: TownPrimaryKind, guidance: any, preparation: any) => {
    switch (kind) {
        case 'claim_quest':
            return '임무 보상 받기';
        case 'open_move':
            if (!preparation?.canDepart) return '출발 경로 확인';
            return preparation?.tracker
                ? `${preparation.destination}으로 출발`
                : `${preparation.destination}으로 첫 출발`;
        case 'open_quest_board':
            return '임무 고르기';
        case 'rest':
            return '휴식하고 준비';
        case 'open_class':
            return '전직 선택하기';
        case 'open_inventory':
            return '가방 정리하기';
        case 'explore':
            return '탐험 시작';
        default:
            return guidance?.primaryAction?.label || '다음 행동';
    }
};

export const getTownActionPresentation = ({
    player,
    stats,
    guidance,
    preparation,
    hasGrave,
    classes,
    recipes,
    consumables,
}: TownActionContext) => {
    const primaryKind = getPrimaryKind(guidance, preparation);
    const primaryKey = PRIMARY_BUTTON_KEYS[primaryKind] || null;
    const inventory = player.inv || [];
    const maxHp = Math.max(1, stats.maxHp || player.maxHp || 1);
    const maxMp = Math.max(1, stats.maxMp || player.maxMp || 1);
    const hpRatio = (player.hp || 0) / maxHp;
    const mpRatio = (player.mp || 0) / maxMp;
    const needsRest = hpRatio < 0.85 || mpRatio < 0.6 || (player.status || []).length > 0;

    const currentClass = classes[player.job || ''];
    const nextClasses = currentClass?.next || [];
    const nextClassLevel = nextClasses.length > 0
        ? Math.min(...nextClasses.map((name: string) => classes[name]?.reqLv || Number.POSITIVE_INFINITY))
        : null;
    const canChangeClass = nextClasses.some((name: string) => (
        (player.level || 1) >= (classes[name]?.reqLv || Number.POSITIVE_INFINITY)
    ));
    const canCraft = canCraftRecipe(player, recipes);

    const recoveryItems = inventory.filter((item) => (
        typeof item?.type === 'string' && ['hp', 'mp', 'cure'].includes(item.type)
    ));
    const cheapestSupply = consumables.reduce(
        (lowest, item) => Math.min(lowest, item?.price || Number.POSITIVE_INFINITY),
        Number.POSITIVE_INFINITY,
    );
    const needsSupply = recoveryItems.length <= 1 && (player.gold || 0) >= cheapestSupply;
    const questNeedsAttention = Boolean(
        preparation?.tracker
        || primaryKind === 'claim_quest'
        || primaryKind === 'open_quest_board',
    );

    const contextualKeys: TownActionKey[] = [];
    if (hasGrave) contextualKeys.push('grave');
    if (needsRest && primaryKey !== 'rest') contextualKeys.push('rest');
    if (questNeedsAttention && primaryKey !== 'quests') contextualKeys.push('quests');
    if (canChangeClass && primaryKey !== 'class') contextualKeys.push('class');
    if (canCraft && primaryKey !== 'craft') contextualKeys.push('craft');
    if (needsSupply && primaryKey !== 'market') contextualKeys.push('market');

    const quickKeys = [...contextualKeys.slice(0, 1), 'explore', 'move'] as TownActionKey[];
    const visibleKeys = new Set<TownActionKey>([...quickKeys, ...(primaryKey ? [primaryKey] : [])]);
    const facilityKeys = FACILITY_KEYS.filter((key) => !visibleKeys.has(key));

    return {
        primary: {
            kind: primaryKind,
            key: primaryKey,
            label: getPrimaryLabel(primaryKind, guidance, preparation),
            testId: PRIMARY_TEST_IDS[primaryKind],
            disabled: primaryKind === 'open_move' && !preparation?.canDepart,
            tone: primaryKind === 'claim_quest' ? 'reward' : 'primary',
        },
        quickKeys,
        facilityKeys,
        facilitySummary: facilityKeys.map((key) => FACILITY_LABELS[key]).join(' · '),
        facilityStatus: {
            rest: needsRest ? '회복 가능' : '정비 완료',
            quests: preparation?.isClaimable
                ? '보상 대기'
                : preparation?.tracker
                    ? '진행 중'
                    : '새 임무',
            market: needsSupply ? '보급 권장' : '이용 가능',
            class: canChangeClass
                ? '전직 가능'
                : nextClassLevel && Number.isFinite(nextClassLevel)
                    ? `레벨 ${nextClassLevel}`
                    : '최종 전직',
            craft: canCraft ? '제작 가능' : '재료 필요',
        },
    };
};
