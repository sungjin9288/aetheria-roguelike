import type { ClassDef, Item, Player } from '../types/index.js';
import type { ItemRecipeDef } from '../types/item.js';
import { FIRST_STORY_QUEST_ID } from '../data/quests.js';
import { canInvestigateTown } from './townInvestigation';
import { getChainEventForLoc } from '../data/eventChains.js';
import type { getAdventureGuidance, getExpeditionPreparation } from './adventureGuide.js';

export type TownActionKey = 'explore' | 'move' | 'rest' | 'quests' | 'market' | 'class' | 'craft' | 'grave';

/**
 * safe 지역에서 explore 행동이 무엇을 의미하는지 — 라벨을 컴포넌트가 하드코딩하지 않게
 * 소유권을 여기로 옮긴다(Wave 16 H3). `'investigate'`는 사냥감이 있는 도시 조사(전투 가능),
 * `'chain'`은 이 지역에서 대기 중인 이야기 스텝, `null`은 explore 행동 자체가 없다는 뜻.
 */
export type TownExploreIntent = 'investigate' | 'chain' | null;

type TownPrimaryKind =
    | 'claim_quest'
    | 'explore'
    | 'open_class'
    | 'open_inventory'
    | 'open_move'
    | 'open_quest_board'
    | 'rest';

/** `getAdventureGuidance()` 반환 형태 — adventureGuide.ts는 이미 명시 any가 없는 파일이라 그대로 재사용. */
type AdventureGuidance = ReturnType<typeof getAdventureGuidance>;
/** `getExpeditionPreparation()` 반환 형태 — ControlPanel.tsx도 동일하게 `ReturnType<typeof ...>`로 참조한다. */
type ExpeditionPreparation = ReturnType<typeof getExpeditionPreparation>;

interface TownActionContext {
    player: Player;
    mapData?: { type?: string; monsters?: readonly string[] };
    stats: { maxHp?: number; maxMp?: number };
    guidance: AdventureGuidance;
    preparation: ExpeditionPreparation;
    hasGrave: boolean;
    classes: Record<string, ClassDef>;
    recipes: ItemRecipeDef[];
    consumables: Item[];
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

const countItems = (items: Item[]) => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
        if (!item?.name) return;
        counts.set(item.name, (counts.get(item.name) || 0) + 1);
    });
    return counts;
};

const canCraftRecipe = (player: Player, recipes: ItemRecipeDef[]) => {
    const inventory = player.inv || [];
    const counts = countItems(inventory);
    return recipes.some((recipe) => (
        (player.gold || 0) >= (recipe.gold || 0)
        && (recipe.inputs || []).every((input) => (
            (counts.get(input.name || '') || 0) >= (input.qty || 0)
        ))
    ));
};

const getPrimaryKind = (guidance: AdventureGuidance, preparation: ExpeditionPreparation): TownPrimaryKind => {
    if (preparation?.isClaimable) return 'claim_quest';

    const guidedKind = guidance?.primaryAction?.kind as TownPrimaryKind | undefined;
    if (guidedKind && PRIMARY_TEST_IDS[guidedKind]) return guidedKind;

    return preparation?.tracker ? 'open_move' : 'open_quest_board';
};

const isFirstStoryDeparture = (guidance: AdventureGuidance, preparation: ExpeditionPreparation) => (
    (guidance?.title === '첫 원정 준비' || guidance?.primaryAction?.label === '첫 출발')
    && (!preparation?.tracker || preparation.tracker.questId === FIRST_STORY_QUEST_ID)
);

const getPrimaryLabel = (kind: TownPrimaryKind, guidance: AdventureGuidance, preparation: ExpeditionPreparation) => {
    switch (kind) {
        case 'claim_quest':
            return '임무 보상 받기';
        case 'open_move':
            if (!preparation?.canDepart) return '출발 경로 확인';
            return isFirstStoryDeparture(guidance, preparation)
                ? `${preparation.destination}으로 첫 출발`
                : `${preparation.destination}으로 출발`;
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
    mapData,
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
        !isFirstStoryDeparture(guidance, preparation)
        && (
            preparation?.tracker
            || primaryKind === 'claim_quest'
            || primaryKind === 'open_quest_board'
        ),
    );

    const contextualKeys: TownActionKey[] = [];
    if (hasGrave) contextualKeys.push('grave');
    if (needsRest && primaryKey !== 'rest') contextualKeys.push('rest');
    if (questNeedsAttention && primaryKey !== 'quests') contextualKeys.push('quests');
    if (canChangeClass && primaryKey !== 'class') contextualKeys.push('class');
    if (canCraft && primaryKey !== 'craft') contextualKeys.push('craft');
    if (needsSupply && primaryKey !== 'market') contextualKeys.push('market');

    // 시작 마을의 explore action은 이벤트 없이 안내 로그만 남긴다. 실제 이동과
    // 구별되는 결과가 있는 행동만 첫 화면에 남겨 선택 비용을 줄인다.
    const quickKeys = [...contextualKeys.slice(0, 1), 'move'] as TownActionKey[];
    // 2026-09 Wave 16 H3: safe 지역에도 대기 중인 이벤트 체인 스텝이 놓일 수 있다
    //   (`machine_uprising` 종착 = 북부 요새, `water_apostle:1` = 사막 오아시스).
    //   안전지대에는 탐험 버튼이 없어서 이 둘은 **터미널에 `탐색`을 타이핑해야만**
    //   진행됐다. 대기 스텝이 있으면 같은 explore 행동을 마을 행동으로 노출한다 —
    //   explore()는 체인 트리거를 가장 먼저 검사하므로 이 버튼은 항상 그 분기로 간다.
    const hasPendingChainStep = Boolean(
        getChainEventForLoc(player.loc, player.eventChainProgress, player.deferredEventChainSteps),
    );
    const canInvestigate = canInvestigateTown(player.loc, mapData);
    const exploreIntent: TownExploreIntent = hasPendingChainStep
        ? 'chain'
        : canInvestigate ? 'investigate' : null;
    if (exploreIntent !== null && primaryKey !== 'explore') quickKeys.push('explore');
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
        exploreIntent,
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
