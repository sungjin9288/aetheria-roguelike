import { MSG } from '../data/messages';
import type { AddLog, GameActions } from './actionDeps';

/**
 * 오늘의 시련에서 쓸 수 있는 액션 — 마을 · 이동 · 임무 · 계승 · 상점 · 장기 성장의 입력을 막는다(입력 표면).
 * 리듀서의 격리(`reducers/dailyTrial.ts`)와 별개다: 이 표가 빠뜨려도 본편의 상태는 바뀌지 않는다.
 * `Record`라 새 액션은 분류해야 컴파일된다.
 */
const TRIAL_ACTION_ACCESS: Record<keyof GameActions, 'allow' | 'block'> = {
    // 걷기 · 전투 · 사건 · 유물 · 장비
    fieldOpenDoor: 'allow',
    fieldEnter: 'allow',
    fieldStep: 'allow',
    processFieldPending: 'allow',
    combat: 'allow',
    combatUseItem: 'allow',
    getSelectedSkill: 'allow',
    cycleSkill: 'allow',
    selectSkill: 'allow',
    swapSkillChoice: 'allow',
    chooseSkillBranch: 'allow',
    handleEventChoice: 'allow',
    useItem: 'allow',
    enhanceItem: 'allow',
    openArchive: 'allow',

    // 화면 · 설정 · 조회
    setSideTab: 'allow',
    setGameState: 'allow',
    setReadabilityMode: 'allow',
    setEquipmentDetailMode: 'allow',
    setHapticsEnabled: 'allow',
    setKeyboardShortcutsEnabled: 'allow',
    setCombatSpeed: 'allow',
    setAutoExploreHpStop: 'allow',
    dismissEvent: 'allow',
    setQuickSlot: 'allow',
    clearPostCombat: 'allow',
    clearEconomyReceipt: 'allow',
    closeExpeditionDebrief: 'allow',
    getUid: 'allow',
    isAdmin: 'allow',
    economyReceipt: 'allow',
    liveConfig: 'allow',
    leaderboard: 'allow',
    getFullStats: 'allow',
    dispatch: 'allow',

    // 본편의 몫
    move: 'block',
    explore: 'block',
    scout: 'block',
    start: 'block',
    openShop: 'block',
    rest: 'block',
    reset: 'block',
    jobChange: 'block',
    acceptQuest: 'block',
    abandonQuest: 'block',
    lootGrave: 'block',
    requestBounty: 'block',
    toggleExpeditionFocusQuest: 'block',
    confirmAscension: 'block',
    rerollAscensionRuleOffer: 'block',
    cancelAscension: 'block',
    reopenAscension: 'block',
    fieldStartAuto: 'block',
    fieldChooseTrait: 'block',
    completeQuest: 'block',
    claimAchievement: 'block',
    claimWeeklyMission: 'block',
    claimSeasonReward: 'block',
    market: 'block',
    leaveMerchant: 'block',
    craft: 'block',
    craftBag: 'block',
    synthesize: 'block',
    autoSell: 'block',
    sellUnusedEquipment: 'block',
    expandInventory: 'block',
    purchaseSynthProtect: 'block',
    purchaseRevive: 'block',
    purchaseCosmeticTitle: 'block',
    purchaseMirrorNode: 'block',
    setShopItems: 'block',
    acknowledgeMilestoneStoryBeat: 'block',
    openExpeditionDebrief: 'block',
    setActiveTitle: 'block',
};

/** 시련 중의 액션 — 막힌 액션은 기록 한 줄만 남기고 아무것도 하지 않는다. */
export const gateDailyTrialActions = (actions: GameActions, addLog: AddLog): GameActions => {
    const gated: GameActions = { ...actions };
    const refuse = () => addLog('error', MSG.DAILY_TRIAL_BLOCKED);
    for (const key of Object.keys(TRIAL_ACTION_ACCESS) as Array<keyof GameActions>) {
        if (TRIAL_ACTION_ACCESS[key] === 'block') gated[key] = refuse as never;
    }
    return gated;
};
