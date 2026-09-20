import { DB } from '../../data/db';
import { CLASSES } from '../../data/classes';
import { FIRST_STORY_QUEST_ID } from '../../data/quests';
import { RELICS, pickWeightedRelics } from '../../data/relics';
import { BALANCE, CONSTANTS } from '../../data/constants';
import { AT } from '../../reducers/actionTypes';
import { GS } from '../../reducers/gameStates';
import { MSG } from '../../data/messages';
import { getJobSkills } from '../../utils/gameUtils';
import { buildClassVitals } from './_shared';
import { getPrestigeUnlocks } from '../../systems/prestigeUnlocks';
import { getMirrorEffects } from '../../systems/mirrorUpgrades';
import { createQuestProgressState } from '../../utils/questProgress';
import { getDefaultExpeditionFocusQuestIds } from '../../utils/expeditionMissionFocus';
import { getRestCost } from '../../utils/expeditionReturnFlow';
import { queueMilestoneStoryBeat } from '../../utils/milestoneStory';
import { endDevourBonus } from '../../utils/adventureRelicBonuses';
import type { Player } from '../../types';
import type { GameActionDeps } from '../actionDeps';
import type { TitleSharedHelpers } from './_shared';

const getStartingQuests = (player: Player) => {
    const quests = Array.isArray(player.quests) ? player.quests : [];
    const claimedQuestIds = Array.isArray(player.stats?.claimedQuestIds)
        ? player.stats.claimedQuestIds
        : [];
    const firstStoryQuest = DB.QUESTS.find((quest) => quest.id === FIRST_STORY_QUEST_ID);

    if (!firstStoryQuest
        || claimedQuestIds.includes(FIRST_STORY_QUEST_ID)
        || quests.some((quest) => quest.id === FIRST_STORY_QUEST_ID)) {
        return quests;
    }

    return [...quests, createQuestProgressState(firstStoryQuest, player)];
};

const hasPreviousRunExperience = (player: Player) => {
    const stats = player.stats || {};
    return [
        player.meta?.prestigeRank,
        stats.deaths,
        stats.kills,
        stats.explores,
        stats.relicCount,
    ].some((value) => Number(value) > 0);
};

export const createCharacterActions = (deps: GameActionDeps, { emitUnlockedTitles }: TitleSharedHelpers) => {
    const { player, gameState, dispatch, addLog, addStoryLog, getFullStats } = deps;
    return {
        // cycle 566: gender / jobId / challengeModifiers 3 defaults 제거 —
        //   1 production caller (IntroScreen:49 onStart?.(selectedName, 'male',
        //   '모험가', selectedChallenges)) 4 args 명시 전달이라 모든 default
        //   도달 불가. body의 Array.isArray(challengeModifiers) defensive
        //   guard 보존. 청소 메가 시리즈 59번째 single-cycle 3-default batch.
        start: (name: string, gender: string, jobId: string, challengeModifiers: string[]) => {
            const trimmedName = String(name || '').trim().slice(0, 16);
            if (!trimmedName) return;
            const vitals = buildClassVitals(1, jobId, player.meta || {});
            let maxHp = vitals.maxHp;
            // 2026-07 — 에테르 거울: start_gold 노드가 레벨당 시작 골드에 가산.
            //   noGold 챌린지 모디파이어는 의도적 페널티이므로 거울 보너스도 함께 무효화.
            const mirrorEffects = getMirrorEffects(player.meta);
            let startGold = CONSTANTS.START_GOLD + mirrorEffects.startGoldBonus;
            const mods = Array.isArray(challengeModifiers) ? challengeModifiers : [];
            if (mods.includes('halfHp')) maxHp = Math.max(50, Math.floor(maxHp * 0.5));
            if (mods.includes('noGold')) startGold = 0;
            // Compute full starting HP/MP including passive skill bonuses for the chosen job
            const tempPlayer = { ...player, job: jobId, maxHp, maxMp: vitals.maxMp };
            const fullStartStats = getFullStats(tempPlayer);
            const startingQuests = getStartingQuests(player);
            const expeditionFocusQuestIds = getDefaultExpeditionFocusQuestIds({ ...player, quests: startingQuests });
            dispatch({ type: AT.SET_PLAYER, payload: {
                name: trimmedName, gender, job: jobId,
                level: 1, exp: 0, nextExp: CONSTANTS.START_NEXT_EXP,
                maxHp, hp: fullStartStats.maxHp,
                maxMp: vitals.maxMp, mp: fullStartStats.maxMp,
                gold: startGold,
                challengeModifiers: mods,
                quests: startingQuests,
                expeditionFocusQuestIds,
                stats: { ...(player.stats || {}), visitedMaps: [CONSTANTS.START_LOCATION] }
            }});
            const cls = CLASSES[jobId] || CLASSES[CONSTANTS.DEFAULT_JOB];
            addLog('system', MSG.START_JOURNEY(trimmedName));
            addLog('event', MSG.START_SKILL(cls.skills?.[0]?.name || '강타'));
            if (mods.length > 0) {
                const labels = mods.map((id) => BALANCE.CHALLENGE_MODIFIERS
                    .find((m: { id: string; label: string }) => m.id === id)?.label || id);
                addLog('warn', MSG.CHALLENGE_START(labels));
            }
            if (hasPreviousRunExperience(player)) {
                const startingRelicChoiceCount = getPrestigeUnlocks(player.meta?.prestigeRank).startBootChoices
                    + mirrorEffects.startBootChoiceBonus;
                // Wave 4 O2: 시작 부트 후보도 직업 기본 성향(빌드 아키타입)에 공명시킨다.
                //   신규 런은 장비/유물이 없어 buildProfile.primary가 직업 기본값으로 잡히므로,
                //   "내 직업이 쓸 만한 유물"이 첫 선택지에 더 자주 올라온다.
                const startingRelics = pickWeightedRelics(RELICS, startingRelicChoiceCount, {
                    rarityCap: BALANCE.START_BOOT_RARITY_CAP,
                    buildId: fullStartStats?.buildProfile?.primary?.id,
                });
                if (startingRelics.length > 0) {
                    dispatch({ type: AT.SET_PENDING_RELICS, payload: startingRelics });
                    addLog('event', MSG.START_BOOT_RELIC);
                }
            }
        },

        // cycle 535: dir default 1 제거 — 2 callsite (commandParser:80,
        //   CombatPanel:113) 모두 1 명시 전달이라 default 도달 불가. util
        //   /component/hook default 청소 메가 시리즈 31번째 (cycle 502-534).
        cycleSkill: (dir: number) => {
            const skills = getJobSkills(player);
            if (!skills.length) return;
            const current = Number.isInteger(player.skillLoadout?.selected) ? player.skillLoadout!.selected! : 0;
            const next = ((current + dir) % skills.length + skills.length) % skills.length;
            dispatch({
                type: AT.SET_PLAYER,
                payload: { skillLoadout: { selected: next, cooldowns: { ...(player.skillLoadout?.cooldowns || {}) } } }
            });
        },

        // cycle 56: 직접 skill 이름으로 선택 (UI에서 카드 탭 → 즉시 활성).
        selectSkill: (skillName: string) => {
            const skills = getJobSkills(player);
            if (!skills.length) return;
            const idx = skills.findIndex((s) => s.name === skillName);
            if (idx < 0) return;
            dispatch({
                type: AT.SET_PLAYER,
                payload: { skillLoadout: { selected: idx, cooldowns: { ...(player.skillLoadout?.cooldowns || {}) } } }
            });
        },

        /**
         * 상점 진입 — 소유자는 이 액션 하나다(2026-09 Wave 17 I1).
         *
         * 이전에는 `commandParser`와 `GameRoot`가 **각자** `setShopItems` + `setGameState('shop')`
         * 3줄을 복제했고 공유 가드가 없었다. 그래서 파서는 `type === 'safe'`만 보고 상태를
         * 안 봤는데, 전투가 가능한 safe 지역(`황금 왕국` — 유일하게 `monsters`를 가진 안전지대)
         * 에서 전투 중 `shop`을 치면 `gameState`가 'shop'으로 넘어가고, 상점을 닫으면
         * `ShopPanel`이 'idle'로 돌려놔 **도주 판정(ESCAPE_CHANCE 0.5) 없이 전투를 버릴 수**
         * 있었다. `SET_GAME_STATE`는 `enemy`도 지우지 않는다.
         *
         * 입력 표면이 둘인데 가드가 한쪽에만 있으면 그 가드는 없는 것과 같다 — Wave 16의
         * 안전지대 탐험과 같은 모양이다.
         */
        openShop: () => {
            if (gameState !== 'idle') return addLog('error', MSG.SHOP_BLOCKED);
            const mapData = DB.MAPS[player.loc!];
            if (!mapData || mapData.type !== 'safe') return addLog('error', MSG.SHOP_SAFE_ONLY);
            dispatch({ type: AT.SET_SHOP_ITEMS, payload: [
                ...DB.ITEMS.consumables, ...DB.ITEMS.weapons, ...DB.ITEMS.armors,
            ] });
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.SHOP });
            return addLog('info', MSG.SHOP_ENTERED);
        },

        rest: () => {
            if (gameState !== 'idle') return;
            const mapData = DB.MAPS[player.loc!];
            if (!mapData || mapData.type !== 'safe') return addLog('error', MSG.REST_SAFE_ONLY);
            // 2026-07 — 에테르 거울: rest_discount 노드가 휴식 비용에 배율로 적용.
            const restCost = getRestCost(player);
            if (player.gold! < restCost) return addLog('error', MSG.REST_GOLD_INSUFFICIENT(restCost));
            const stats = getFullStats();
            // cycle 112: rest 시 player.status 정리 — cycle 106-110에서 활성화된 5종 status
            // (bleed/freeze/stun/curse/blind/fear)를 안전지대 휴식으로 해소. 며칠간의 회복
            // 자연스러운 의미 + cure item이 없는 status(bleed/blind/fear/stun)에 대한
            // UX 안전망. tempBuff은 turn-based라 그대로 유지.
            const updatedPlayer: Player = {
                ...player,
                gold: player.gold! - restCost,
                hp: stats.maxHp,
                mp: stats.maxMp,
                status: [],
                stats: { ...(player.stats || {}), rests: (player.stats?.rests || 0) + 1 }
            };
            dispatch({ type: AT.SET_PLAYER, payload: updatedPlayer });
            dispatch({ type: AT.UPDATE_DAILY_PROTOCOL, payload: { type: 'goldSpend', amount: restCost } });
            emitUnlockedTitles(updatedPlayer);
            addLog('success', MSG.REST_DONE_FULL(restCost));
            addStoryLog('rest', { loc: player.loc });
        },

        swapSkillChoice: (skillName: string, newChoice: string) => {
            if (gameState !== 'idle') return;
            const mapData = DB.MAPS[player.loc!];
            if (!mapData || mapData.type !== 'safe') return addLog('error', MSG.SKILL_SWAP_SAFE_ONLY);
            const cost = BALANCE.SKILL_SWAP_COST || 50;
            if ((player.gold || 0) < cost) return addLog('error', MSG.SKILL_SWAP_GOLD_INSUFFICIENT(cost));
            const classData = CLASSES[player.job!];
            const branches = classData?.skillBranches?.[skillName];
            if (!branches) return addLog('error', MSG.SKILL_NO_BRANCH);
            const branch = branches.find((b) => b.choice === newChoice);
            if (!branch) return addLog('error', MSG.SKILL_INVALID_BRANCH);
            const oldChoice = player.skillChoices?.[skillName];
            const oldLabel = branches.find((entry) => entry.choice === oldChoice)?.label || '기본 성장';
            dispatch({
                type: AT.SET_PLAYER,
                payload: (p: Player) => ({
                    ...p,
                    gold: (p.gold || 0) - cost,
                    skillChoices: { ...(p.skillChoices || {}), [skillName]: newChoice },
                }),
            });
            addLog('success', MSG.SKILL_SWAP(skillName, oldLabel, branch.label || '선택한 성장'));
            addLog('info', MSG.SKILL_SWAP_COST(cost));
        },

        reset: () => dispatch({ type: AT.RESET_GAME }),

        jobChange: (jobName: string) => {
            const current = DB.CLASSES[player.job!];
            if (!current?.next?.includes(jobName)) return addLog('error', MSG.JOB_CHANGE_INVALID);
            if (player.level! < (DB.CLASSES[jobName]?.reqLv || 1)) return addLog('error', MSG.JOB_CHANGE_LEVEL);
            const vitals = buildClassVitals(player.level!, jobName, player.meta || {});
            const nextStats = getFullStats({
                ...endDevourBonus(player),
                job: jobName,
                maxHp: vitals.maxHp,
                maxMp: vitals.maxMp,
            });
            dispatch({
                type: AT.SET_PLAYER,
                payload: (currentPlayer: Player) => queueMilestoneStoryBeat({
                    ...endDevourBonus(currentPlayer),
                    job: jobName,
                    maxHp: vitals.maxHp,
                    hp: nextStats.maxHp,
                    maxMp: vitals.maxMp,
                    mp: nextStats.maxMp,
                    skillLoadout: { selected: 0, cooldowns: {} },
                }, 'first_job_change'),
            });
            dispatch({ type: AT.SET_GAME_STATE, payload: GS.IDLE });
            addLog('success', MSG.JOB_CHANGE_DONE(jobName));
        },
    };
};
