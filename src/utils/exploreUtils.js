/**
 * exploreUtils.js — explore() 로직 분리 모듈 (Phase 1-B)
 * useGameActions.js의 explore()에서 추출한 순수 함수들.
 */
import { DB } from '../data/db';
import { BALANCE, CONSTANTS } from '../data/constants';
import { RELICS, pickWeightedRelics, MAX_RELICS_PER_RUN } from '../data/relics';
import { BOSS_MONSTERS } from '../data/monsters';
import { AT } from '../reducers/actionTypes';
import { getDiscoveryOdds } from './explorationPacing';

// ─────────────────────────────────────────────────────────────────────────
// 0. ISO 주차 번호 계산 (월요일 기준)
// ─────────────────────────────────────────────────────────────────────────
const getISOWeekNumber = (date = new Date()) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

// ─────────────────────────────────────────────────────────────────────────
// 0.5. 주간 프로토콜 리셋
// ─────────────────────────────────────────────────────────────────────────
export const resetWeeklyProtocolIfNeeded = (player, dispatch) => {
    const currentWeek = getISOWeekNumber();
    const wp = player.weeklyProtocol;
    if (!wp || wp.lastResetWeek !== currentWeek) {
        dispatch({
            type: AT.SET_PLAYER,
            payload: p => ({
                ...p,
                weeklyProtocol: { kills: 0, explores: 0, bossKills: 0, lastResetWeek: currentWeek, claimed: [] },
            }),
        });
    }
};

// ─────────────────────────────────────────────────────────────────────────
// 1. 일일 프로토콜 리셋 & 카운트 업 (Phase 1-B)
// ─────────────────────────────────────────────────────────────────────────
export const resetDailyProtocolIfNeeded = (player, dispatch) => {
    const today = new Date().toISOString().slice(0, 10);
    const dp = player.stats?.dailyProtocol;
    if (!dp || dp.date !== today) {
        const lvl = player.level;
        const missions = [
            { id: 'kill_n',    type: 'kills',    goal: Math.max(10, lvl * 2),    reward: { essence: Math.floor(lvl * 5) }, progress: 0, done: false },
            { id: 'explore_n', type: 'explores', goal: 10,                        reward: { item: '중급 체력 물약' },          progress: 0, done: false },
            { id: 'gold_n',    type: 'goldSpend', goal: Math.max(300, lvl * 20), reward: { relicShard: 1 },                  progress: 0, done: false },
        ];
        dispatch({ type: AT.SET_DAILY_PROTOCOL, payload: { date: today, missions, relicShards: dp?.relicShards || 0 } });
    }
};

// ─────────────────────────────────────────────────────────────────────────
// 2. 탐색 이벤트 롤 — 아노말리, 열쇠 이벤트, 유물 발견 처리 (Phase 1-B)
// 반환값: 'event_triggered' | 'relic_found' | 'anomaly' | 'nothing' | null (계속 진행)
// ─────────────────────────────────────────────────────────────────────────
export const rollExplorationEvent = (player, mapData, playerRelics, { dispatch, addLog, getFullStats }) => {
    const discoveryOdds = getDiscoveryOdds(player, mapData);
    const hasKey = player.inv.some(i => i.name === '잊혀진 열쇠');
    if (hasKey && mapData.level >= 10 && Math.random() < discoveryOdds.keyEventChance) {
        dispatch({
            type: 'SET_PLAYER',
            payload: (p) => {
                const keyIdx = p.inv.findIndex(i => i.name === '잊혀진 열쇠');
                const newInv = [...p.inv];
                if (keyIdx > -1) newInv.splice(keyIdx, 1);
                return { ...p, inv: newInv, loc: '고대 보물고' };
            }
        });
        addLog('event', '💎 [잊혀진 열쇠]가 빛나며 숨겨진 <고대 보물고> 입구가 열립니다!');
        return 'key_event';
    }

    if (Math.random() < discoveryOdds.anomalyChance && player.loc !== '고대 보물고') {
        const anomalies = [
            { effect: 'poison',    desc: '자욱한 독안개가 밀려옵니다! (중독)' },
            { effect: 'mana_regen', desc: '강력한 마력의 폭풍이 붑니다. (MP 30% 회복)' },
            { effect: 'burn',      desc: '피부를 찌르는 산성비가 내립니다. (화상)' }
        ];
        const anomaly = anomalies[Math.floor(Math.random() * anomalies.length)];
        addLog('warning', `[기상 이변] ${anomaly.desc}`);
        if (anomaly.effect === 'mana_regen') {
            const stats = getFullStats();
            dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, mp: Math.min(stats.maxMp, p.mp + Math.floor(stats.maxMp * 0.3)) }) });
        } else {
            dispatch({ type: 'SET_PLAYER', payload: (p) => ({ ...p, status: [...new Set([...(p.status || []), anomaly.effect])]} ) });
        }
        return 'anomaly';
    }

    // 유물 발견
    if (playerRelics.length < MAX_RELICS_PER_RUN && Math.random() < discoveryOdds.relicChance) {
        const available = RELICS.filter(r => !playerRelics.some(pr => pr.id === r.id));
        if (available.length > 0) {
            const candidates = pickWeightedRelics(available, 3);
            dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
            addLog('event', '✨ [유물 발견] 고대의 기운이 느껴집니다! 유물을 선택하세요.');
            return 'relic_found';
        }
    }

    return 'nothing';
};

// ─────────────────────────────────────────────────────────────────────────
// 3. 몬스터 스탯 생성 + 접두어 부여 (Phase 1-B)
// ─────────────────────────────────────────────────────────────────────────
export const spawnEnemy = (mapData, player, playerRelics, { addLog }) => {
    const mapBossMonsters = Array.isArray(mapData.bossMonsters) ? mapData.bossMonsters : [];
    let encounterPool = [...(mapData.monsters || [])];

    // Sprint 18: 숨겨진 보스 해금 조건 체크
    const hiddenBossChecks = [
        // 시간의 파수꾼: 시간술사 직업 + Lv 40+ (공중 신전)
        { boss: '시간의 파수꾼', loc: '공중 신전', check: () => player.job === '시간술사' && (player.level || 1) >= 40 },
        // 원한의 용사: "최후의 영웅" 체인 3단계 완료 (지하 미궁)
        { boss: '원한의 용사', loc: '지하 미궁', check: () => (player.eventChainProgress?.last_hero || 0) >= 3 },
        // 공허의 군주: 무한 심연 100층 클리어 (금지된 도서관)
        { boss: '공허의 군주', loc: '금지된 도서관', check: () => (player.stats?.abyssFloor || 0) >= 100 },
    ];
    hiddenBossChecks.forEach(({ boss, loc, check }) => {
        if (mapData.name === loc && check() && !encounterPool.includes(boss)) {
            encounterPool.push(boss);
        }
    });

    const bossHunterRelic = playerRelics.find((r) => r.effect === 'boss_hunter');
    if (bossHunterRelic && mapBossMonsters.length > 0) {
        for (let i = 1; i < Math.max(1, Math.floor(bossHunterRelic.val.spawn || 1)); i += 1) {
            encounterPool = [...encounterPool, ...mapBossMonsters];
        }
    }

    // 구역 보스 (15% 확률 스폰) — mapData.boss가 문자열이고 이번 런 미처치 시 보장
    const areaBossName = typeof mapData.boss === 'string' ? mapData.boss : null;
    const spawnAreaBoss = areaBossName
        && !(player.stats?.areaBossDefeated?.[areaBossName])
        && Math.random() < 0.15;
    const baseName = spawnAreaBoss
        ? areaBossName
        : encounterPool[Math.floor(Math.random() * encounterPool.length)];
    let level = mapData.level || 1;
    let isInfinite = false;
    let depth = 0;

    if (level === 'infinite') {
        isInfinite = true;
        depth = player.stats?.abyssFloor || 1;
        level = 50 + Math.floor(depth / 2);
    }

    const mStats = {
        name: isInfinite ? `[${depth}층] ${baseName}` : baseName,
        baseName,
        hp: 120 + level * 30 + (depth * 25),
        maxHp: 120 + level * 30 + (depth * 25),
        atk: 15 + level * 4 + (depth * 3),
        exp: 10 + level * 10 + (depth * 4),
        gold: 10 + level * 2 + (depth * 3),
        pattern: {
            guardChance: Math.min(0.4, 0.12 + level * 0.01 + (depth * 0.005)),
            heavyChance: Math.min(0.45, 0.15 + level * 0.01 + (depth * 0.005))
        }
    };

    const profile = DB.MONSTERS?.[baseName];
    if (profile) {
        if (profile.hpMult)   { mStats.hp = Math.floor(mStats.hp * profile.hpMult); mStats.maxHp = Math.floor(mStats.maxHp * profile.hpMult); }
        if (profile.atkMult)  { mStats.atk = Math.floor(mStats.atk * profile.atkMult); }
        if (profile.expMult)  { mStats.exp = Math.floor(mStats.exp * profile.expMult); }
        if (profile.goldMult) { mStats.gold = Math.floor(mStats.gold * profile.goldMult); }
        if (profile.dropMod)  mStats.dropMod = profile.dropMod;
        if (profile.weakness) mStats.weakness = profile.weakness;
        if (profile.resistance) mStats.resistance = profile.resistance;
        if (profile.pattern)  mStats.pattern = { ...mStats.pattern, ...profile.pattern };
        if (profile.phase2)   mStats.phase2 = profile.phase2;
    }

    mStats.isBoss = Boolean(
        profile?.isBoss
        || mapBossMonsters.includes(baseName)
        || (mapData.boss && mapBossMonsters.length === 0)
        || BOSS_MONSTERS.includes(baseName)
    );

    // eliteOnly 챌린지: 모든 적에게 엘리트 접두어 강제 부여
    const forceElite = player.challengeModifiers?.includes('eliteOnly') && !mStats.isBoss;
    // 접두어 부여
    if ((forceElite || Math.random() < BALANCE.PREFIX_CHANCE) && CONSTANTS.MONSTER_PREFIXES) {
        const elitePrefixes = forceElite
            ? CONSTANTS.MONSTER_PREFIXES.filter((p) => p.isElite)
            : CONSTANTS.MONSTER_PREFIXES;
        const pool = elitePrefixes.length > 0 ? elitePrefixes : CONSTANTS.MONSTER_PREFIXES;
        const prefix = pool[Math.floor(Math.random() * pool.length)];
        mStats.name = `${prefix.name} ${baseName}`;
        mStats.hp = Math.floor(mStats.hp * prefix.mod);
        mStats.maxHp = Math.floor(mStats.maxHp * prefix.mod);
        mStats.atk = Math.floor(mStats.atk * prefix.mod);
        mStats.exp = Math.floor(mStats.exp * prefix.expMod);
        mStats.gold = Math.floor(mStats.gold * prefix.expMod);
        mStats.dropMod = (mStats.dropMod || 1.0) * (prefix.dropMod || 1.0);
        mStats.isElite = forceElite || !!prefix.isElite;

        // 엘리트 몬스터 페이즈: HP 50% 이하 시 패턴 강화 (보스 제외)
        if (mStats.isElite && !mStats.isBoss && !mStats.phase2) {
            mStats.phase2 = {
                name: `격노한 ${baseName}`,
                atkBonus: 0.25,
                pattern: {
                    guardChance: Math.max(0, (mStats.pattern?.guardChance || 0.12) - 0.05),
                    heavyChance: Math.min(0.6, (mStats.pattern?.heavyChance || 0.15) + 0.15),
                },
                log: `${baseName}이(가) 광폭화합니다! 공격이 거세집니다!`,
            };
        }

        if (mStats.isElite) addLog('critical', `⚠️ 엘리트 몬스터 [${prefix.name}] 개체가 등장했습니다!`);
        else if (prefix.name !== '일반적인') addLog('warning', `[${prefix.name}] 개체가 나타났습니다.`);
    }

    return { mStats, baseName };
};

// ─────────────────────────────────────────────────────────────────────────
// 4. 전투 시작 유물 효과 적용 (Phase 1-B)
// ─────────────────────────────────────────────────────────────────────────
export const applyBattleStartRelics = (player, playerRelics, fullStats, { addLog }) => {
    let combatStartPlayer = {
        ...player,
        combatFlags: {
            comboCount: 0,
            deathSaveUsed: false,
            voidHeartUsed: Boolean(player.combatFlags?.voidHeartUsed),
            voidHeartArmed: Boolean(player.combatFlags?.voidHeartArmed),
        }
    };

    const startHealRelic = playerRelics.find((r) => r.effect === 'battle_start_heal');
    if (startHealRelic) {
        const heal = Math.max(1, Math.floor((fullStats.maxHp || player.maxHp || 1) * startHealRelic.val));
        combatStartPlayer.hp = Math.min(fullStats.maxHp || player.maxHp, (combatStartPlayer.hp || 0) + heal);
        addLog('heal', `[재생 코어] 전투 시작 회복 +${heal} HP`);
    }

    const cursedPowerRelic = playerRelics.find((r) => r.effect === 'cursed_power');
    if (cursedPowerRelic) {
        const selfDamage = Math.max(1, Math.floor((fullStats.maxHp || player.maxHp || 1) * cursedPowerRelic.val.hp_cost));
        combatStartPlayer.hp = Math.max(1, (combatStartPlayer.hp || 1) - selfDamage);
        addLog('warning', `[저주받은 반지] 전투 시작 대가 -${selfDamage} HP`);
    }

    // 유물: 혼돈의 심장 (chaos_relic) — 전투 시작 시 랜덤 효과 발동
    const chaosRelic = playerRelics.find((r) => r.effect === 'chaos_relic');
    if (chaosRelic) {
        const roll = Math.floor(Math.random() * 3);
        if (roll === 0) {
            const heal = Math.max(1, Math.floor((fullStats.maxHp || player.maxHp || 1) * 0.1));
            combatStartPlayer.hp = Math.min(fullStats.maxHp || player.maxHp, (combatStartPlayer.hp || 0) + heal);
            addLog('heal', `[혼돈의 심장] 혼돈의 기운 — HP +${heal} 회복!`);
        } else if (roll === 1) {
            const existing = combatStartPlayer.tempBuff || { atk: 0, def: 0, turn: 0, name: null };
            combatStartPlayer.tempBuff = { ...existing, atk: existing.atk + 0.25, turn: Math.max(existing.turn || 0, 3), name: '혼돈의 심장' };
            addLog('event', `[혼돈의 심장] 혼돈의 기운 — ATK +25% (3턴)!`);
        } else {
            const existing = combatStartPlayer.tempBuff || { atk: 0, def: 0, turn: 0, name: null };
            combatStartPlayer.tempBuff = { ...existing, def: existing.def + 0.25, turn: Math.max(existing.turn || 0, 3), name: '혼돈의 심장' };
            addLog('event', `[혼돈의 심장] 혼돈의 기운 — DEF +25% (3턴)!`);
        }
    }

    const chaosBuffRelic = playerRelics.find((r) => r.effect === 'chaos_buff');
    if (chaosBuffRelic) {
        const existingBuff = { atk: 0, def: 0, turn: 0, name: null, ...(combatStartPlayer.tempBuff || {}) };
        const rollAtk = Math.random() < 0.5;
        const baseAtk = existingBuff.name === '혼돈의 보석' ? 0 : existingBuff.atk;
        const baseDef = existingBuff.name === '혼돈의 보석' ? 0 : existingBuff.def;
        combatStartPlayer.tempBuff = {
            atk: baseAtk + (rollAtk ? chaosBuffRelic.val : 0),
            def: baseDef + (rollAtk ? 0 : chaosBuffRelic.val),
            turn: Math.max(existingBuff.turn || 0, 3),
            name: '혼돈의 보석'
        };
        addLog('event', `[혼돈의 보석] ${rollAtk ? 'ATK' : 'DEF'} +${Math.round(chaosBuffRelic.val * 100)}% 버프`);
    }

    return combatStartPlayer;
};

// ─────────────────────────────────────────────────────────────────────────
// 4.5. 발견 체인 체크 — 지역 조합 방문 시 보상 (Discovery Chains)
// ─────────────────────────────────────────────────────────────────────────
export const checkDiscoveryChains = (player, loc, { dispatch, addLog }) => {
    const chains = BALANCE.DISCOVERY_CHAINS;
    if (!chains) return;
    const visited = new Set([...(player.stats?.visitedMaps || []), loc]);
    const completed = player.stats?.discoveryChains || [];

    chains.forEach(chain => {
        if (completed.includes(chain.id)) return;
        if (!chain.locations.every(l => visited.has(l))) return;

        // 체인 달성!
        const rewardParts = [];
        if (chain.reward.gold) rewardParts.push(`${chain.reward.gold}G`);
        if (chain.reward.exp) rewardParts.push(`${chain.reward.exp} EXP`);
        if (chain.reward.item) rewardParts.push(chain.reward.item);
        if (chain.reward.premiumCurrency) rewardParts.push(`${chain.reward.premiumCurrency} 크리스탈`);

        addLog('event', `🔍 ${chain.desc}`);
        addLog('success', `🏆 [발견 체인 완료] ${chain.label}! 보상: ${rewardParts.join(', ')}`);

        dispatch({
            type: AT.SET_PLAYER,
            payload: p => {
                const updated = { ...p };
                updated.gold = (updated.gold || 0) + (chain.reward.gold || 0);
                updated.exp = (updated.exp || 0) + (chain.reward.exp || 0);
                if (chain.reward.premiumCurrency) {
                    updated.premiumCurrency = (updated.premiumCurrency || 0) + chain.reward.premiumCurrency;
                }
                if (chain.reward.item) {
                    const itemData = DB.ITEMS?.allItems?.find(i => i.name === chain.reward.item);
                    if (itemData && (updated.inv || []).length < (BALANCE.INV_MAX_SIZE || 20)) {
                        updated.inv = [...(updated.inv || []), { ...itemData, id: `disc_${Date.now()}` }];
                    }
                }
                updated.stats = {
                    ...updated.stats,
                    discoveryChains: [...(updated.stats?.discoveryChains || []), chain.id],
                };
                return updated;
            },
        });
    });
};

// ─────────────────────────────────────────────────────────────────────────
// 5. 지역 최초 방문 보상 (Phase 2-C)
// 처음 방문하는 지역에 고정 보상을 지급합니다.
// ─────────────────────────────────────────────────────────────────────────
const FIRST_VISIT_REWARDS = {
    '고요한 숲':    { gold: 100,  exp: 50,  msg: '🌲 [첫 방문] 고요한 숲 탐험 완료! 보상 +100G, +50 EXP' },
    '서쪽 평원':   { gold: 150,  exp: 60,  msg: '🌾 [첫 방문] 서쪽 평원 탐험! +150G, +60 EXP' },
    '호수의 신전': { gold: 200,  exp: 100, msg: '🌊 [첫 방문] 호수의 신전 발견! +200G, +100 EXP' },
    '잊혀진 폐허': { gold: 200,  exp: 120, msg: '🏚️ [첫 방문] 잊혀진 폐허 진입! +200G, +120 EXP' },
    '버려진 광산': { gold: 250,  exp: 150, msg: '⛏️ [첫 방문] 버려진 광산 탐색 시작! +250G, +150 EXP' },
    '어둠의 동굴': { gold: 300,  exp: 200, msg: '🦇 [첫 방문] 어둠의 동굴 진입! +300G, +200 EXP' },
    '화염의 협곡': { gold: 400,  exp: 300, msg: '🔥 [첫 방문] 화염의 협곡! +400G, +300 EXP' },
    '용의 둥지':   { gold: 500,  exp: 400, msg: '🐉 [첫 방문] 용의 둥지 발견! +500G, +400 EXP' },
    '사막 오아시스':{ gold: 350, exp: 250, msg: '🌵 [첫 방문] 사막 오아시스! +350G, +250 EXP' },
    '피라미드':    { gold: 450,  exp: 350, msg: '🏺 [첫 방문] 피라미드 진입! +450G, +350 EXP' },
    '얼음 성채':   { gold: 400,  exp: 300, msg: '❄️ [첫 방문] 얼음 성채 탐험! +400G, +300 EXP' },
    '빙하 심연':   { gold: 600,  exp: 500, msg: '🌨️ [첫 방문] 빙하 심연 발견! +600G, +500 EXP' },
    '북부 요새':   { gold: 350,  exp: 280, msg: '🏰 [첫 방문] 북부 요새 도달! +350G, +280 EXP' },
    '기계 폐도':   { gold: 500,  exp: 400, msg: '⚙️ [첫 방문] 기계 폐도 탐색! +500G, +400 EXP' },
    '천공 정원':   { gold: 600,  exp: 500, msg: '☁️ [첫 방문] 천공 정원 진입! +600G, +500 EXP' },
    '심해 회랑':   { gold: 700,  exp: 600, msg: '🌊 [첫 방문] 심해 회랑 발견! +700G, +600 EXP' },
    '에테르 관문': { gold: 800,  exp: 700, msg: '⚡ [첫 방문] 에테르 관문 개방! +800G, +700 EXP' },
    '암흑 성':     { gold: 500,  exp: 400, msg: '🏯 [첫 방문] 암흑 성 침투! +500G, +400 EXP' },
    '마왕성':      { gold: 1000, exp: 800, msg: '👑 [첫 방문] 마왕성 도달! 운명이 기다립니다. +1000G, +800 EXP' },
    '혼돈의 심연': { gold: 500,  exp: 500, msg: '🌀 [첫 방문] 혼돈의 심연 진입! 끝없는 싸움이 시작됩니다. +500G, +500 EXP' },
    '고대 보물고': { gold: 300,  exp: 200, msg: '💎 [첫 방문] 고대 보물고 발견! +300G, +200 EXP' },
};

/**
 * 지역 첫 방문 여부를 확인하고, 해당되면 보상 객체를 반환합니다.
 * @returns {{ gold: number, exp: number, msg: string } | null}
 */
export const getFirstVisitReward = (loc, player) => {
    const visited = player.stats?.visitedMaps || [];
    if (visited.includes(loc)) return null;
    return FIRST_VISIT_REWARDS[loc] || null;
};
