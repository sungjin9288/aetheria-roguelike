// 자연 플레이 드라이버 — 실제 액션 팩토리 · 리듀서로 게임을 처음부터 여러 회차 끝까지 돈다(화면 없음).
//
// 2026-10 Wave 117(소유자 결정 "저장소 안에 다시 만듦"): 밸런스 결정을 잰 드라이버가 저장소 밖에 있다가 컨테이너 재시작으로
//   지워졌다(원장 §123). 이 파일은 그 역할을 저장소 안에서 다시 맡는다. 게임 판정을 다시 쓰지 않는다 — 플레이어가 누르는
//   액션(`createGameActions` · `createCombatActions` · `createInventoryActions`)을 화면 대신 정책이 누른다.
//
// 결정론: 같은 (seed, 옵션)이면 같은 결과다. 전역 `Math.random`은 시드 난수로, `Date`는 행동마다 `stepSeconds`씩 가는 가짜
//   시계로 바꾼다(전투 · 계승 · 제작 액션이 `Math.random`을 직접 쓴다). 기록 id는 카운터라 기록 한 줄이 난수열을 밀지 않는다
//   (원장 §119.1 — 기록 id가 난수를 쓰던 예전 드라이버는 표시만 바꾼 변경도 짝 비교를 깼다).
//
// 정책은 일부러 단순하다. 바꾸면 기준선이 바뀌므로 정책 변경은 옵션으로 켜고 짝 비교로 잰다.

import { DB } from '../../src/data/db.ts';
import { getMonsterFamily } from '../../src/data/monsters.ts';
import { QUESTS } from '../../src/data/quests.ts';
import { AT } from '../../src/reducers/actionTypes.ts';
import { INITIAL_STATE, gameReducer } from '../../src/reducers/gameReducer.ts';
import { GS } from '../../src/reducers/gameStates.ts';
import { createGameActions } from '../../src/hooks/useGameActions.ts';
import { createCombatActions } from '../../src/hooks/useCombatActions.ts';
import { createInventoryActions } from '../../src/hooks/useInventoryActions.ts';
import { calculateFullStats } from '../../src/utils/statsCalculator.ts';
import { createSeededRandom, deriveSeed } from '../../src/utils/seededRandom.ts';
import { getJobSkills } from '../../src/utils/gameUtils.ts';
import { getClaimableQuestEntries } from '../../src/utils/questProgress.ts';
import { getQuestBoardRecommendations } from '../../src/utils/questOperations.ts';
import { pickBestEquippable } from '../../src/utils/equipmentUtils.ts';
import { mapRouteGateLevels, MAP_ROUTE_START_LOCATION } from '../../src/utils/mapRouteGate.ts';
import { getRelicChoiceDecisionStrip } from '../../src/utils/relicChoiceDecision.ts';
import { getRelicSynergyScore } from '../../src/utils/relicSynergyHint.ts';
import { getRunBuildProfile } from '../../src/utils/runProfile.ts';
import { getPrestigeUnlocks } from '../../src/systems/prestigeUnlocks.ts';
import { getActiveRelicSynergies, isRelicReplacementUpgrade } from '../../src/data/relics.ts';
import { MIRROR_ENDLESS_NODES, MIRROR_NODES } from '../../src/data/mirror.ts';
import { getMirrorNodeCost, isMirrorTreeComplete } from '../../src/systems/mirrorUpgrades.ts';
import { getRestCost } from '../../src/utils/expeditionReturnFlow.ts';
import { countDiscoveredSignatures, getDiscoveredSignatureNames } from '../../src/utils/signatureDiscovery.ts';
import { getAscensionRule, getAscensionRuleOffer, isActiveAscensionRuleOptional } from '../../src/systems/ascensionRule.ts';
import { HIDDEN_BOSS_UNLOCKS } from '../../src/utils/bossPresence.ts';
import { hasChallengeModifier } from '../../src/utils/challengeRules.ts';

// v2 (Wave 119): 퇴마 · 회복 기술을 쓴다 — v1은 위력(`mult`) 있는 기술만 써서 성직자가 회복도 퇴마도 하지 않았다(원장 §126).
export const DRIVER_VERSION = 2;

/** 직업 경로 기본값 — 경로 이름 → [1차, 2차, 3차]. */
export const JOB_PATHS = {
    knight: ['전사', '나이트', '드래곤 나이트'],
    berserker: ['전사', '버서커', '드래곤 나이트'],
    archmage: ['마법사', '아크메이지', '대마법사'],
    warlock: ['마법사', '흑마법사', '대마법사'],
    cleric: ['마법사', '성직자', '팔라딘'],
    shaman: ['마법사', '무당', '시간술사'],
    assassin: ['도적', '어쌔신', '그림자 주군'],
    ranger: ['도적', '레인저', '사냥의 군주'],
};

const FINAL_STORY_QUEST_ID = 87;
// `data/relics.ts`의 등급 순서(내보내지 않는다)와 같다 — 나아지는 교체에서 내려놓을 유물을 고를 때만 쓴다.
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const START_EPOCH_MS = 1_790_000_000_000;
const ROUTE_GATES = mapRouteGateLevels(MAP_ROUTE_START_LOCATION, DB.MAPS);
const STORY_PREFIX = '[스토리]';
const STORY_QUEST_IDS = QUESTS.filter((quest) => String(quest.title || '').startsWith(STORY_PREFIX)).map((quest) => quest.id);
const HIDDEN_BOSS_NAMES = new Set(HIDDEN_BOSS_UNLOCKS.map((entry) => entry.boss));
const HP_POTIONS = DB.ITEMS.consumables.filter((item) => item.type === 'hp').sort((a, b) => (b.val || 0) - (a.val || 0));

const isHuntMap = (name) => {
    const map = DB.MAPS[name];
    return Boolean(map) && map.type !== 'safe' && Array.isArray(map.monsters) && map.monsters.length > 0 && ROUTE_GATES.has(name);
};
const mapLevel = (name) => (Number.isFinite(Number(DB.MAPS[name]?.level)) ? Number(DB.MAPS[name].level) : 0);

/** 가짜 시계 — `new Date()` · `Date.now()`가 드라이버 시각을 읽는다(인자가 있는 생성은 그대로). */
const installClock = (clock) => {
    const RealDate = globalThis.Date;
    class DriverDate extends RealDate {
        constructor(...args) {
            if (args.length === 0) super(clock.now);
            else super(...args);
        }
        static now() { return clock.now; }
    }
    globalThis.Date = DriverDate;
    return () => { globalThis.Date = RealDate; };
};

/**
 * 한 시드를 돈다. 반환값은 JSON으로 그대로 쓸 수 있는 결과다.
 * @param {object} options
 * @param {number} options.seed
 * @param {string[]} [options.jobPath]       1 · 2 · 3차 직업
 * @param {number} [options.runs]            이만큼 계승하면 멈춘다(회차 수)
 * @param {number} [options.maxSteps]        안전 상한(행동 수)
 * @param {number} [options.stepSeconds]     행동 하나가 가짜 시계에서 걸리는 시간
 * @param {'none'|'all'|'stacked'|`rank:${number}`} [options.ruleDecline] 거절할 수 있는 회차 규칙 카드를 거절하는 범위
 * @param {'default'|'fixed'} [options.rulePick] 회차 규칙 카드 — 화면이 처음 골라 두는 카드(기본), 또는 고정 순서 규칙이 패에 있으면 그 카드
 *   (`fixed` — 첫 순환 미리보기 값을 잰 단계(`measuredRank`)에 놓는다, 원장 §121.7 · §128). 고르는 방식만 다르고 난수 소비는 같다.
 */
const TRACE = Boolean(process.env.NATURAL_PLAY_TRACE);

/**
 * 계승 화면에서 고르는 회차 규칙 카드. `default`는 아무것도 고르지 않는다(리듀서가 패에서 가장 가벼운 카드 — 화면이 처음 골라 두는 카드).
 * `fixed`는 고정 순서 규칙(`getAscensionRule`)이 패에 있으면 그 카드, 없으면 기본 카드다.
 */
export const pickAscensionRuleId = (player, nextRank, rulePick) => {
    if (rulePick !== 'fixed') return undefined;
    const fixedRule = getAscensionRule(nextRank);
    return fixedRule && getAscensionRuleOffer(player, nextRank).some((rule) => rule.id === fixedRule.id) ? fixedRule.id : undefined;
};

export const runNaturalPlay = async (options) => {
    const {
        seed,
        jobPath = JOB_PATHS.knight,
        runs: targetRuns = 1,
        maxSteps = 400_000,
        stepSeconds = 15,
        ruleDecline = 'none',
        rulePick = 'default',
    } = options;
    if (!Number.isInteger(seed)) throw new Error('seed must be an integer');

    const clock = { now: START_EPOCH_MS };
    const restoreDate = installClock(clock);
    const realRandom = Math.random;
    Math.random = createSeededRandom(deriveSeed(seed, 'natural-play'));

    let state = { ...structuredClone(INITIAL_STATE), bootStage: 'ready', logs: [] };
    let logCounter = 0;
    const dispatch = (action) => { state = gameReducer(state, action); };
    const addLog = (type, text) => dispatch({ type: AT.ADD_LOG, payload: { id: `np-${logCounter++}`, type, text } });
    const getFullStats = (player) => calculateFullStats(player ?? state.player);

    const buildActions = () => {
        const deps = {
            player: state.player,
            gameState: state.gameState,
            uid: 'natural-play',
            grave: state.grave,
            currentEvent: state.currentEvent,
            isAiThinking: state.isAiThinking,
            enemy: state.enemy,
            liveConfig: state.liveConfig ?? null,
            dispatch,
            addLog,
            addStoryLog: () => {},
            getFullStats,
        };
        const combatDeps = {
            ...deps,
            clearPendingCombat: () => {},
            schedulePendingCombat: () => {},
            claimCombatItem: () => true,
            claimCombatAction: () => true,
            combatTurn: state.combatTurn,
        };
        return { ...createGameActions(deps), ...createCombatActions(combatDeps), ...createInventoryActions(deps) };
    };

    const result = {
        driverVersion: DRIVER_VERSION,
        seed,
        jobPath,
        ruleDecline,
        rulePick,
        stepSeconds,
        runs: [],
        deaths: [],
        steps: 0,
        stalled: null,
    };

    let step = 0;
    let run = null;
    const rank = () => Number(state.player?.meta?.prestigeRank) || 0;
    const claimed = () => new Set((state.player?.stats?.claimedQuestIds || []).map(String));
    const hours = () => (clock.now - START_EPOCH_MS) / 3_600_000;
    const openRun = () => {
        const meta = state.player?.meta || {};
        run = {
            run: result.runs.length + 1,
            rank: rank(),
            ruleId: meta.ascensionRule?.rank === rank() ? meta.ascensionRule?.ruleId ?? null : null,
            secondModifier: meta.ascensionRule?.rank === rank() ? meta.ascensionRule?.secondModifier ?? null : null,
            // 거절할 수 있는 카드였는가(선택형 규칙, 또는 무거운 두 번째 비틀기가 붙은 겹친 카드) — 미리보기 값은 이 회차만 잰다.
            ruleOptional: meta.ascensionRule?.rank === rank() ? isActiveAscensionRuleOptional(meta) : false,
            ruleDeclined: Boolean(state.player?.ascensionRuleDeclined),
            challengeModifiers: [...(state.player?.challengeModifiers || [])],
            startStep: step,
            startHours: hours(),
            deaths: 0,
            levelAt: {},
            combats: 0,
            eliteCombats: 0,
            bossCombats: 0,
            // 보스 · 정예 종별 교전 수(지역 · 종) — 사망 수와 나눠 교전당 사망률을 본다.
            fightsBy: {},
            // 큰 순간(원장 §80 정의 + 토벌 의뢰) — [회차 시작부터 시간, 종류]. 상태 차이만 읽는다(정책 · 난수 불변).
            moments: [],
        };
    };
    const closeRun = () => {
        const meta = state.player?.meta || {};
        const { momentBest: _best, momentJobs: _jobs, ...runRecord } = run;
        result.runs.push({
            ...runRecord,
            endStep: step,
            hours: Number((hours() - run.startHours).toFixed(3)),
            ladderRank: Number(meta.rank) || 0,
            metaBonus: { atk: Number(meta.bonusAtk) || 0, hp: Number(meta.bonusHp) || 0, mp: Number(meta.bonusMp) || 0 },
            essence: Number(meta.essence) || 0,
            // 회차 끝 도감의 전설 각인 — 직전 회차 끝에 없던 것이 그 회차의 새 각인이다(계승 화면 요약과 같은 규칙, 원장 §121.7).
            signatures: getDiscoveredSignatureNames(state.player),
        });
        run = null;
    };
    // `rank:N` — 그 단계의 카드 하나만 거절한다(앞 회차는 받아들임과 같은 역사라 받아들임 결과와 깨끗한 짝이 된다, 원장 §128).
    const declineFor = (nextRank) => ruleDecline === 'all' || (ruleDecline === 'stacked' && nextRank > 6) || ruleDecline === `rank:${nextRank}`;

    let lastGameState = null;
    let lastCombatSnapshot = null;
    let previousTopState = null;
    let lastProgressStep = 0;
    let lastSignature = '';
    let lastMoments = null;

    try {
        while (step < maxSteps && result.runs.length < targetRuns) {
            step += 1;
            clock.now += stepSeconds * 1000;
            let A = buildActions();
            const p = state.player;
            lastGameState = previousTopState;
            previousTopState = state.gameState;

            // 진행 감시 — 같은 상태가 오래 이어지면 정책이 막힌 것이다(결과에 남기고 멈춘다).
            const signature = `${state.gameState}|${p?.loc}|${p?.level}|${p?.exp}|${p?.hp}|${p?.gold}|${state.combatTurn}|${(p?.stats?.explores) || 0}`;
            if (signature !== lastSignature) { lastSignature = signature; lastProgressStep = step; }
            if (TRACE) console.error(`${step} ${state.gameState} ${p?.loc} Lv${p?.level} hp${p?.hp} mp${p?.mp} g${p?.gold} | ${state.logs.at(-1)?.text ?? ''}`);
            if (step - lastProgressStep > 200) {
                result.stalled = { step, gameState: state.gameState, loc: p?.loc, level: p?.level, lastLogs: state.logs.slice(-6).map((log) => log.text) };
                break;
            }

            if (!String(p?.name || '').trim()) {
                A.start('용사', 'male', '모험가', [], declineFor(rank()));
                continue;
            }
            if (!run) openRun();
            detectMoments(p);
            const level = Number(p.level) || 1;
            if (run.levelAt[level] === undefined) run.levelAt[level] = Number((hours() - run.startHours).toFixed(3));

            // 유물 선택 — 화면 추천(`getRelicChoiceDecisionStrip`). 칸이 찼으면 나아지는 교체만 한다.
            if (Array.isArray(state.pendingRelics) && state.pendingRelics.length > 0) {
                const owned = p.relics || [];
                const cards = state.pendingRelics.map((relic, index) => ({ relic, index, synergy: getRelicSynergyScore(relic, owned) }));
                const buildId = getRunBuildProfile(p, getFullStats()).primary.id;
                const decision = getRelicChoiceDecisionStrip(cards, buildId);
                const pick = state.pendingRelics[Math.max(0, decision.recommendedIndex)];
                const capacity = getPrestigeUnlocks(p.meta?.prestigeRank).maxRelics;
                if (owned.length < capacity) {
                    dispatch({ type: AT.ADD_RELIC, payload: pick });
                } else {
                    const release = isRelicReplacementUpgrade(pick, owned) ? pickRelicToRelease(pick, owned) : null;
                    if (release) dispatch({ type: AT.REPLACE_RELIC, payload: { relicId: pick.id, replaceRelicId: release.id } });
                    else dispatch({ type: AT.DECLINE_RELIC });
                }
                continue;
            }

            if (state.postCombatResult && !state.postCombatResult.postCombatChoiceResolved) {
                const stats = getFullStats();
                const choice = (p.hp / Math.max(1, stats.maxHp)) < 0.5 ? 'breather' : 'push';
                const before = state;
                dispatch({ type: AT.RESOLVE_POST_COMBAT_CHOICE, payload: { choice } });
                if (state === before) dispatch({ type: AT.SET_POST_COMBAT_RESULT, payload: null });
                continue;
            }

            switch (state.gameState) {
            case GS.DEAD: {
                // 패배 정산(`handleDefeat`)이 이미 새 여정 player를 만들었으므로 죽은 순간의 기록은 전투 직전 스냅숏이다.
                const before = lastCombatSnapshot || { level, loc: p.loc, enemy: {} };
                const enemy = before.enemy || {};
                run.deaths += 1;
                result.deaths.push({
                    run: run.run, step, hours: Number((hours() - run.startHours).toFixed(3)), level: before.level, loc: before.loc,
                    hpRatio: before.hpRatio ?? null,
                    enemy: { name: enemy.name ?? null, baseName: enemy.baseName ?? null, isElite: Boolean(enemy.isElite), isBoss: Boolean(enemy.isBoss), huntChampion: Boolean(enemy.huntChampion) },
                });
                lastCombatSnapshot = null;
                A.reset();
                continue;
            }
            case GS.ASCENSION: {
                const ready = rank() >= 1 || claimed().has(String(FINAL_STORY_QUEST_ID));
                if (!ready) { A.cancelAscension(); continue; }
                for (const entry of getClaimableQuestEntries(p)) { A.completeQuest(entry.quest?.id ?? entry.id); A = buildActions(); }
                const before = rank();
                const ruleId = pickAscensionRuleId(state.player, before + 1, rulePick);
                closeRun();
                A.confirmAscension([], declineFor(before + 1), ruleId);
                if (rank() === before) { openRun(); run.run = result.runs.length; result.runs.pop(); }
                continue;
            }
            case GS.COMBAT:
                playCombatTurn();
                continue;
            case GS.EVENT:
                playEvent();
                continue;
            case GS.MOVING:
            case GS.SHOP:
            case GS.JOB_CHANGE:
            case GS.QUEST_BOARD:
            case GS.CRAFTING:
            case GS.TRUE_ENDING:
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                continue;
            case GS.EVENT_PENDING:
                dispatch({ type: AT.RESOLVE_AI_EVENT, payload: { event: null } });
                continue;
            default:
                await playIdle();
            }
        }
    } finally {
        Math.random = realRandom;
        restoreDate();
    }
    if (run) closeRun();
    result.steps = step;
    result.finalLevel = Number(state.player?.level) || 0;
    result.finalRank = Number(state.player?.meta?.prestigeRank) || 0;
    // 끝난 시점의 이야기 임무 — 계승하지 못한 판을 진단한다.
    result.openStoryQuests = (state.player?.quests || [])
        .map((entry) => ({ entry, quest: QUESTS.find((quest) => quest.id === entry.id) }))
        .filter(({ quest }) => String(quest?.title || '').startsWith(STORY_PREFIX))
        .map(({ entry, quest }) => ({ id: quest.id, progress: entry.progress ?? null, goal: quest.goal, target: quest.target ?? null, location: quest.location ?? null }));
    result.claimedStoryQuests = QUESTS.filter((quest) => String(quest.title || '').startsWith(STORY_PREFIX) && claimed().has(String(quest.id))).map((quest) => quest.id);
    return result;

    // ── 정책 ──────────────────────────────────────────────────────────────

    function playCombatTurn() {
        const A = buildActions();
        const p = state.player;
        const enemy = state.enemy || {};
        if (lastGameState !== GS.COMBAT) {
            run.combats += 1;
            if (enemy.isElite) run.eliteCombats += 1;
            if (enemy.isBoss) run.bossCombats += 1;
            if (enemy.isBoss || enemy.isElite) {
                const key = `${enemy.isBoss ? 'boss' : 'elite'}|${p.loc}|${enemy.baseName}`;
                run.fightsBy[key] = (run.fightsBy[key] || 0) + 1;
            }
        }
        const stats = getFullStats();
        const hpRatio = p.hp / Math.max(1, stats.maxHp);
        lastCombatSnapshot = { level: Number(p.level) || 1, loc: p.loc, hpRatio: Number(hpRatio.toFixed(3)), enemy: { name: enemy.name, baseName: enemy.baseName, isElite: enemy.isElite, isBoss: enemy.isBoss, huntChampion: enemy.huntChampion } };
        const cooldowns = p.skillLoadout?.cooldowns || {};
        const skills = getJobSkills(p);
        const usable = (skill) => (p.mp || 0) >= (Number(skill.mp) || 0) && !((cooldowns[String(skill.name)] || 0) > 0);
        // '뒤섞인 기술' 회차는 고른 기술을 뺀 나머지가 무작위로 나간다(보조 기술이면 차례를 버린다) — 기술을 고르지 않는다.
        const canChooseSkill = !hasChallengeModifier(p, 'randomSkills');
        const useSkill = (skill) => {
            const selected = skills[p.skillLoadout?.selected ?? 0];
            if (selected?.name !== skill.name) A.selectSkill(skill.name);
            buildActions().combat('skill');
        };
        // v2: 퇴마(`smite`) — 언데드 · 마족에게 회복 기술은 회복량만큼 신성 피해다(Wave 51). 쓸 수 있으면 먼저 쓴다.
        const family = getMonsterFamily(enemy);
        if (canChooseSkill && (family === 'undead' || family === 'demon')) {
            const smite = skills.filter((skill) => Number(skill.smite) > 0 && usable(skill))
                .sort((a, b) => (Number(b.val) || 0) - (Number(a.val) || 0))[0];
            if (smite) { useSkill(smite); return; }
        }
        // v2: 생명 50% 아래면 회복 기술(`hp_regen`)을 먼저, 없으면 30% 아래에서 물약.
        if (canChooseSkill && hpRatio < 0.5) {
            // 즉시 회복이 최대 생명의 20% 이상인 기술만 — 10% 회복(역경의 힘)으로 차례를 쓰면 버서커 1회차 사망이 늘었다(z +2.0).
            const heal = skills.filter((skill) => skill.effect === 'hp_regen' && (Number(skill.val) || 0) >= 0.2 && usable(skill))
                .sort((a, b) => (Number(b.val) || 0) - (Number(a.val) || 0))[0];
            if (heal) { useSkill(heal); return; }
        }
        if (hpRatio < 0.3 && potionsAllowed()) {
            const potion = HP_POTIONS.map((def) => (p.inv || []).find((item) => item.name === def.name)).find(Boolean);
            if (potion) { A.combatUseItem(potion); return; }
        }
        let best = null;
        skills.forEach((skill) => {
            const mult = Number(skill.mult) || 0;
            if (mult <= 0 || skill.effect === 'escape_100' || !usable(skill)) return;
            if (!best || mult > best.mult) best = { skill, mult };
        });
        if (best && canChooseSkill) { useSkill(best.skill); return; }
        A.combat('attack');
    }

    function playEvent() {
        const event = state.currentEvent;
        const choices = Array.isArray(event?.choices) ? event.choices : [];
        if (!event || choices.length === 0) {
            dispatch({ type: AT.SET_EVENT, payload: null });
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
            return;
        }
        for (let index = 0; index < choices.length; index += 1) {
            const before = state;
            buildActions().handleEventChoice(index);
            if (state.gameState !== GS.EVENT || state.currentEvent !== before.currentEvent && !state.currentEvent?.choiceFeedback) return;
        }
        dispatch({ type: AT.SET_EVENT, payload: null });
        dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
    }

    async function playIdle() {
        let A = buildActions();
        let p = state.player;

        // 계승을 미뤘는데 이제 준비됐으면 다시 연다(1회차는 마지막 이야기 임무를 받은 뒤).
        if (p.ascensionOfferDeferred && (rank() >= 1 || claimed().has(String(FINAL_STORY_QUEST_ID)))) {
            A.reopenAscension();
            return;
        }

        // 장비 — 지금보다 나은 것만 낀다.
        for (const type of ['weapon', 'armor', 'shield']) {
            const item = pickBestEquippable(p, type, { upgradesOnly: true });
            if (item) { A.useItem(item); A = buildActions(); p = state.player; }
        }

        // 임무 — 받을 수 있는 보상은 받고, 게시판 추천은 받는다.
        for (const entry of getClaimableQuestEntries(p)) {
            A.completeQuest(entry.quest?.id ?? entry.id);
            A = buildActions(); p = state.player;
        }
        // 임무 수락은 마을 게시판에서만 된다.
        if (DB.MAPS[p.loc]?.type === 'safe') {
            // 다음 이야기 장은 추천 칸에 없어도 받는다(사람은 이야기를 따라간다).
            const story = nextStoryQuest(p);
            if (story) { A.acceptQuest(story.id); A = buildActions(); p = state.player; }
            const board = getQuestBoardRecommendations(p);
            for (const entry of board.featured || []) {
                A.acceptQuest(entry.quest.id);
                A = buildActions(); p = state.player;
            }
        }

        // 전직
        const currentJob = DB.CLASSES[p.job];
        const nextJob = jobPath.find((job) => currentJob?.next?.includes(job));
        if (nextJob && (Number(p.level) || 1) >= (DB.CLASSES[nextJob]?.reqLv || 1)) {
            A.jobChange(nextJob);
            A = buildActions(); p = state.player;
        }

        // 거울 — 가장 싼 단계부터 살 수 있는 만큼.
        for (let guard = 0; guard < 50; guard += 1) {
            const essence = Number(p.meta?.essence) || 0;
            const mirror = p.meta?.mirror || {};
            const nodes = isMirrorTreeComplete(mirror) ? [...MIRROR_NODES, ...MIRROR_ENDLESS_NODES] : MIRROR_NODES;
            const candidates = nodes
                .map((node) => ({ node, level: Number(mirror[node.id]) || 0 }))
                .filter(({ node, level }) => level < (node.maxLevel ?? Infinity))
                .map(({ node, level }) => ({ node, cost: getMirrorNodeCost(node, level) }))
                .filter(({ cost }) => Number.isFinite(cost) && cost <= essence)
                .sort((a, b) => a.cost - b.cost);
            if (candidates.length === 0) break;
            const before = state;
            A.purchaseMirrorNode(candidates[0].node.id);
            A = buildActions(); p = state.player;
            if (state === before) break;
        }

        const stats = getFullStats();
        const map = DB.MAPS[p.loc];
        const lowHp = p.hp / Math.max(1, stats.maxHp) < 0.5;
        const lowMp = (p.mp || 0) / Math.max(1, stats.maxMp) < 0.25;
        // 쉴 돈이 없으면 돌아가도 소용없다 — 가진 것으로 계속 싸운다(골드 54로 마을 ↔ 평원을 오가던 시드 2).
        const canRest = (p.gold || 0) >= getRestCost(p);

        if (map?.type === 'safe') {
            if ((lowHp || lowMp) && canRest) {
                const before = state.player;
                A.rest();
                if (state.player !== before) return;
            }
            // 체력 물약 3개까지 산다.
            const owned = (p.inv || []).filter((item) => item.type === 'hp').length;
            if (owned < 3 && potionsAllowed()) {
                A.openShop();
                for (let index = owned; index < 3; index += 1) {
                    const shopActions = buildActions();
                    const before = state.player;
                    const potion = HP_POTIONS.find((def) => def.price <= (state.player.gold || 0) * 0.3 && def.val < 9999);
                    if (!potion) break;
                    shopActions.market('buy', potion, 'stock');
                    if (state.player === before) break;
                }
                dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
                A = buildActions(); p = state.player;
            }
        } else if (lowHp || lowMp) {
            const potion = lowHp && potionsAllowed() ? HP_POTIONS.map((def) => (p.inv || []).find((item) => item.name === def.name)).find(Boolean) : null;
            if (potion) { A.useItem(potion); return; }
            const safe = canRest ? nearestSafeMap(p.loc) : null;
            if (safe) { stepToward(safe); return; }
        }

        // 받을 수 있는 이야기 장이 있으면 게시판(안전지대)으로 돌아간다.
        if (map?.type !== 'safe' && nextStoryQuest(state.player)) {
            const safe = nearestSafeMap(state.player.loc);
            if (safe) { stepToward(safe); return; }
        }

        const target = chooseTargetMap(state.player);
        if (target && target !== state.player.loc) { stepToward(target); return; }
        await buildActions().explore();
    }

    /** 나아지는 교체에서 내려놓을 유물 — `isRelicReplacementUpgrade`와 같은 기준(조합 수가 늘거나, 같으면 등급이 오른다). */
    function pickRelicToRelease(card, owned) {
        const rankOf = (relic) => RARITY_ORDER.indexOf(relic.rarity ?? 'common');
        const combosBefore = getActiveRelicSynergies(owned).length;
        let best = null;
        owned.forEach((released, index) => {
            if (released.borrowed) return;
            const combosAfter = getActiveRelicSynergies(owned.map((relic, i) => (i === index ? card : relic))).length;
            const better = combosAfter > combosBefore || (combosAfter === combosBefore && rankOf(card) > rankOf(released));
            if (!better) return;
            const score = combosAfter * 10 - rankOf(released);
            if (!best || score > best.score) best = { relic: released, score };
        });
        return best?.relic ?? null;
    }


    /** 큰 순간의 셈 — 각 항목이 늘면 그 종류의 순간이다(사망 · 계승으로 줄어든 뒤 다시 늘어도 순간이다). */
    function momentCounts(p) {
        const done = claimed();
        const chain = Object.entries(p.eventChainProgress || {}).reduce((sum, [, value]) => sum + (typeof value === 'number' ? value : 0), 0);
        const hunt = Object.values(p.huntContracts || {}).reduce((sum, entry) => sum + (Number(entry?.stage) || 0) + 10 * ((Number(entry?.round) || 1) - 1), 0);
        return {
            story: STORY_QUEST_IDS.filter((id) => done.has(String(id))).length,
            chain,
            job: p.job,
            relicOffer: Array.isArray(state.pendingRelics) && state.pendingRelics.length > 0 ? 1 : 0,
            signature: countDiscoveredSignatures(p),
            areaBoss: Object.values(p.stats?.areaBossDefeated || {}).filter(Boolean).length,
            merchant: p.merchantVisit ? `${p.merchantVisit.loc}|${(p.merchantVisit.stock || []).map((offer) => offer.name).join(',')}` : '',
            region: (p.stats?.visitedMaps || []).length,
            hunt,
            bag: Number(p.bagTier) || 0,
        };
    }

    function detectMoments(p) {
        const now = momentCounts(p);
        const before = lastMoments;
        lastMoments = now;
        if (!before || !run) return;
        const at = Number((hours() - run.startHours).toFixed(3));
        // 사망하면 여정이 처음부터라 이야기 · 지역 · 체인 · 의뢰를 다시 얻는다 — 회차 안 최고치를 넘을 때만 새 순간이다.
        const best = run.momentBest || (run.momentBest = {});
        for (const kind of ['story', 'chain', 'signature', 'areaBoss', 'region', 'hunt', 'bag']) {
            if (now[kind] > before[kind] && now[kind] > (best[kind] ?? 0)) run.moments.push([at, kind]);
            best[kind] = Math.max(best[kind] ?? 0, now[kind]);
        }
        const jobs = run.momentJobs || (run.momentJobs = new Set());
        if (now.job !== before.job && now.job !== '모험가' && !jobs.has(now.job)) { jobs.add(now.job); run.moments.push([at, 'job']); }
        if (now.relicOffer && !before.relicOffer) run.moments.push([at, 'relic']);
        if (now.merchant && now.merchant !== before.merchant) run.moments.push([at, 'merchant']);
        // 숨은 보스 처치 — 전투가 승리로 끝난 차례(살아서 전투를 벗어났고 마지막 적이 숨은 보스).
        if (lastGameState === GS.COMBAT && state.gameState !== GS.COMBAT && state.gameState !== GS.DEAD
            && HIDDEN_BOSS_NAMES.has(lastCombatSnapshot?.enemy?.baseName)) run.moments.push([at, 'hiddenBoss']);
    }

    /** '물약 없이' 회차에는 회복 · 보조 아이템을 쓸 수 없다(`consumableEffect`가 거부한다). */
    function potionsAllowed() {
        return !hasChallengeModifier(state.player, 'noPotion');
    }

    /** 지금 받을 수 있는데 아직 받지 않은 이야기 장(선행 수령 · 수락 레벨). */
    function nextStoryQuest(p) {
        const done = claimed();
        const active = new Set((p.quests || []).map((entry) => String(entry.id)));
        const level = Number(p.level) || 1;
        return QUESTS.find((quest) => String(quest.title || '').startsWith(STORY_PREFIX)
            && !done.has(String(quest.id)) && !active.has(String(quest.id))
            && level >= (quest.minLv || 1)
            && (quest.prerequisiteQuestId == null || done.has(String(quest.prerequisiteQuestId)))) || null;
    }

    function chooseTargetMap(p) {
        const level = Number(p.level) || 1;
        // 이동은 지역의 선언 레벨로 막힌다(`getMapAccess`) — 경로 게이트와 둘 다 넘어야 걸어 들어간다.
        const reachable = (name) => (ROUTE_GATES.get(name) ?? Infinity) <= level && mapLevel(name) <= level;
        // 이야기 임무의 목표 지역이 먼저다.
        for (const questState of p.quests || []) {
            const quest = QUESTS.find((entry) => entry.id === questState.id);
            if (!quest || !String(quest.title || '').startsWith(STORY_PREFIX)) continue;
            if (Number(questState.progress) >= Number(quest.goal)) continue;
            if (quest.location && reachable(quest.location)) return quest.location;
        }
        // 그 밖에는 걸어서 들어갈 수 있는 가장 높은 사냥 지역.
        let best = null;
        for (const name of Object.keys(DB.MAPS)) {
            if (!isHuntMap(name) || !reachable(name) || mapLevel(name) > level) continue;
            if (!best || mapLevel(name) > mapLevel(best)) best = name;
        }
        return best;
    }

    /** 지금 레벨로 걸을 수 있는 길(출구 · 지역 선언 레벨 · 계절 지역 제외)만 따르는 최단 경로. */
    function walkPath(from, accept) {
        const level = Number(state.player.level) || 1;
        const prev = new Map([[from, null]]);
        const queue = [from];
        while (queue.length) {
            const here = queue.shift();
            if (here !== from && accept(here)) {
                const path = [here];
                for (let at = prev.get(here); at; at = prev.get(at)) path.unshift(at);
                return path;
            }
            for (const next of DB.MAPS[here]?.exits || []) {
                const map = DB.MAPS[next];
                if (!map || prev.has(next) || map.seasonOnly || mapLevel(next) > level) continue;
                prev.set(next, here);
                queue.push(next);
            }
        }
        return [];
    }

    function nearestSafeMap(from) {
        const path = walkPath(from, (name) => DB.MAPS[name]?.type === 'safe');
        return path.length ? path[path.length - 1] : null;
    }

    function stepToward(target) {
        const path = walkPath(state.player.loc, (name) => name === target);
        const next = Array.isArray(path) && path.length > 1 ? path[1] : null;
        if (!next) return false;
        buildActions().move(next);
        return true;
    }
};
