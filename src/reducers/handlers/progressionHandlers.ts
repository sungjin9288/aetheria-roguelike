/**
 * progressionHandlers — 런 진행/환생/유물/칭호 관련 액션 핸들러
 * INITIAL_STATE를 참조하므로 gameReducer.js에서 주입받습니다.
 */
import type { GameState, GameAction } from '../gameReducer';

/**
 * makeProgressionActionMap(INITIAL_STATE) → action map
 * 순환 참조 방지를 위해 팩토리 패턴 사용
 */
export const makeProgressionActionMap = (INITIAL_STATE: any) => ({
    // cycle 204: 사망 후 '다시 시작' 시 META 진행도 보존 — cycle 191(handleDefeat)와 정합.
    //   기존 동작은 ...INITIAL_STATE로 모든 META를 wipe해 cycle 191의 preserve를
    //   nullify(다시 시작 클릭 즉시 영구 자산 / 영구 카운터 사라짐).
    //   이제 cycle 119 / 188 / 191 / 202 / 203 보존 시리즈와 동일 패턴으로 META 명시 보존:
    //   - meta / titles / activeTitle (영구 자산)
    //   - premiumCurrency / reviveTokens / maxInv / seasonPass (premium 영구 자산)
    //   - stats: kills / bossKills / total_gold / abyssRecord / escapes / syntheses /
    //     maxKillStreak / visitedMaps / discoveryChains / explores / rests / killRegistry /
    //     buildWins / cosmeticTitles / synthProtects / claimedAchievements (multi-run 카운터/ledger)
    //   RUN 진행도(gold / inv / equip / relics / hp / mp / quests / skillLoadout)는
    //   INITIAL_STATE로 reset 유지.
    RESET_GAME: (state: GameState) => {
        const prevPlayer: any = state.player || {};
        const prevStats: any = prevPlayer.stats || {};
        const initialStats: any = INITIAL_STATE.player.stats || {};
        return {
            ...INITIAL_STATE,
            grave: state.grave,
            bootStage: 'ready',
            uid: state.uid,
            syncStatus: 'syncing',
            player: {
                ...INITIAL_STATE.player,
                meta: { ...INITIAL_STATE.player.meta, ...(prevPlayer.meta || {}) },
                titles: Array.isArray(prevPlayer.titles) ? [...prevPlayer.titles] : [],
                activeTitle: prevPlayer.activeTitle || null,
                premiumCurrency: Math.max(0, Number(prevPlayer.premiumCurrency) || 0),
                reviveTokens: Math.max(0, Number(prevPlayer.reviveTokens) || 0),
                ...(prevPlayer.maxInv !== undefined ? { maxInv: Math.max(20, Number(prevPlayer.maxInv) || 20) } : {}),
                seasonPass: prevPlayer.seasonPass || INITIAL_STATE.player.seasonPass,
                // cycle 214: 주간 미션 진행도 / claimed ledger 보존 — mid-week RESET_GAME 시
                //   재청구 exploit 방지. ASCEND와 동일 lens.
                weeklyProtocol: prevPlayer.weeklyProtocol || INITIAL_STATE.player.weeklyProtocol,
                stats: {
                    ...initialStats,
                    kills: prevStats.kills || 0,
                    bossKills: prevStats.bossKills || 0,
                    deaths: prevStats.deaths || 0,
                    total_gold: prevStats.total_gold || 0,
                    relicCount: prevStats.relicCount || 0,
                    abyssFloor: prevStats.abyssFloor || 0,
                    abyssRecord: prevStats.abyssRecord || 0,
                    escapes: prevStats.escapes || 0,
                    syntheses: prevStats.syntheses || 0,
                    maxKillStreak: prevStats.maxKillStreak || 0,
                    explores: prevStats.explores || 0,
                    rests: prevStats.rests || 0,
                    crafts: prevStats.crafts || 0,
                    bountiesCompleted: prevStats.bountiesCompleted || 0,
                    demonKingSlain: prevStats.demonKingSlain || 0,
                    visitedMaps: Array.isArray(prevStats.visitedMaps) ? prevStats.visitedMaps : initialStats.visitedMaps,
                    discoveryChains: Array.isArray(prevStats.discoveryChains) ? prevStats.discoveryChains : [],
                    killRegistry: (prevStats.killRegistry && typeof prevStats.killRegistry === 'object') ? prevStats.killRegistry : {},
                    buildWins: (prevStats.buildWins && typeof prevStats.buildWins === 'object') ? prevStats.buildWins : {},
                    codex: prevStats.codex || initialStats.codex,
                    codexClaimed: Array.isArray(prevStats.codexClaimed) ? prevStats.codexClaimed : [],
                    cosmeticTitles: Array.isArray(prevStats.cosmeticTitles) ? prevStats.cosmeticTitles : [],
                    synthProtects: prevStats.synthProtects || 0,
                    claimedAchievements: Array.isArray(prevStats.claimedAchievements) ? prevStats.claimedAchievements : [],
                    // cycle 260: claimedQuestIds 영구 ledger 보존 — questReward 칭호(152/153/154/
                    //   201/202) checkTitles fallback이 의존. RESET_GAME 시 wipe되면 복구 불가.
                    //   cycle 202 claimedAchievements 패턴 동일 lens.
                    claimedQuestIds: Array.isArray(prevStats.claimedQuestIds) ? prevStats.claimedQuestIds : [],
                    // cycle 211: codex milestone 누적 stat 보너스 3종 보존 — codexClaimed
                    //   재청구 차단과 paired ledger 정합성 (silent permanent loss 방지).
                    codexBonusAtk: prevStats.codexBonusAtk || 0,
                    codexBonusDef: prevStats.codexBonusDef || 0,
                    codexBonusHp: prevStats.codexBonusHp || 0,
                    // cycle 212: signaturePity mercy 카운터 보존 — handleDefeat과 정합 + cycle 75
                    //   anti-frustration 설계 의도 lock.
                    signaturePity: prevStats.signaturePity || 0,
                    // cycle 213: 일일 bounty / dailyProtocol 상태 보존 — mid-day RESET_GAME 시
                    //   일일 1회 제한 우회 (재발급 exploit) 방지.
                    bountyDate: prevStats.bountyDate ?? null,
                    bountyIssued: Boolean(prevStats.bountyIssued),
                    dailyProtocol: prevStats.dailyProtocol ?? null,
                    // cycle 216: 일일 grave invasion ledger 보존 — 5회 일일 제한 우회 방지.
                    dailyInvadeCount: prevStats.dailyInvadeCount || 0,
                    lastInvadeDate: prevStats.lastInvadeDate ?? null,
                },
            },
        };
    },

    SET_RUN_SUMMARY: (state: GameState, action: GameAction) =>
        ({ ...state, runSummary: action.payload }),

    TRIGGER_TRUE_ENDING: (state: GameState) =>
        ({ ...state, gameState: 'true_ending', syncStatus: 'syncing' }),

    UPDATE_EVENT_CHAIN: (state: GameState, action: GameAction) => {
        const { chainId, step } = action.payload;
        return {
            ...state,
            player: {
                ...state.player,
                eventChainProgress: {
                    ...(state.player.eventChainProgress || {}),
                    [chainId]: step,
                }
            }
        };
    },

    SET_PENDING_RELICS: (state: GameState, action: GameAction) =>
        ({ ...state, pendingRelics: action.payload }),

    ADD_RELIC: (state: GameState, action: GameAction) => {
        const relic = action.payload;
        return {
            ...state,
            pendingRelics: null,
            player: {
                ...state.player,
                relics: [...(state.player.relics || []), relic],
                stats: { ...state.player.stats, relicCount: (state.player.stats?.relicCount || 0) + 1 },
            },
            syncStatus: 'syncing',
        };
    },

    DECLINE_RELIC: (state: GameState) =>
        ({ ...state, pendingRelics: null }),

    ASCEND: (state: GameState, action: GameAction) => {
        const { meta, newTitle } = action.payload;
        const prevTitles = state.player.titles || [];
        const prevStats: any = state.player.stats || {};
        const initialStats: any = INITIAL_STATE.player.stats || {};
        const freshPlayer: Record<string, any> = {
            ...INITIAL_STATE.player,
            name: state.player.name,
            gender: state.player.gender,
            meta,
            titles: [...new Set([...prevTitles, newTitle])],
            activeTitle: newTitle,
            stats: {
                ...initialStats,
                kills: prevStats.kills,
                bossKills: prevStats.bossKills,
                deaths: prevStats.deaths,
                total_gold: prevStats.total_gold,
                relicCount: prevStats.relicCount,
                abyssFloor: prevStats.abyssFloor,
                // cycle 119: abyssRecord(best-ever 심연), escapes(cycle 74), syntheses(cycle 82),
                // maxKillStreak(cycle 95 max-ever 시맨틱), visitedMaps(cycle 83 cartographer
                // 정합), discoveryChains(cycle 102 ach_chain_*) — 환생 후 진행도 회귀를
                //막기 위해 명시 보존. 모두 multi-run achievement / title 데이터 소스.
                abyssRecord: prevStats.abyssRecord,
                escapes: prevStats.escapes,
                syntheses: prevStats.syntheses,
                maxKillStreak: prevStats.maxKillStreak,
                visitedMaps: Array.isArray(prevStats.visitedMaps) ? prevStats.visitedMaps : initialStats.visitedMaps,
                discoveryChains: Array.isArray(prevStats.discoveryChains) ? prevStats.discoveryChains : [],
                demonKingSlain: (prevStats.demonKingSlain || 0) + 1,
                bountiesCompleted: prevStats.bountiesCompleted,
                crafts: prevStats.crafts,
                codex: prevStats.codex || initialStats.codex,
                codexClaimed: prevStats.codexClaimed || [],
                // cycle 188: cosmeticTitles는 premium 구매로 획득한 영구 자산 — 환생 후에도
                //   PremiumShop의 'owned' 체크가 정상 동작하도록 보존. 미보존 시 player.titles에는
                //   남지만 ownership 추적이 풀려 동일 칭호 중복 구매 가능 회귀.
                cosmeticTitles: Array.isArray(prevStats.cosmeticTitles) ? prevStats.cosmeticTitles : [],
                // cycle 188: synthProtects(합성 보호권 잔여 토큰) — premium 구매로 획득한 영구 자산.
                //   미보존 시 환생 후 보유 토큰 0으로 리셋되어 premium 구매가 손실.
                synthProtects: prevStats.synthProtects || 0,
                // cycle 202: claimedAchievements 영구 ledger 보존 — cycle 188 패턴 확장.
                //   기존엔 ASCEND 시 [] 으로 리셋되었으나 kills/bossKills 등 영구 카운터는 보존되므로
                //   isAchievementUnlocked가 여전히 true → claimAchievement는 'claimed.includes()'만
                //   가드해 ASCEND마다 모든 업적 재청구 가능 exploit. 영구 청구 ledger로 잠금.
                claimedAchievements: Array.isArray(prevStats.claimedAchievements) ? prevStats.claimedAchievements : [],
                // cycle 260: claimedQuestIds 영구 ledger 보존 — questReward 칭호 (152/153/154/
                //   201/202) checkTitles fallback이 의존. ASCEND 시 wipe되면 복구 불가.
                //   cycle 202 claimedAchievements 패턴 동일 lens.
                claimedQuestIds: Array.isArray(prevStats.claimedQuestIds) ? prevStats.claimedQuestIds : [],
                // cycle 203: cycle 119 누락분 4 영구 카운터 보존 — multi-run achievement / title /
                //   codex 데이터 소스. 기존엔 ASCEND 시 0 / {} 리셋되어 progress 회귀.
                //   · explores — 6+ quest target / 1 achievement / 2 title('방랑자' val 100, '길잡이' val 500).
                //   · rests — title '안락함의 추구자'(rests 50 cond) source.
                //   · killRegistry — Bestiary / MonsterCodex / atk_per_kill_kind 시너지 source.
                //   · buildWins — questProgress.ts:51 quest 조건. build kind win counter.
                explores: prevStats.explores || 0,
                rests: prevStats.rests || 0,
                killRegistry: (prevStats.killRegistry && typeof prevStats.killRegistry === 'object')
                    ? prevStats.killRegistry
                    : {},
                buildWins: (prevStats.buildWins && typeof prevStats.buildWins === 'object')
                    ? prevStats.buildWins
                    : {},
                // cycle 211: codex milestone 청구 보너스 3종(영구 stat 가산) 보존.
                //   CLAIM_CODEX_REWARD가 누적 가산하는 stat — codexClaimed는 보존되지만
                //   codexBonus*가 wipe되면 재청구 차단(codexClaimed 등록) + 보너스 손실의
                //   silent permanent loss. cycle 202 paired ledger 정합성 동일 lens.
                codexBonusAtk: prevStats.codexBonusAtk || 0,
                codexBonusDef: prevStats.codexBonusDef || 0,
                codexBonusHp: prevStats.codexBonusHp || 0,
                // cycle 212: signaturePity multi-run mercy 카운터 보존 — cycle 75 anti-frustration
                //   설계 정합성. handleDefeat은 prevStats spread로 보존하지만 ASCEND는 보존 list
                //   미포함이라 wipe되던 비대칭. mercy 시스템 무력화 방지.
                signaturePity: prevStats.signaturePity || 0,
                // cycle 213: 일일 bounty / dailyProtocol 상태 보존 — mid-day ASCEND 시 일일 1회
                //   제한 우회 (재발급 exploit) 방지. cycle 202 paired ledger 패턴 동일 lens.
                //   handleDefeat과 정합 (prevStats spread로 보존하던 경로와 align).
                bountyDate: prevStats.bountyDate ?? null,
                bountyIssued: Boolean(prevStats.bountyIssued),
                dailyProtocol: prevStats.dailyProtocol ?? null,
                // cycle 216: 일일 grave invasion ledger 보존 — 5회 일일 제한
                //   (BALANCE.DAILY_INVADE_LIMIT) 우회 방지. cycle 213 동일 lens.
                dailyInvadeCount: prevStats.dailyInvadeCount || 0,
                lastInvadeDate: prevStats.lastInvadeDate ?? null,
            },
            premiumCurrency: state.player.premiumCurrency || 0,
            seasonPass: state.player.seasonPass || INITIAL_STATE.player.seasonPass,
            // cycle 188: 프리미엄 구매 자산 보존 — 환생해도 잔여 토큰/확장 슬롯 유지.
            reviveTokens: (state.player as any).reviveTokens || 0,
            maxInv: (state.player as any).maxInv || undefined,
            // cycle 214: 주간 미션 진행도 / claimed ledger 보존 — mid-week ASCEND 시 같은 주
            //   재청구 exploit 방지. lastResetWeek 자동 reset 로직(exploreUtils.resetWeeklyProtocolIfNeeded)은
            //   그대로 — 새 주 시작 시 정상 reset.
            weeklyProtocol: (state.player as any).weeklyProtocol || INITIAL_STATE.player.weeklyProtocol,
        };
        return {
            ...INITIAL_STATE,
            uid: state.uid,
            bootStage: 'ready',
            player: freshPlayer,
            syncStatus: 'syncing',
        };
    },

    UNLOCK_TITLES: (state: GameState, action: GameAction) => {
        const newIds = action.payload;
        if (!newIds || newIds.length === 0) return state;
        const merged = [...new Set([...(state.player.titles || []), ...newIds])];
        return {
            ...state,
            player: {
                ...state.player,
                titles: merged,
                activeTitle: state.player.activeTitle || newIds[0],
            },
            syncStatus: 'syncing',
        };
    },
});
