// cycle 323: unused Monster type import 제거 — exploreUtils 어디에서도 Monster 참조 0건.
import type { GameMap, Relic } from '../types/index.js';
import type { Player } from '../types/index.js';
/**
 * exploreUtils.js — explore() 로직 분리 모듈 (Phase 1-B)
 * useGameActions.js의 explore()에서 추출한 순수 함수들.
 */
import { DB } from '../data/db.js';
import { BALANCE, CONSTANTS } from '../data/constants.js';
import { RELICS, pickWeightedRelics } from '../data/relics.js';
import { getPrestigeUnlocks } from '../systems/prestigeUnlocks';
import { BOSS_MONSTERS } from '../data/monsters.js';
import { AT } from '../reducers/actionTypes.js';
import { GS } from '../reducers/gameStates.js';
import { MSG } from '../data/messages.js';
import { getDiscoveryOdds } from './explorationPacing.js';
import { soundManager } from '../systems/SoundManager.js';
import { findItemByName } from './gameUtils.js';
import { applyDynamicDifficulty } from '../systems/DifficultyManager';
import { getBossSignatureDrops } from './bossSignatureHint';
import { getSignaturePityMultiplier } from './signaturePity';

// ─────────────────────────────────────────────────────────────────────────
// 0. ISO 주차 번호 계산 (월요일 기준)
// ─────────────────────────────────────────────────────────────────────────
// cycle 618: date default new Date() 제거 — explicit default-elimination
//   pattern (cycle 608-617 lens 정착, 10번째 적용 — double-digit milestone).
//   resetWeeklyProtocolIfNeeded:31 caller에 new Date() 명시 추가 후 default
//   unreachable.
const getISOWeekNumber = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((((d as any) - (yearStart as any)) / 86400000) + 1) / 7);
};

// ─────────────────────────────────────────────────────────────────────────
// 0.5. 주간 프로토콜 리셋
// ─────────────────────────────────────────────────────────────────────────
export const resetWeeklyProtocolIfNeeded = (player: Player, dispatch: any) => {
    // cycle 618: new Date() 명시 추가 — explicit default-elimination cascade.
    const currentWeek = getISOWeekNumber(new Date());
    const wp = player.weeklyProtocol;
    if (!wp || wp.lastResetWeek !== currentWeek) {
        dispatch({
            type: AT.SET_PLAYER,
            payload: (p: any) => ({
                ...p,
                weeklyProtocol: { kills: 0, explores: 0, bossKills: 0, lastResetWeek: currentWeek, claimed: [] },
            }),
        });
    }
};

// ─────────────────────────────────────────────────────────────────────────
// 1. 일일 프로토콜 리셋 & 카운트 업 (Phase 1-B)
// ─────────────────────────────────────────────────────────────────────────
export const resetDailyProtocolIfNeeded = (player: Player, dispatch: any) => {
    const today = new Date().toISOString().slice(0, 10);
    const dp = player.stats?.dailyProtocol;
    if (!dp || dp.date !== today) {
        const lvl = player.level || 1;
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
export const rollExplorationEvent = (player: Player, mapData: GameMap, playerRelics: Relic[], { dispatch, addLog, getFullStats }: any) => {
    const discoveryOdds = getDiscoveryOdds(player, mapData);
    const hasKey = (player.inv || []).some((i: any) => i.name === '잊혀진 열쇠');
    if (hasKey && (typeof mapData.level === 'number' && mapData.level >= 10) && Math.random() < discoveryOdds.keyEventChance) {
        dispatch({
            type: AT.SET_PLAYER,
            payload: (p: any) => {
                const keyIdx = p.inv.findIndex((i: any) => i.name === '잊혀진 열쇠');
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
            dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({ ...p, mp: Math.min(stats.maxMp, p.mp + Math.floor(stats.maxMp * 0.3)) }) });
        } else {
            dispatch({ type: AT.SET_PLAYER, payload: (p: any) => ({ ...p, status: [...new Set([...(p.status || []), anomaly.effect])]} ) });
        }
        return 'anomaly';
    }

    // 유물 발견 — PR #8: 프레스티지 rank≥2면 보유 한도 +1(6) · 선택지 4지선다.
    const relicUnlocks = getPrestigeUnlocks(player.meta?.prestigeRank);
    if (playerRelics.length < relicUnlocks.maxRelics && Math.random() < discoveryOdds.relicChance) {
        const available = RELICS.filter((r: any) => !playerRelics.some((pr: any) => pr.id === r.id));
        if (available.length > 0) {
            const candidates = pickWeightedRelics(available, relicUnlocks.relicChoices, { owned: playerRelics });
            dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
            addLog('event', '✨ [유물 발견] 고대의 기운이 느껴집니다! 유물을 선택하세요.');
            return 'relic_found';
        }
    }

    return 'nothing';
};

// ─────────────────────────────────────────────────────────────────────────
// 3. 몬스터 스탯 생성 + 접두어 부여 (Phase 1-B)
// 2026-07 — 원정 보스 접근 게이지: 구역 보스의 15% 순수 랜덤 강제 조우를 제거하고
//   (bossGauge.ts) 게이지 만충 후 "도전" 선택 시에만 forceAreaBoss:true로 결정론적
//   스폰한다. options 미전달 시 기존 동작(구역 보스는 encounterPool에서 제외, 일반
//   풀에서만 스폰)과 동일 — 하위 호환.
// ─────────────────────────────────────────────────────────────────────────
export const spawnEnemy = (mapData: GameMap, player: Player, playerRelics: Relic[], { addLog }: any, options: { forceAreaBoss?: boolean } = {}) => {
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
        // PR #11: 에테르 군주 — 프레스티지 rank≥10 "에테르 초월" 해금 (에테르 관문)
        { boss: '에테르 군주', loc: '에테르 관문', check: () => (player.meta?.prestigeRank || 0) >= 10 },
    ];
    // cycle 71: mapData.name은 MAPS dict에 저장될 때 설정되지 않으므로 항상 undefined.
    // hidden boss spawn이 영원히 트리거되지 않던 버그 수정 — player.loc로 비교.
    const currentLoc = player.loc;
    hiddenBossChecks.forEach(({ boss, loc, check }: any) => {
        if (currentLoc === loc && check() && !encounterPool.includes(boss)) {
            encounterPool.push(boss);
        }
    });

    const bossHunterRelic = playerRelics.find((r: any) => r.effect === 'boss_hunter');
    if (bossHunterRelic && mapBossMonsters.length > 0) {
        for (let i = 1; i < Math.max(1, Math.floor(bossHunterRelic.val.spawn || 1)); i += 1) {
            encounterPool = [...encounterPool, ...mapBossMonsters];
        }
    }

    // 구역 보스 — 2026-07: 15% 순수 랜덤 강제 조우 제거, 원정 보스 접근 게이지
    //   (bossGauge.ts) 만충 후 "도전" 선택 시에만 options.forceAreaBoss:true로
    //   결정론적 스폰 (exploreActions.ts/eventActions.ts가 이 함수를 재호출).
    const areaBossName: string | null = typeof mapData.boss === 'string' ? mapData.boss : null;
    const spawnAreaBoss = areaBossName !== null
        && !(player.stats?.areaBossDefeated?.[areaBossName])
        && Boolean(options.forceAreaBoss);
    const baseName: string = (spawnAreaBoss && areaBossName !== null)
        ? areaBossName
        : encounterPool[Math.floor(Math.random() * encounterPool.length)];
    // 2026-07 타입화: GameMap.level은 number | number[] | 'infinite'. 이 함수의 스폰
    // 스탯 계산은 항상 단일 숫자 레벨을 가정했던 기존 동작 그대로 유지 — 시즌 전용
    // 범위형([min, max]) 맵은 도달 시 최솟값으로 취급 (array 케이스가 원래도 산술에
    // 쓰이지 않던 latent 케이스라 동작 변경 없음).
    const rawLevel = mapData.level;
    let level: number | 'infinite' = typeof rawLevel === 'number'
        ? rawLevel
        : Array.isArray(rawLevel) ? (rawLevel[0] ?? 1) : (rawLevel ?? 1);
    let isInfinite = false;
    let depth = 0;

    if (level === 'infinite') {
        isInfinite = true;
        depth = player.stats?.abyssFloor || 1;
        level = 50 + Math.floor(depth / 2);
    }

    // slice 19: HP 곡선 120+30L → BALANCE.MONSTER_HP_BASE(70)+L×32 — 초반 전투
    //   템포 가속 (Lv1 -32%, Lv50 +3%). 골드 base 10 → 16 (초반 휴식 경제).
    //   ATK/EXP 곡선은 불변 (quest pacing 가드 보존).
    const mStats: any = {
        name: isInfinite ? `[${depth}층] ${baseName}` : baseName,
        baseName,
        hp: BALANCE.MONSTER_HP_BASE + level * BALANCE.MONSTER_HP_PER_LEVEL + (depth * 25),
        maxHp: BALANCE.MONSTER_HP_BASE + level * BALANCE.MONSTER_HP_PER_LEVEL + (depth * 25),
        atk: 15 + level * 4 + (depth * 3),
        // PR #3: 적 DEF 곡선 — 이전엔 def 필드 자체가 없어 enemy.def는 항상 undefined였고
        //   calculateDamage도 무시 → 적 방어력 완전 dead. 이제 레벨 비례 def + 비율 경감(K=100)
        //   으로 중후반 firmer. profile.defMult로 탱키 아키타입 가중(아래 적용).
        def: Math.floor(BALANCE.MONSTER_DEF_BASE + level * BALANCE.MONSTER_DEF_PER_LEVEL + depth * BALANCE.MONSTER_DEF_PER_DEPTH),
        exp: 10 + level * 10 + (depth * 4),
        gold: BALANCE.MONSTER_GOLD_BASE + level * 2 + (depth * 3),
        pattern: {
            guardChance: Math.min(0.4, 0.12 + level * 0.01 + (depth * 0.005)),
            heavyChance: Math.min(0.45, 0.15 + level * 0.01 + (depth * 0.005))
        }
    };

    const profile = DB.MONSTERS?.[baseName];
    if (profile) {
        if (profile.hpMult)   { mStats.hp = Math.floor(mStats.hp * profile.hpMult); mStats.maxHp = Math.floor(mStats.maxHp * profile.hpMult); }
        if (profile.atkMult)  { mStats.atk = Math.floor(mStats.atk * profile.atkMult); }
        if (profile.defMult)  { mStats.def = Math.floor(mStats.def * profile.defMult); }
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
    // A-4 (B+ 2026-06): 초반 정예 — Lv ≤ cap에서 낮은 확률로 "정예" 개체 스폰.
    //   완전 엘리트(1.8~2.5x)는 Lv1에 불공정하므로 전용 완화 배율(EARLY_ELITE_MULT)로
    //   TTK를 빠듯하게(영리하면 승리) → "방심하면 죽는" 첫 위협. 도망·첫 죽음 메타가 안전망.
    const earlyElite = !mStats.isBoss && !forceElite
        && typeof level === 'number' && level <= BALANCE.EARLY_ELITE_LEVEL_CAP
        && Math.random() < BALANCE.EARLY_ELITE_CHANCE;
    // PR #8: 프레스티지 rank≥3 해금 — 엘리트 출현 확률 +25%. forceElite처럼 엘리트
    //   접두어를 강제한다(고승천 플레이어에게 더 잦은 정예 위협 = 광고된 "심연의 메아리").
    const prestigeElite = !mStats.isBoss && !forceElite && !earlyElite
        && Math.random() < getPrestigeUnlocks(player.meta?.prestigeRank).eliteChanceBonus;
    // 접두어 부여
    if (forceElite || earlyElite || prestigeElite || (Math.random() < BALANCE.PREFIX_CHANCE && CONSTANTS.MONSTER_PREFIXES)) {
        const prefix = earlyElite
            ? { name: '정예', mod: BALANCE.EARLY_ELITE_MULT, expMod: BALANCE.EARLY_ELITE_MULT, dropMod: 2.0, isElite: true }
            : (() => {
                const elitePrefixes = (forceElite || prestigeElite)
                    ? CONSTANTS.MONSTER_PREFIXES.filter((p: any) => p.isElite)
                    : CONSTANTS.MONSTER_PREFIXES;
                const pool = elitePrefixes.length > 0 ? elitePrefixes : CONSTANTS.MONSTER_PREFIXES;
                return pool[Math.floor(Math.random() * pool.length)];
            })();
        mStats.name = `${prefix.name} ${baseName}`;
        mStats.hp = Math.floor(mStats.hp * prefix.mod);
        mStats.maxHp = Math.floor(mStats.maxHp * prefix.mod);
        mStats.atk = Math.floor(mStats.atk * prefix.mod);
        mStats.exp = Math.floor(mStats.exp * prefix.expMod);
        mStats.gold = Math.floor(mStats.gold * prefix.expMod);
        mStats.dropMod = (mStats.dropMod || 1.0) * (prefix.dropMod || 1.0);
        mStats.isElite = forceElite || prestigeElite || !!prefix.isElite;

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

    // PR #5: 프레스티지(환생) 적 난이도 스케일링 — 최종 1회(profile/prefix 적용 후).
    //   기존 프레스티지는 플레이어 스탯만 올려 매 승천이 쉬워졌다(anti-로그라이크).
    //   rank당 적 스탯/보상을 곱연산 상향해 "깊을수록 어려움"을 회복. rank0은 무변경.
    const prestigeRank = player.meta?.prestigeRank || 0;
    if (prestigeRank > 0) {
        const statMult = 1 + prestigeRank * BALANCE.PRESTIGE_ENEMY_STAT_PER_RANK;
        const rewardMult = 1 + prestigeRank * BALANCE.PRESTIGE_ENEMY_REWARD_PER_RANK;
        mStats.hp = Math.floor(mStats.hp * statMult);
        mStats.maxHp = Math.floor(mStats.maxHp * statMult);
        mStats.atk = Math.floor(mStats.atk * statMult);
        mStats.def = Math.floor(mStats.def * statMult);
        mStats.exp = Math.floor(mStats.exp * rewardMult);
        mStats.gold = Math.floor(mStats.gold * rewardMult);
    }

    return { mStats, baseName };
};

// ─────────────────────────────────────────────────────────────────────────
// 4. 전투 시작 유물 효과 적용 (Phase 1-B)
// ─────────────────────────────────────────────────────────────────────────
export const applyBattleStartRelics = (player: Player, playerRelics: Relic[], fullStats: any, { addLog }: any) => {
    const combatStartPlayer: any = {
        ...player,
        combatFlags: {
            comboCount: 0,
            deathSaveUsed: false,
            voidHeartUsed: Boolean(player.combatFlags?.voidHeartUsed),
            voidHeartArmed: Boolean(player.combatFlags?.voidHeartArmed),
            // cycle 158: 'kill_stack_atk' (허공의 왕좌) — 전투 내 ATK 누적은 매 전투 시작 시 0으로 리셋.
            killStackAtkBonus: 0,
            // cycle 158: 'phoenix_revive' (cycle 157) — 부활 1회는 매 전투마다 새로 사용 가능.
            phoenixUsed: false,
            // cycle 159: 'entropy_tick' / 'entropy_brand' — turnCount는 매 전투 시작 시 0으로 리셋.
            turnCount: 0,
            // cycle 163: 'cooldown_reduce.firstFree' (시간 군주의 왕관) — 매 전투 첫 스킬 무료 가능.
            firstSkillUsed: false,
        }
    };

    // cycle 158: 'battle_start_buff' (전쟁의 북) — 전투 시작 시 ATK +val.atk (val.turns 턴).
    //   tempBuff.atk는 multiplier (1 + atk) 로 statsCalculator에서 적용.
    const startBuffRelic = playerRelics.find((r: any) => r.effect === 'battle_start_buff');
    if (startBuffRelic) {
        const atkBonus = startBuffRelic.val?.atk || 0;
        const turns = startBuffRelic.val?.turns || 1;
        combatStartPlayer.tempBuff = {
            atk: atkBonus,
            def: 0,
            turn: turns,
            name: 'battle_start_buff',
        };
        addLog('event', `[전쟁의 북] 전투 시작 ATK +${Math.round(atkBonus * 100)}% (${turns}턴)`);
    }

    const startHealRelic = playerRelics.find((r: any) => r.effect === 'battle_start_heal');
    if (startHealRelic) {
        const heal = Math.max(1, Math.floor((fullStats.maxHp || player.maxHp || 1) * startHealRelic.val));
        combatStartPlayer.hp = Math.min(fullStats.maxHp || player.maxHp, (combatStartPlayer.hp || 0) + heal);
        addLog('heal', `[재생 코어] 전투 시작 회복 +${heal} HP`);
    }

    const cursedPowerRelic = playerRelics.find((r: any) => r.effect === 'cursed_power');
    if (cursedPowerRelic) {
        const selfDamage = Math.max(1, Math.floor((fullStats.maxHp || player.maxHp || 1) * cursedPowerRelic.val.hp_cost));
        combatStartPlayer.hp = Math.max(1, (combatStartPlayer.hp || 1) - selfDamage);
        addLog('warning', `[저주받은 반지] 전투 시작 대가 -${selfDamage} HP`);
    }

    // 유물: 혼돈의 심장 (chaos_relic) — 전투 시작 시 랜덤 효과 발동
    const chaosRelic = playerRelics.find((r: any) => r.effect === 'chaos_relic');
    if (chaosRelic) {
        const roll = Math.floor(Math.random() * 3);
        if (roll === 0) {
            const heal = Math.max(1, Math.floor((fullStats.maxHp || player.maxHp || 1) * 0.1));
            combatStartPlayer.hp = Math.min(fullStats.maxHp || player.maxHp, (combatStartPlayer.hp || 0) + heal);
            addLog('heal', `[혼돈의 심장] 혼돈의 기운 — HP +${heal} 회복!`);
        } else if (roll === 1) {
            const existing = combatStartPlayer.tempBuff || { atk: 0, def: 0, turn: 0, name: null };
            combatStartPlayer.tempBuff = { ...existing, atk: (existing.atk ?? 0) + 0.25, turn: Math.max(existing.turn || 0, 3), name: '혼돈의 심장' };
            addLog('event', `[혼돈의 심장] 혼돈의 기운 — ATK +25% (3턴)!`);
        } else {
            const existing = combatStartPlayer.tempBuff || { atk: 0, def: 0, turn: 0, name: null };
            combatStartPlayer.tempBuff = { ...existing, def: (existing.def ?? 0) + 0.25, turn: Math.max(existing.turn || 0, 3), name: '혼돈의 심장' };
            addLog('event', `[혼돈의 심장] 혼돈의 기운 — DEF +25% (3턴)!`);
        }
    }

    const chaosBuffRelic = playerRelics.find((r: any) => r.effect === 'chaos_buff');
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
// 4.2. quiet 롤 → 유물 보장 → 전투 스폰 (AI 이벤트 제외 파이프)
//   exploreActions.ts의 explore()가 AI 이벤트 롤 실패 후 호출하는 나머지 파이프이자,
//   탐험 스카우팅(2026-07) "짙은 안개" 카드가 그대로 재사용하는 공유 지점이다. AI_SERVICE
//   (firebase 의존)를 참조하지 않도록 exploreUtils.ts에 둔다 — eventActions.ts 단위 테스트가
//   firebase import 체인 없이 이 함수를 로드할 수 있어야 하기 때문 (campfire-node.test.js와
//   동일한 제약).
//   2026-07 — 원정 보스 접근 게이지: commitExploreOutcome에 mapData를 전달해 게이지를
//   누적하지만, "짙은 안개"(스카우팅 unknown 카드) 경로로 재호출될 때는 이미 스카우팅
//   카드가 뜬 시점(같은 explore() 턴)에 게이지가 1회 누적됐으므로 중복 누적을 막기 위해
//   deps.skipBossGaugeAdvance:true를 전달받으면 mapData를 넘기지 않는다.
// ─────────────────────────────────────────────────────────────────────────
export const runQuietRollAndCombat = (player: Player, mapData: GameMap, { dispatch, addLog, addStoryLog, getFullStats, commitExploreOutcome, skipBossGaugeAdvance }: any) => {
    const playerRelics = player.relics || [];
    const quietChance = getDiscoveryOdds(player, mapData).quietChance;
    const gaugeMapData = skipBossGaugeAdvance ? null : mapData;

    if (Math.random() < quietChance) {
        const quietResult = rollExplorationEvent(player, mapData, playerRelics, { dispatch, addLog, getFullStats });
        if (quietResult !== 'nothing') {
            commitExploreOutcome(quietResult, null, gaugeMapData);
            return;
        }
        commitExploreOutcome('nothing', null, gaugeMapData);
        addLog('info', MSG.EXPLORE_QUIET);
        return;
    }

    // 전투 직전 유물 발견 기회
    const firstRelicPity = playerRelics.length === 0
        && (player.stats?.exploreState?.sinceRelic || 0) >= BALANCE.FIRST_RELIC_PITY_EXPLORES;
    const relicUnlocks = getPrestigeUnlocks(player.meta?.prestigeRank);
    if (playerRelics.length < relicUnlocks.maxRelics
        && (firstRelicPity || Math.random() < BALANCE.RELIC_FIND_CHANCE * 0.5)) {
        const available = RELICS.filter((r: any) => !playerRelics.some((pr: any) => pr.id === r.id));
        if (available.length > 0) {
            commitExploreOutcome('relic_found', null, gaugeMapData);
            const candidates = pickWeightedRelics(available, relicUnlocks.relicChoices, { owned: playerRelics });
            dispatch({ type: AT.SET_PENDING_RELICS, payload: candidates });
            addLog('event', MSG.EXPLORE_RELIC_FOUND);
            return;
        }
    }

    // 몬스터 생성
    const { mStats: rawStats, baseName } = spawnEnemy(mapData, player, playerRelics, { addLog });
    let { mStats } = applyDynamicDifficulty(rawStats, player, addLog);

    // 무한 심연 모드
    if (mapData.level === 'infinite') {
        const floor = (player.stats?.abyssFloor || 0) + 1;
        const abyssScale = 1 + (floor - 1) * 0.08;
        mStats = {
            ...mStats,
            hp: Math.floor(mStats.hp * abyssScale),
            maxHp: Math.floor(mStats.maxHp * abyssScale),
            atk: Math.floor(mStats.atk * abyssScale),
            exp: Math.floor(mStats.exp * (1 + (floor - 1) * 0.12)),
            gold: Math.floor(mStats.gold * (1 + (floor - 1) * 0.1)),
            level: 50 + floor,
        };
        if (BALANCE.ABYSS_BOSS_FLOORS.includes(floor)) {
            const bossName = BALANCE.ABYSS_BOSS_NAMES[floor] || '혼돈의 수호자';
            const bossProfile = DB.MONSTERS?.[bossName];
            mStats = {
                ...mStats,
                name: `[${floor}층 보스] ${bossName}`,
                baseName: bossName,
                isBoss: true,
                hp: Math.floor(mStats.hp * (bossProfile?.hpMult || 2.0)),
                maxHp: Math.floor(mStats.maxHp * (bossProfile?.hpMult || 2.0)),
                atk: Math.floor(mStats.atk * (bossProfile?.atkMult || 1.5)),
                exp: Math.floor(mStats.exp * (bossProfile?.expMult || 2.5)),
                gold: Math.floor(mStats.gold * (bossProfile?.goldMult || 2.5)),
                dropMod: bossProfile?.dropMod || 2.5,
                weakness: bossProfile?.weakness,
                resistance: bossProfile?.resistance,
                phase2: bossProfile?.phase2,
                phase3: bossProfile?.phase3,
            };
            addLog('critical', MSG.ABYSS_BOSS_APPEAR(bossName));
        } else if (floor % 5 === 0) {
            addLog('warning', MSG.ABYSS_FLOOR_WARNING(floor));
        }
    }

    const fullStats = getFullStats();
    commitExploreOutcome('combat', (nextPlayer: any) => applyBattleStartRelics(nextPlayer, nextPlayer.relics || [], fullStats, { addLog }), gaugeMapData);
    dispatch({ type: AT.SET_ENEMY, payload: mStats });
    dispatch({ type: AT.SET_GAME_STATE, payload: GS.COMBAT });
    addLog('combat', MSG.ENEMY_APPEAR(mStats.name));
    // anticipate 레이어: boss가 signature를 드롭 가능한 경우 pre-combat 예고
    if (mStats.isBoss) {
        const sigDrops = getBossSignatureDrops(mStats.baseName);
        if (sigDrops.length > 0) {
            const top = sigDrops[0];
            const topPct = Math.max(1, Math.round(top.rate * 100));
            addLog('legendary', MSG.SIGNATURE_BOSS_HINT(mStats.baseName, sigDrops.length, top.name, topPct));
            const pityMult = getSignaturePityMultiplier(player.stats?.signaturePity);
            if (pityMult > 1) {
                const pct = Math.round((pityMult - 1) * 100);
                addLog('legendary', MSG.SIGNATURE_PITY_RESONANCE(pct, player.stats?.signaturePity));
            }
        }
    }
    if (typeof addStoryLog === 'function') addStoryLog('encounter', { loc: player.loc, name: baseName });
};

// ─────────────────────────────────────────────────────────────────────────
// 4.5. 발견 체인 체크 — 지역 조합 방문 시 보상 (Discovery Chains)
// ─────────────────────────────────────────────────────────────────────────
export const checkDiscoveryChains = (player: Player, loc: any, { dispatch, addLog }: any) => {
    const chains = BALANCE.DISCOVERY_CHAINS;
    if (!chains) return;
    const visited = new Set([...(player.stats?.visitedMaps || []), loc]);
    const completed = player.stats?.discoveryChains || [];

    chains.forEach((chain: any) => {
        if (completed.includes(chain.id)) return;
        if (!chain.locations.every((l: any) => visited.has(l))) return;

        // 체인 달성!
        const rewardParts: any[] = [];
        if (chain.reward.gold) rewardParts.push(`${chain.reward.gold}G`);
        if (chain.reward.exp) rewardParts.push(`${chain.reward.exp} EXP`);
        if (chain.reward.item) rewardParts.push(chain.reward.item);
        if (chain.reward.premiumCurrency) rewardParts.push(`${chain.reward.premiumCurrency} 크리스탈`);

        addLog('event', `🔍 ${chain.desc}`);
        addLog('success', `🏆 [발견 체인 완료] ${chain.label}! 보상: ${rewardParts.join(', ')}`);
        // cycle 117: 체인 완료 sensory cue — G major arpeggio. cycle 88 escape sound /
        // cycle 95+ maxKillStreak chain과 같은 결의 audio reflection.
        soundManager.play('discovery_chain');

        dispatch({
            type: AT.SET_PLAYER,
            payload: (p: any) => {
                const updated = { ...p };
                updated.gold = (updated.gold || 0) + (chain.reward.gold || 0);
                updated.exp = (updated.exp || 0) + (chain.reward.exp || 0);
                if (chain.reward.premiumCurrency) {
                    updated.premiumCurrency = (updated.premiumCurrency || 0) + chain.reward.premiumCurrency;
                }
                if (chain.reward.item) {
                    // cycle 180: 이전엔 존재하지 않는 allItems 필드를 lookup해 silent miss — DB.ITEMS는 object
                    //   { weapons, armors, ... }. 기존 lookup이 항상 undefined 반환해 cycle 177
                    //   reward.item fix 후에도 chain reward 아이템이 silent 누락이던 회귀 fix.
                    //   gameUtils.findItemByName(getAllItems() lookup) 사용으로 정합.
                    const itemData = findItemByName(chain.reward.item);
                    // cycle 182: player.maxInv (PremiumShop 확장)을 우선 — 기존엔 BALANCE.INV_MAX_SIZE
                    // 만 사용해 확장된 인벤(25칸)에서도 20칸 기준으로 reward skip 가능했음.
                    const invCap = (updated.maxInv as number) || (BALANCE.INV_MAX_SIZE || 20);
                    if (itemData && (updated.inv || []).length < invCap) {
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
// slice 23: 초반(맵 Lv≤10) 5지역 첫 방문 EXP 절반 — 레벨 간격 감속 (학습
//   구간 확보). 골드는 유지 (휴식/상점 경제 불변). 중후반 지역은 nextExp가
//   충분히 커서 그대로.
const FIRST_VISIT_REWARDS: any = {
    '고요한 숲':    { gold: 100,  exp: 25,  msg: '🌲 [첫 방문] 고요한 숲 탐험 완료! 보상 +100G, +25 EXP' },
    '서쪽 평원':   { gold: 150,  exp: 30,  msg: '🌾 [첫 방문] 서쪽 평원 탐험! +150G, +30 EXP' },
    '호수의 신전': { gold: 200,  exp: 50,  msg: '🌊 [첫 방문] 호수의 신전 발견! +200G, +50 EXP' },
    '잊혀진 폐허': { gold: 200,  exp: 60,  msg: '🏚️ [첫 방문] 잊혀진 폐허 진입! +200G, +60 EXP' },
    '버려진 광산': { gold: 250,  exp: 80,  msg: '⛏️ [첫 방문] 버려진 광산 탐색 시작! +250G, +80 EXP' },
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
export const getFirstVisitReward = (loc: string, player: Player) => {
    const visited = player.stats?.visitedMaps || [];
    if (visited.includes(loc)) return null;
    return FIRST_VISIT_REWARDS[loc] || null;
};
