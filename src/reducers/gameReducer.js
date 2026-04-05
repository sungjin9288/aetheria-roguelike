import { DB } from '../data/db';
import { CONSTANTS, BALANCE } from '../data/constants';
import { AT } from './actionTypes';
import { findItemByName, makeItem } from '../utils/gameUtils';
import { DEFAULT_EXPLORE_STATE } from '../utils/explorationPacing';
import { SEASON_TIER_XP, SEASON_REWARDS } from '../data/seasonPass';

const sanitizeQuickSlots = (slots = [], inventory = []) => {
    const ids = new Set((inventory || []).map((item) => item?.id).filter(Boolean));
    const normalized = Array.from({ length: 3 }, (_, i) => (Array.isArray(slots) ? slots[i] : undefined) ?? null);
    return normalized.map((slot) => (slot?.id && ids.has(slot.id) ? slot : null));
};

const applyDailyProtocolProgress = (player, type, amount = 1) => {
    const dp = player.stats?.dailyProtocol;
    if (!dp) return player;

    let essenceGain = 0;
    let newShards = dp.relicShards || 0;
    const itemRewards = [];

    const updatedMissions = dp.missions.map((mission) => {
        if (mission.type !== type || mission.done) return mission;

        const progress = Math.min(mission.goal, (mission.progress || 0) + amount);
        const justDone = progress >= mission.goal && !mission.done;
        if (justDone) {
            if (mission.reward?.essence) essenceGain += mission.reward.essence;
            if (mission.reward?.item) itemRewards.push(mission.reward.item);
            if (mission.reward?.relicShard) newShards += mission.reward.relicShard;
        }

        return { ...mission, progress, done: progress >= mission.goal };
    });

    const nextPlayer = {
        ...player,
        stats: {
            ...player.stats,
            dailyProtocol: {
                ...dp,
                missions: updatedMissions,
                relicShards: newShards,
            }
        }
    };

    if (essenceGain > 0) {
        const nextMeta = {
            ...(nextPlayer.meta || {}),
            essence: (nextPlayer.meta?.essence || 0) + essenceGain,
            rank: nextPlayer.meta?.rank || 0,
            bonusAtk: nextPlayer.meta?.bonusAtk || 0,
            bonusHp: nextPlayer.meta?.bonusHp || 0,
            bonusMp: nextPlayer.meta?.bonusMp || 0,
        };
        const nextRank = Math.floor(nextMeta.essence / 150);
        if (nextRank > nextMeta.rank) {
            const gain = nextRank - nextMeta.rank;
            nextMeta.rank = nextRank;
            nextMeta.bonusAtk += gain;
            nextMeta.bonusHp += gain * 5;
            nextMeta.bonusMp += gain * 3;
        }
        nextPlayer.meta = nextMeta;
    }

    if (itemRewards.length > 0) {
        const rewardedItems = itemRewards
            .map((name) => findItemByName(name))
            .filter(Boolean)
            .map((item) => makeItem(item));
        if (rewardedItems.length > 0) {
            nextPlayer.inv = [...(nextPlayer.inv || []), ...rewardedItems];
        }
    }

    return nextPlayer;
};

// --- INITIAL STATE ---
export const INITIAL_STATE = {
    // Bootstrapping Flags
    bootStage: 'init', // init -> auth -> config -> data -> ready
    uid: null,

    // Game Data
    player: {
        name: '', job: '모험가', gender: 'male', level: 1, hp: CONSTANTS.START_HP, maxHp: CONSTANTS.START_HP, mp: CONSTANTS.START_MP, maxMp: CONSTANTS.START_MP, atk: 10, def: 5, exp: 0, nextExp: 100, gold: CONSTANTS.START_GOLD, loc: '시작의 마을',
        inv: [{ ...DB.ITEMS.consumables[0], id: 'starter_1' }, { ...DB.ITEMS.consumables[0], id: 'starter_2' }], equip: { weapon: DB.ITEMS.weapons[0], armor: DB.ITEMS.armors[0], offhand: null },
        quests: [], achievements: [],
        stats: { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0, rests: 0, bountyDate: null, bountyIssued: false, bountiesCompleted: 0, relicCount: 0, comboCount: 0, crafts: 0, abyssFloor: 0, demonKingSlain: 0, dailyProtocol: null, claimedAchievements: [], explores: 0, lowHpWins: 0, discoveries: 0, buildWins: {}, visitedMaps: ['시작의 마을'], exploreState: { ...DEFAULT_EXPLORE_STATE }, codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} }, codexClaimed: [] },
        premiumCurrency: 0,
        seasonPass: { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' },
        weeklyProtocol: { kills: 0, explores: 0, bossKills: 0, lastResetWeek: 0, claimed: [] },
        skillChoices: {},
        challengeModifiers: [],
        tempBuff: { atk: 0, def: 0, turn: 0, name: null }, status: [],
        skillLoadout: { selected: 0, cooldowns: {} },
        meta: { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0, prestigeRank: 0, totalPrestigeAtk: 0, totalPrestigeHp: 0, totalPrestigeMp: 0 },
        relics: [], titles: [], activeTitle: null,
        combatFlags: { comboCount: 0, deathSaveUsed: false, voidHeartUsed: false, voidHeartArmed: false },
        history: [], archivedHistory: [],
        eventChainProgress: {}
    },

    // Runtime State
    version: CONSTANTS.DATA_VERSION,

    gameState: 'idle',
    logs: [],
    enemy: null,
    currentEvent: null,
    grave: null,
    shopItems: [],
    sideTab: 'inventory',
    isAiThinking: false,
    visualEffect: null,
    syncStatus: 'offline', // offline, syncing, synced

    // Shared Data
    leaderboard: [],
    liveConfig: { eventMultiplier: 1, announcement: '', seasonEvent: null },

    // Sync Guard
    lastLoadedTimestamp: 0,

    // Feature Additions
    quickSlots: [null, null, null],   // 퀵슬롯 3개
    postCombatResult: null,            // 전투 결과 요약 카드
    onboardingDismissed: false,        // 온보딩 안내 숨김 여부
    pendingRelics: null,               // v4.0: 유물 3지선다 후보 배열
    runSummary: null,                  // v5.0: 런 종료 요약 (사망 시)
    publicGraves: [],                  // v4.3: 공개 묘비 목록 (침략 대상)
};

// --- REDUCER (Atomic Logic) ---
export const gameReducer = (state, action) => {
    switch (action.type) {
        case AT.SET_BOOT_STAGE:
            return { ...state, bootStage: action.payload };
        case AT.SET_UID:
            return { ...state, uid: action.payload };
        case AT.LOAD_DATA:
            {
                const loadedPlayer = { ...state.player, ...action.payload.player };
                return {
                    ...state,
                    player: loadedPlayer,
                    gameState: action.payload.gameState || 'idle',
                    enemy: action.payload.enemy || null,
                    grave: action.payload.grave || null,
                    currentEvent: action.payload.currentEvent || null,
                    quickSlots: sanitizeQuickSlots(action.payload.quickSlots, loadedPlayer.inv),
                    onboardingDismissed: action.payload.onboardingDismissed ?? state.onboardingDismissed,
                    bootStage: 'ready',
                    syncStatus: 'synced',
                    lastLoadedTimestamp: action.payload.lastActive?.toMillis 
                        ? action.payload.lastActive.toMillis() 
                        : (action.payload.lastActive || Date.now())
                };
            }
        case AT.SET_LIVE_CONFIG:
            return { ...state, liveConfig: { ...state.liveConfig, ...action.payload } };
        case AT.SET_LEADERBOARD:
            return { ...state, leaderboard: action.payload };

        case AT.SET_SYNC_STATUS:
            return { ...state, syncStatus: action.payload };
        case AT.SET_GAME_STATE:
            return { ...state, gameState: action.payload, syncStatus: 'syncing' };
        case AT.SET_PLAYER: {
            const nextPlayer = typeof action.payload === 'function' ? action.payload(state.player) : action.payload;
            const mergedPlayer = { ...state.player, ...nextPlayer };
            return {
                ...state,
                player: mergedPlayer,
                quickSlots: sanitizeQuickSlots(state.quickSlots, mergedPlayer.inv),
                syncStatus: 'syncing'
            };
        }
        case AT.SET_EVENT:
            return { ...state, currentEvent: action.payload, syncStatus: 'syncing' };
        case AT.SET_ENEMY:
            return { ...state, enemy: typeof action.payload === 'function' ? action.payload(state.enemy) : action.payload, syncStatus: 'syncing' };
        case AT.SET_GRAVE:
            return { ...state, grave: action.payload, syncStatus: 'syncing' };
        case AT.SET_AI_THINKING:
            return { ...state, isAiThinking: action.payload };
        case AT.SET_VISUAL_EFFECT:
            return { ...state, visualEffect: action.payload };
        case AT.SET_SIDE_TAB:
            return { ...state, sideTab: action.payload };
        case AT.SET_SHOP_ITEMS:
            return { ...state, shopItems: action.payload };
        case AT.RESET_RUNTIME_UI:
            return {
                ...state,
                gameState: 'idle',
                logs: [],
                enemy: null,
                currentEvent: null,
                shopItems: [],
                sideTab: 'inventory',
                isAiThinking: false,
                visualEffect: null,
                quickSlots: [null, null, null],
                postCombatResult: null,
                pendingRelics: null,
                runSummary: null,
                syncStatus: 'syncing'
            };
        case AT.ADD_LOG:
            return { ...state, logs: [...state.logs, action.payload].slice(-BALANCE.LOG_MAX_SIZE) };
        case AT.UPDATE_LOG:
            return {
                ...state,
                logs: state.logs.map(log => log.id === action.payload.id ? action.payload.log : log)
            };
        case AT.CLEAR_LOGS:
            return { ...state, logs: [], syncStatus: 'syncing' };
        case AT.SET_QUICK_SLOT: {
            const candidate = action.payload.item;
            if (candidate && !state.player.inv.some((item) => item.id === candidate.id)) {
                return state;
            }
            const next = [...state.quickSlots];
            next[action.payload.index] = candidate || null;
            return { ...state, quickSlots: next, syncStatus: 'syncing' };
        }
        case AT.SET_POST_COMBAT_RESULT:
            return { ...state, postCombatResult: action.payload };
        case AT.SET_ONBOARDING_DISMISSED:
            return { ...state, onboardingDismissed: true };
        case AT.RESET_GAME:
            return {
                ...INITIAL_STATE,
                grave: state.grave,
                bootStage: 'ready',
                uid: state.uid,
                syncStatus: 'syncing'
            };

        // ── v5.0: Run Summary ───────────────────────────────────────────────
        case 'SET_RUN_SUMMARY':
            return { ...state, runSummary: action.payload };

        // ── v5.0: True Ending ───────────────────────────────────────────────
        case AT.TRIGGER_TRUE_ENDING:
            return { ...state, gameState: 'true_ending', syncStatus: 'syncing' };

        // ── v5.0: 내러티브 이벤트 체인 ─────────────────────────────────────
        case AT.UPDATE_EVENT_CHAIN: {
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
        }

        // ── v4.0: Relic System ──────────────────────────────────────────────
        case AT.SET_PENDING_RELICS:
            return { ...state, pendingRelics: action.payload };
        case AT.ADD_RELIC: {
            const relic = action.payload;
            return {
                ...state,
                pendingRelics: null,
                player: {
                    ...state.player,
                    relics: [...(state.player.relics || []), relic],
                    stats: { ...state.player.stats, relicCount: (state.player.stats.relicCount || 0) + 1 },
                },
                syncStatus: 'syncing',
            };
        }
        case AT.DECLINE_RELIC:
            return { ...state, pendingRelics: null };

        // ── v4.0: Prestige / Ascension ─────────────────────────────────────
        case AT.ASCEND: {
            const { meta, newTitle } = action.payload;
            const prevTitles = state.player.titles || [];
            const freshPlayer = {
                ...INITIAL_STATE.player,
                name: state.player.name,
                gender: state.player.gender,
                meta,
                titles: [...new Set([...prevTitles, newTitle])],
                activeTitle: newTitle,
                stats: {
                    ...INITIAL_STATE.player.stats,
                    // 영구 누적 통계 유지
                    kills: state.player.stats.kills,
                    bossKills: state.player.stats.bossKills,
                    deaths: state.player.stats.deaths,
                    total_gold: state.player.stats.total_gold,
                    relicCount: state.player.stats.relicCount,
                    abyssFloor: state.player.stats.abyssFloor,
                    demonKingSlain: (state.player.stats.demonKingSlain || 0) + 1,
                    bountiesCompleted: state.player.stats.bountiesCompleted,
                    crafts: state.player.stats.crafts,
                    codex: state.player.stats.codex || INITIAL_STATE.player.stats.codex,
                    codexClaimed: state.player.stats.codexClaimed || [],
                },
                premiumCurrency: state.player.premiumCurrency || 0,
                seasonPass: state.player.seasonPass || INITIAL_STATE.player.seasonPass,
            };
            return {
                ...INITIAL_STATE,
                uid: state.uid,
                bootStage: 'ready',
                player: freshPlayer,
                syncStatus: 'syncing',
            };
        }

        // ── v4.0: Title System ─────────────────────────────────────────────
        case AT.UNLOCK_TITLES: {
            const newIds = action.payload; // string[]
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
        }

        // ── v4.0: Daily Protocol ───────────────────────────────────────────
        case AT.SET_DAILY_PROTOCOL:
            return {
                ...state,
                player: {
                    ...state.player,
                    stats: { ...state.player.stats, dailyProtocol: action.payload },
                },
                syncStatus: 'syncing',
            };
        case AT.UPDATE_DAILY_PROTOCOL: {
            const { type: dpType, amount = 1 } = action.payload;
            if (!state.player.stats?.dailyProtocol) return state;
            return {
                ...state,
                player: applyDailyProtocolProgress(state.player, dpType, amount),
                syncStatus: 'syncing',
            };
        }

        // ── v4.1: Codex System ───────────────────────────────────────────
        case AT.UPDATE_CODEX: {
            const { category, name } = action.payload; // category: 'weapons'|'armors'|..., name: item/monster name
            const codex = state.player.stats.codex || {};
            const cat = codex[category] || {};
            if (cat[name]) return state; // 이미 발견됨
            return {
                ...state,
                player: {
                    ...state.player,
                    stats: {
                        ...state.player.stats,
                        codex: {
                            ...codex,
                            [category]: { ...cat, [name]: { discovered: true, obtainedAt: Date.now() } },
                        },
                    },
                },
                syncStatus: 'syncing',
            };
        }

        case AT.SET_PREMIUM_CURRENCY:
            return {
                ...state,
                player: {
                    ...state.player,
                    premiumCurrency: action.payload,
                },
                syncStatus: 'syncing',
            };

        // ── v4.2: Season Pass ────────────────────────────────────────────
        case AT.ADD_SEASON_XP: {
            const sp = state.player.seasonPass || { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
            const newXp = sp.xp + (action.payload || 0);
            const newTier = Math.min(30, Math.floor(newXp / SEASON_TIER_XP));
            return {
                ...state,
                player: {
                    ...state.player,
                    seasonPass: { ...sp, xp: newXp, tier: newTier },
                },
                syncStatus: 'syncing',
            };
        }

        case AT.CLAIM_SEASON_REWARD: {
            const { tier: claimTier } = action.payload;
            const sp2 = state.player.seasonPass || { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
            if ((sp2.claimed || []).includes(claimTier)) return state;
            const rewardRow = SEASON_REWARDS.find(r => r.tier === claimTier);
            if (!rewardRow) return state;
            // Apply free track always; also apply premium track if player has premium
            const tracks = [rewardRow.free, sp2.isPremium ? rewardRow.premium : null].filter(Boolean);
            let nextPlayer = {
                ...state.player,
                seasonPass: { ...sp2, claimed: [...(sp2.claimed || []), claimTier] },
            };
            for (const track of tracks) {
                if (track.gold) nextPlayer = { ...nextPlayer, gold: (nextPlayer.gold || 0) + track.gold };
                if (track.premiumCurrency) nextPlayer = { ...nextPlayer, premiumCurrency: (nextPlayer.premiumCurrency || 0) + track.premiumCurrency };
                if (track.title) {
                    const tl = nextPlayer.titles || [];
                    if (!tl.includes(track.title)) nextPlayer = { ...nextPlayer, titles: [...tl, track.title] };
                }
                if (track.item) {
                    const itemTemplate = findItemByName(track.item);
                    if (itemTemplate) nextPlayer = { ...nextPlayer, inv: [...(nextPlayer.inv || []), makeItem(itemTemplate)] };
                }
            }
            return { ...state, player: nextPlayer, syncStatus: 'syncing' };
        }

        case AT.CLAIM_CODEX_REWARD: {
            const { milestoneId, reward } = action.payload;
            const prevClaimed = state.player.stats?.codexClaimed || [];
            if (prevClaimed.includes(milestoneId)) return state;
            const newClaimed = [...prevClaimed, milestoneId];
            let p = {
                ...state.player,
                stats: {
                    ...state.player.stats,
                    codexClaimed: newClaimed,
                    codexBonusAtk: (state.player.stats?.codexBonusAtk || 0) + (reward.atk || 0),
                    codexBonusDef: (state.player.stats?.codexBonusDef || 0) + (reward.def || 0),
                    codexBonusHp: (state.player.stats?.codexBonusHp || 0) + (reward.hp || 0),
                },
            };
            if (reward.gold) p = { ...p, gold: (p.gold || 0) + reward.gold };
            if (reward.premiumCurrency) p = { ...p, premiumCurrency: (p.premiumCurrency || 0) + reward.premiumCurrency };
            return { ...state, player: p, syncStatus: 'syncing' };
        }

        // ── v4.3: Item Enhancement ───────────────────────────────────────
        case AT.ENHANCE_ITEM: {
            const { itemId, success } = action.payload;
            // Update in inventory
            const newInv = state.player.inv.map(item => {
                if (item.id !== itemId) return item;
                if (!success) return item;
                return { ...item, enhance: (item.enhance || 0) + 1 };
            });
            // Update equipped item if matched
            const equip = state.player.equip;
            const newEquip = {};
            for (const slot of ['weapon', 'armor', 'offhand']) {
                if (equip[slot]?.id === itemId && success) {
                    newEquip[slot] = { ...equip[slot], enhance: (equip[slot].enhance || 0) + 1 };
                } else {
                    newEquip[slot] = equip[slot];
                }
            }
            return {
                ...state,
                player: { ...state.player, inv: newInv, equip: newEquip },
                syncStatus: 'syncing',
            };
        }

        // ── v4.3: Weekly Mission ─────────────────────────────────────────
        case AT.UPDATE_WEEKLY_PROTOCOL: {
            const { type: wpType, amount: wpAmount = 1 } = action.payload;
            const wp = state.player.weeklyProtocol || { kills: 0, explores: 0, bossKills: 0, lastResetWeek: 0, claimed: [] };
            const key = wpType === 'kills' ? 'kills' : wpType === 'explores' ? 'explores' : wpType === 'bossKills' ? 'bossKills' : null;
            if (!key) return state;
            return {
                ...state,
                player: {
                    ...state.player,
                    weeklyProtocol: { ...wp, [key]: (wp[key] || 0) + wpAmount },
                },
                syncStatus: 'syncing',
            };
        }
        case AT.CLAIM_WEEKLY_MISSION: {
            const { missionId, reward } = action.payload;
            const wp2 = state.player.weeklyProtocol || { kills: 0, explores: 0, bossKills: 0, lastResetWeek: 0, claimed: [] };
            if ((wp2.claimed || []).includes(missionId)) return state;
            let p2 = {
                ...state.player,
                weeklyProtocol: { ...wp2, claimed: [...(wp2.claimed || []), missionId] },
            };
            if (reward.gold) p2 = { ...p2, gold: (p2.gold || 0) + reward.gold };
            if (reward.premiumCurrency) p2 = { ...p2, premiumCurrency: (p2.premiumCurrency || 0) + reward.premiumCurrency };
            return { ...state, player: p2, syncStatus: 'syncing' };
        }

        // ── v4.3: Challenge Modifiers ────────────────────────────────────
        case AT.SET_CHALLENGE_MODIFIERS:
            return {
                ...state,
                player: { ...state.player, challengeModifiers: action.payload || [] },
                syncStatus: 'syncing',
            };

        // ── v4.3: Skill Branch ───────────────────────────────────────────
        case AT.CHOOSE_SKILL_BRANCH: {
            const { skillName, choice } = action.payload;
            return {
                ...state,
                player: {
                    ...state.player,
                    skillChoices: { ...(state.player.skillChoices || {}), [skillName]: choice },
                },
                syncStatus: 'syncing',
            };
        }

        case AT.SET_PUBLIC_GRAVES:
            return { ...state, publicGraves: action.payload };

        case AT.INVADE_GRAVE: {
            const { reward, uid: targetUid } = action.payload;
            const today = new Date().toDateString();
            const lastInvadeDate = state.player.stats?.lastInvadeDate;
            const currentCount = lastInvadeDate === today ? (state.player.stats?.dailyInvadeCount || 0) : 0;
            const nextInv = reward
                ? [...(state.player.inv || []), reward]
                : state.player.inv;
            return {
                ...state,
                player: {
                    ...state.player,
                    inv: nextInv,
                    stats: {
                        ...(state.player.stats || {}),
                        dailyInvadeCount: currentCount + 1,
                        lastInvadeDate: today,
                    },
                },
                publicGraves: state.publicGraves.filter((g) => g.uid !== targetUid),
                syncStatus: 'syncing',
            };
        }

        default:
            return state;
    }
};
