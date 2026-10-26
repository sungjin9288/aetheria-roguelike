/**
 * progressionHandlers — 런 진행/환생/유물/칭호 관련 액션 핸들러
 * INITIAL_STATE를 참조하므로 gameReducer.js에서 주입받습니다.
 */
import type { GameState, HandlerMap } from '../gameReducer';
import type { Player } from '../../types';
import { GS } from '../gameStates';
import { createCurrentRunProgress } from '../../utils/runProgress';
import { getEssenceLifetime } from '../../systems/essenceLedger';
import { pickPermanentPlayerState } from '../../utils/permanentProgress';
import { getAscensionOutcome, isNewAscensionTitle } from '../../utils/ascensionPreview';
import { getClaimableQuestEntries } from '../../utils/questProgress';
import { checkTitles, getTitleLabel } from '../../utils/gameUtils';
import { clampVitalsToEffectiveMax } from '../../utils/effectiveVitals';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { getBakedMetaVitals, snapshotMetaVitals } from '../../systems/metaBonusRamp';
import { MSG } from '../../data/messages';
import { appendRewardLogs } from './rewardLog';
import {
    canRerollAscensionRuleOffer,
    getAscensionRuleOfferSecond,
    getAscensionRuleRerolls,
    getAscensionRuleStartLog,
    getRuleDeclinePasses,
    resolveAscensionRuleOfferChoice,
    resolveAscensionRuleDeclined,
} from '../../systems/ascensionRule';
import { applyChallengeMaxHp, getRunStartGold, getStartBootChoiceCount, buildRunChallengeModifiers } from '../../utils/runStart';
import { calculateFullStats } from '../../utils/statsCalculator';
import { createSeededRandom } from '../../utils/seededRandom';
import { RELICS, pickWeightedRelics } from '../../data/relics';
import { BALANCE } from '../../data/constants';
import { snapshotCycleStart } from '../../utils/cycleSummary';
import { getSkillBranchOpenedLog } from '../../utils/skillBranchOpening';

/**
 * makeProgressionActionMap(INITIAL_STATE) → action map
 * 순환 참조 방지를 위해 팩토리 패턴 사용
 */
export const makeProgressionActionMap = (INITIAL_STATE: GameState) => ({
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
    RESET_GAME: (state) => {
        // 2026-10 Wave 108: 다시 시작은 사망과 같은 초기화다(여정을 버리는 것 — 도감도 남지 않는다).
        const permanent = pickPermanentPlayerState(state.player, INITIAL_STATE.player, 'death');
        const permanentStats: NonNullable<Player['stats']> = permanent.stats || {};
        return {
            ...INITIAL_STATE,
            grave: state.grave,
            bootStage: 'ready',
            uid: state.uid,
            syncStatus: 'syncing',
            player: {
                ...INITIAL_STATE.player,
                ...permanent,
                stats: {
                    ...permanentStats,
                    currentRun: createCurrentRunProgress(permanentStats, { essenceLifetime: getEssenceLifetime(permanent.meta) }),
                },
            },
        };
    },

    SET_RUN_SUMMARY: (state, action) =>
        ({ ...state, runSummary: action.payload }),

    UPDATE_EVENT_CHAIN: (state, action) => {
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

    // 2026-09 D3: 유물 선택이 열리면 전투 결과 카드는 내린다 — 유물 패널(z-50 전체 화면)이
    //   카드(z-40)를 덮어 카드 CTA가 닿지 않는 상태로 남는 것을 막는다 (lessons R12).
    SET_PENDING_RELICS: (state, action) => ({
        ...state,
        pendingRelics: action.payload,
        postCombatResult: action.payload ? null : state.postCombatResult,
    }),

    ADD_RELIC: (state, action) => {
        const relic = action.payload;
        const relics = state.player.relics || [];
        // 2026-09 Wave 27 N2 (D3): 추가는 보유 상한을 넘지 못한다. 상한에서 열린 선택지
        //   (체인 완주 보상 · 심연 마일스톤)는 REPLACE_RELIC 또는 DECLINE_RELIC으로 닫는다 —
        //   제안(pendingRelics)은 남겨 두어 패널이 교체/넘기기를 계속 보여 준다.
        if (relics.length >= getPrestigeUnlocks(state.player.meta?.prestigeRank).maxRelics) {
            return {
                ...state,
                logs: appendRewardLogs(state.logs, [{ type: 'error', text: MSG.RELIC_SLOTS_FULL_REPLACE }]),
            };
        }
        return {
            ...state,
            pendingRelics: null,
            // D8: 유물이 빌드 성향을 바꾸면 성향 보너스만큼 유효 최대 기력이 줄 수 있다.
            player: clampVitalsToEffectiveMax({
                ...state.player,
                relics: [...relics, relic],
                stats: { ...state.player.stats, relicCount: (state.player.stats?.relicCount || 0) + 1 },
            }),
            syncStatus: 'syncing',
        };
    },

    // 2026-09 Wave 27 N2 (D3): 제안 유물(pendingRelics)을 보유 유물 하나와 맞바꾼다 — 유물 수는
    //   그대로라 상한 안팎 어디서든 늘지 않는다. 제안에 없는 유물 · 보유하지 않은 교체 대상 ·
    //   이미 보유한 제안은 동일 참조로 무시한다(연타·늦은 클릭).
    REPLACE_RELIC: (state, action) => {
        const relicId = action.payload?.relicId;
        const replaceRelicId = action.payload?.replaceRelicId;
        if (typeof relicId !== 'string' || typeof replaceRelicId !== 'string') return state;
        const offered = (state.pendingRelics || []).find((relic) => relic?.id === relicId);
        if (!offered) return state;
        const relics = state.player.relics || [];
        const releaseIndex = relics.findIndex((relic) => relic?.id === replaceRelicId);
        if (releaseIndex < 0 || relics.some((relic) => relic?.id === relicId)) return state;
        const released = relics[releaseIndex];
        return {
            ...state,
            pendingRelics: null,
            // D8: 내려놓은 유물의 생명/기력 배율만큼 유효 최대치가 줄 수 있다.
            player: clampVitalsToEffectiveMax({
                ...state.player,
                relics: relics.map((relic, index) => (index === releaseIndex ? offered : relic)),
                stats: { ...state.player.stats, relicCount: (state.player.stats?.relicCount || 0) + 1 },
            }),
            logs: appendRewardLogs(state.logs, [{
                type: 'success',
                text: MSG.RELIC_REPLACED(released.name || replaceRelicId, offered.name || relicId),
            }]),
            syncStatus: 'syncing',
        };
    },

    DECLINE_RELIC: (state) =>
        ({ ...state, pendingRelics: null }),

    // 2026-09 Wave 28 (D6): 계승 제안을 미룬다. 마왕을 쓰러뜨릴 때마다 계승 화면이 다시 떠서(자연 플레이 런당
    //   70~112회) 85~87을 진행하는 동안 같은 결정을 반복해야 했다. 한 번 미루면 이번 런에서는 다시 묻지 않고
    //   (endgameSettlement가 플래그를 읽는다) 조작판의 "계승하기"로 돌아온다. 진엔딩 화면의 취소는 다른 결정이라
    //   이 전이를 쓰지 않는다 — 허용 상태는 ASCENSION 하나다.
    DEFER_ASCENSION: (state) => {
        if (state.gameState !== GS.ASCENSION) return state;
        return {
            ...state,
            gameState: GS.IDLE,
            player: { ...state.player, ascensionOfferDeferred: true },
            logs: appendRewardLogs(state.logs, [
                { type: 'info', text: MSG.ASCEND_CANCEL },
                { type: 'system', text: MSG.ASCENSION_DEFERRED_NOTICE },
            ]),
            syncStatus: 'syncing',
        };
    },

    // 미룬 계승을 다시 연다. 이번 런에서 미룬 적이 있을 때만 — 플래그는 계승 화면(= 이번 런의 마왕 처치)에서만
    //   세워지므로 곧 "이번 런에 마왕을 쓰러뜨렸다"는 뜻이다. 실제 계승은 ASCEND가 처치 영수증으로 다시 검증한다.
    REOPEN_ASCENSION: (state) => {
        if (state.gameState !== GS.IDLE || state.player.ascensionOfferDeferred !== true) return state;
        if (!state.player.meta?.endgame?.lastEndgameReceiptKey) return state;
        return { ...state, gameState: GS.ASCENSION };
    },

    // 2026-10 Wave 95 (소유자 결정 "무료 한 번 + 영구 능력치"): 계승 화면의 회차 규칙 패 다시 뽑기 — 횟수를 이 마왕 처치 영수증 · 다음
    //   단계에 묶어 저장하므로 리로드로 첫 패를 되살릴 수 없다. 대가(유료 횟수만큼 넘어가는 사다리)는 계승이 적용한다.
    REROLL_ASCENSION_RULE_OFFER: (state, action) => {
        if (state.gameState !== GS.ASCENSION && state.gameState !== GS.TRUE_ENDING) return state;
        const meta = state.player.meta;
        const receiptKey = meta?.endgame?.lastEndgameReceiptKey;
        if (!meta || !receiptKey) return state;
        const nextRank = getAscensionOutcome(meta).nextRank;
        const rerolls = getAscensionRuleRerolls(meta, nextRank);
        if (Number(action.payload?.expectedRerolls) !== rerolls) return state;
        if (!canRerollAscensionRuleOffer(state.player, nextRank)) return state;
        return {
            ...state,
            player: {
                ...state.player,
                meta: { ...meta, ascensionRuleOffer: { receiptKey, rank: nextRank, rerolls: rerolls + 1 } },
            },
            syncStatus: 'syncing',
        };
    },

    ASCEND: (state, action) => {
        if (state.gameState !== GS.ASCENSION && state.gameState !== GS.TRUE_ENDING) return state;
        if (getClaimableQuestEntries(state.player).length > 0) return state;
        const payload = action.payload;
        const expectedPrestigeRank = Number(payload?.expectedPrestigeRank);
        if (!Number.isSafeInteger(expectedPrestigeRank) || expectedPrestigeRank < 0) return state;
        const outcome = getAscensionOutcome(state.player.meta);
        if (expectedPrestigeRank !== outcome.currentRank) return state;
        const sourceReceiptKey = payload?.sourceReceiptKey;
        if (sourceReceiptKey !== null && typeof sourceReceiptKey !== 'string') return state;
        const currentReceiptKey = state.player.meta?.endgame?.lastEndgameReceiptKey ?? null;
        if (sourceReceiptKey !== currentReceiptKey) return state;
        const permanent = pickPermanentPlayerState(state.player, INITIAL_STATE.player, 'ascension');
        const permanentStats: NonNullable<Player['stats']> = permanent.stats || {};
        const prevTitles = permanent.titles || [];
        // 2026-09 Wave 40: 계승은 이름을 남겨 새 게임(start)을 다시 타지 않는다 — 여기서 새 런의 영구 생명 · 기력을
        //   Lv1 연동 비율만큼 굽고 스냅숏을 남긴다. 굽지 않던 동안 넘어온 영구 생명 · 기력이 첫 전직 전까지 0이었다.
        // 2026-10 Wave 108: 이야기 능력치는 여정 범위라 새 여정에는 없다.
        const metaVitalsSnapshot = snapshotMetaVitals(outcome.meta);
        const bakedMeta = getBakedMetaVitals(metaVitalsSnapshot, 1);
        // 2026-10 Wave 58: 새 여정의 시작 조건은 새 게임(start)과 같은 계산이다(utils/runStart.ts) — 계승 화면에서 고른
        //   도전 조건(슬롯은 새 단계 기준) · 거울 시작 골드 · 첫 유물 선택지. 이전에는 사망 재시작에만 적용됐다.
        // 2026-10 Wave 94: 새 단계의 회차 규칙은 계승 화면의 패에서 고른 카드다 — 패 밖의 id(또는 없음)는 패에서 가장 가벼운 카드.
        //   고른 규칙은 영구 meta에 남아 같은 단계의 사망 재시작이 같은 규칙을 읽는다.
        //   Wave 95: 패는 다시 뽑은 뒤의 패다(지금 player의 기록) — `outcome.meta`는 그 기록을 지우고 유료 횟수의 대가를 적용했다.
        const nextRank = Number(outcome.meta.prestigeRank) || 0;
        // 2026-10 Wave 106: 고르지 않은 계승의 기본 카드는 겹친 카드면 두 비틀기의 측정 무게 합이 가장 작은 카드다.
        const chosenRule = resolveAscensionRuleOfferChoice(state.player, nextRank, payload?.ruleId);
        // 2026-10 Wave 105: 겹친 규칙 카드는 패의 두 번째 비틀기를 함께 남긴다(같은 단계의 사망 재시작이 같은 비틀기를 읽는다).
        const secondModifier = getAscensionRuleOfferSecond(state.player, nextRank, chosenRule);
        const ruleMeta = chosenRule
            ? { ...outcome.meta, ascensionRule: { rank: nextRank, ruleId: chosenRule.id, ...(secondModifier ? { secondModifier } : {}) } }
            : outcome.meta;
        const ascensionRuleDeclined = resolveAscensionRuleDeclined(ruleMeta, payload?.declineRule);
        const challengeModifiers = buildRunChallengeModifiers(payload?.challengeModifiers, ruleMeta, ascensionRuleDeclined);
        const freshMaxHp = applyChallengeMaxHp((INITIAL_STATE.player.maxHp || 0) + bakedMeta.hp, challengeModifiers);
        const freshMaxMp = (INITIAL_STATE.player.maxMp || 0) + bakedMeta.mp;
        const freshPlayer: Player = {
            ...INITIAL_STATE.player,
            ...permanent,
            maxHp: freshMaxHp,
            hp: freshMaxHp,
            maxMp: freshMaxMp,
            mp: freshMaxMp,
            metaVitalsSnapshot,
            name: state.player.name,
            gender: state.player.gender,
            gold: getRunStartGold(outcome.meta, challengeModifiers),
            challengeModifiers,
            ascensionRuleDeclined,
            // 2026-10 Wave 62 (원장 §61.4 C11, 소유자 결정 "첫 방문은 여정마다"): 계승은 방문 기록을 넘기지만 첫 방문 보상은 새 여정에서
            //   다시 받는다 — 방문 기록으로 판정하던 동안 계승 뒤에는 51곳 중 한 곳도 받지 못했다.
            firstVisitRewardMaps: [],
            meta: ruleMeta,
            titles: [...new Set([...prevTitles, outcome.title])],
            activeTitle: outcome.title,
            stats: {
                ...permanentStats,
                // 2026-10 Wave 107: 이번 회차를 거절했으면 그 규칙은 이번 순환에서 지나간 것이다(덱이 센다) — 계승이 기록하는 한 곳.
                ruleDeclinePassIds: getRuleDeclinePasses(state.player),
                currentRun: createCurrentRunProgress(permanentStats, { essenceLifetime: getEssenceLifetime(ruleMeta) }),
            },
        };
        // 2026-10 Wave 108: 새 단계로 열리는 칭호는 새 여정의 player로 판정한다 — 계승 전 player로 판정하던 동안 이전 여정의 누적값이
        //   여정 칭호(처치 · 탐험 …)를 되살렸다.
        const ascensionTitles = checkTitles({ ...freshPlayer, activeTitle: outcome.title });
        freshPlayer.titles = [...new Set([...(freshPlayer.titles || []), ...ascensionTitles])];
        // 2026-10 Wave 100: 새 회차의 수집 기준점 — 계승 화면의 "이번 회차 요약"이 다음 계승 때 지금 수집 − 기준점으로 센다.
        freshPlayer.meta = { ...(freshPlayer.meta || {}), cycleStart: snapshotCycleStart(freshPlayer, nextRank) };
        // 첫 유물 선택지(새 게임의 시작 부트와 같은 규칙 — 등급 상한 · 직업 기본 성향 공명). 난수는 payload 씨앗이다.
        const seed = Number.isSafeInteger(payload?.seed) ? Number(payload?.seed) : 0;
        const startingRelics = pickWeightedRelics(RELICS, getStartBootChoiceCount(outcome.meta), {
            rarityCap: BALANCE.START_BOOT_RARITY_CAP,
            buildId: calculateFullStats(freshPlayer)?.buildProfile?.primary?.id,
            rng: createSeededRandom(seed),
        });
        const challengeLabels = challengeModifiers.map((id) => (
            BALANCE.CHALLENGE_MODIFIERS.find((modifier) => modifier.id === id)?.label || id));
        const ruleLog = getAscensionRuleStartLog(ruleMeta, ascensionRuleDeclined);
        // 소유자 결정 D5: 계승은 새 여정의 직업(모험가)을 주는 전이다 — 새 게임 시작 · 전직과 같은 판정으로 열린 기술 성장을 알린다.
        const branchLog = getSkillBranchOpenedLog(null, String(freshPlayer.job), freshPlayer.skillChoices);
        const logs = appendRewardLogs(INITIAL_STATE.logs, [
            ...ascensionTitles.map((id) => ({ type: 'system', text: MSG.TITLE_UNLOCKED(getTitleLabel(id)) })),
            { type: 'system', text: MSG.ASCEND_DONE(outcome.nextRank, isNewAscensionTitle(outcome, state.player.titles) ? outcome.title : null) },
            ...(branchLog ? [{ type: 'system', text: branchLog }] : []),
            ...(ruleLog ? [{ type: 'event', text: ruleLog }] : []),
            ...(challengeLabels.length > 0 ? [{ type: 'warn', text: MSG.CHALLENGE_START(challengeLabels) }] : []),
            ...(startingRelics.length > 0 ? [{ type: 'event', text: MSG.START_BOOT_RELIC }] : []),
        ]);
        return {
            ...INITIAL_STATE,
            logs,
            // 2026-09 Wave 21 M2: 회수하지 못한 묘비는 승천을 넘긴다 — `RESET_GAME`(:34)과 대칭.
            //   여기가 비어 있던 동안 승천은 묘비(골드+아이템)를 조용히 지웠는데, 공개 침공
            //   문서(`public/data/graves/{uid}`)는 rules `delete: false`라 그대로 남는다(§8-2).
            //   즉 "남들은 내 묘비를 털 수 있는데 나는 회수할 수 없는" 상태가 됐다.
            //   `...state` 스프레드로 바꾸지 말 것 — `enemy`/`currentEvent`까지 이월돼
            //   §8-6의 복원 폴드가 전제하는 "런이 접혔다"가 깨진다. 보존은 이 한 필드다.
            grave: state.grave,
            uid: state.uid,
            bootStage: 'ready',
            player: freshPlayer,
            pendingRelics: startingRelics.length > 0 ? startingRelics : null,
            syncStatus: 'syncing',
        };
    },

    UNLOCK_TITLES: (state, action) => {
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

} satisfies HandlerMap);
