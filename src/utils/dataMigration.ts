import { ITEMS } from '../data/items.js';
import { DEFAULT_EXPLORE_STATE } from './explorationPacing.js';
import { isTwoHandWeapon, isShield, isWeapon } from './equipmentUtils.js';
import { normalizeActiveExpedition, normalizeExpeditionSummary } from './expeditionLedger.js';
import { getDefaultExpeditionFocusQuestIds, getPreparedExpeditionFocusQuestIds } from './expeditionMissionFocus.js';

// gameUtils.ts에서 분리 (저장 데이터 마이그레이션) — 행동 보존 리팩토링.
//   순환 의존을 피하려 toArray(1줄 헬퍼)는 인라인.
const toArray = (v: any) => (Array.isArray(v) ? v : []);

export const migrateData = (rawData: any) => {
    if (!rawData) return null;
    // Deep clone to avoid mutating the Firestore snapshot directly
    const savedData = JSON.parse(JSON.stringify(rawData));

    // Target the specific player object if clear structure exists
    // If savedData IS the player (old flat format?), use it.
    // But in this app, usually savedData matches App state structure.
    const target = savedData.player || savedData;

    // Version Limit
    if (!savedData.version || savedData.version < 2.7) {
        savedData.version = 2.7;

        target.mp = target.mp ?? 50;
        target.maxMp = target.maxMp ?? 50;
        target.history = target.history || [];
        target.archivedHistory = target.archivedHistory || []; // Ensure archivedHistory exists

        // New stats for v3.1
        target.stats = target.stats || { kills: 0, total_gold: 0, deaths: 0 };
        target.stats.killRegistry = target.stats.killRegistry || {};
        target.stats.bossKills = target.stats.bossKills || 0;
        target.stats.rests = target.stats.rests || 0;
    }

    // Ensure equip is object not string (Old version compatibility)
    target.equip = target.equip || {};
    if (typeof target.equip?.weapon === 'string') {
        target.equip.weapon = ITEMS.weapons.find((w: any) => w.name === target.equip.weapon) || ITEMS.weapons[0];
    }
    if (typeof target.equip?.armor === 'string') {
        target.equip.armor = ITEMS.armors.find((a: any) => a.name === target.equip.armor) || ITEMS.armors[0];
    }
    if (typeof target.equip?.offhand === 'string') {
        const shield = ITEMS.armors.find((a: any) => a.type === 'shield' && a.name === target.equip.offhand);
        const weapon = ITEMS.weapons.find((w: any) => w.name === target.equip.offhand);
        target.equip.offhand = shield || weapon || null;
    }
    if (!target.equip.weapon || !isWeapon(target.equip.weapon)) {
        target.equip.weapon = ITEMS.weapons[0];
    }
    if (!target.equip.armor || target.equip.armor.type !== 'armor') {
        target.equip.armor = ITEMS.armors.find((a: any) => a.type === 'armor') || ITEMS.armors[0];
    }
    if (target.equip.offhand && !isShield(target.equip.offhand) && !isWeapon(target.equip.offhand)) {
        target.equip.offhand = null;
    }
    if (isTwoHandWeapon(target.equip.weapon)) {
        target.equip.offhand = null;
    }

    // Modern runtime fields (safe defaults for older saves)
    // cycle 374: 3 sub-field fallback 제거 (cycle 373 meta 동일 lens) — 모든 consumer가
    //   이미 `buff.X || 0` protection (statsCalculator) 또는 EMPTY_TEMP_BUFF 병합
    //   (playerStateUtils)로 undefined 안전. 객체 자체 초기화만 필요.
    target.tempBuff = target.tempBuff || { atk: 0, def: 0, turn: 0, name: null };
    // cycle 381: target.status / skillLoadout.selected normalizations 제거 (cycle 373-379
    //   동일 lens) — 모든 consumer가 이미 동일 패턴 (Array.isArray, Number.isInteger,
    //   `|| []`, toArray) 사용으로 undefined / 비정상 값 안전 처리.
    target.skillLoadout = target.skillLoadout || { selected: 0, cooldowns: {} };
    target.skillLoadout.cooldowns = target.skillLoadout.cooldowns || {};
    // cycle 373: 5 sub-field fallback 제거 — 모든 consumer가 이미 `meta.X || 0`
    //   protection 또는 CombatEngine 로컬 reconstruction (DEFAULT_META 병합)으로
    //   undefined 안전. 객체 자체 초기화만 필요.
    target.meta = target.meta || { essence: 0, rank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 };
    // 2026-07 — 에테르 거울: meta.mirror가 없는 구세이브(v5.0 이전 전부 + v5.0 일부)에서도
    //   getMirrorEffects가 항상 객체를 참조할 수 있도록 {}로 보강. 기존 레벨은 보존.
    target.meta.mirror = target.meta.mirror || {};
    target.settings = {
        ...(target.settings || {}),
        readabilityMode: target.settings?.readabilityMode === 'high' ? 'high' : 'standard',
        equipmentDetailMode: ['summary', 'full'].includes(target.settings?.equipmentDetailMode)
            ? target.settings.equipmentDetailMode
            : 'auto',
    };
    target.stats = target.stats || { kills: 0, total_gold: 0, deaths: 0, killRegistry: {}, bossKills: 0, rests: 0 };
    // cycle 376: bountyDate / bountyIssued normalizations 제거 — 모든 consumer가
    //   strict equality (`bountyDate === today`) 또는 truthy 체크 (`&& bountyIssued`)
    //   로 undefined 안전 처리. Boolean coercion / `|| null` 정규화 redundant.
    // cycle 377: stats.rests / bountiesCompleted fallback 제거 (cycle 373/374/376 동일 lens) —
    //   모든 consumer가 이미 `|| 0` fallback 처리. ascensionActions 직접 read도 checkTitles
    //   `|| 0` fallback으로 안전.
    // cycle 379: claimedAchievements normalization 제거 (cycle 373-378 동일 lens) —
    //   모든 consumer (AchievementPanel / useInventoryActions / progressionHandlers)가
    //   이미 `Array.isArray` 또는 `|| []` fallback 처리.
    // cycle 260: stats.claimedQuestIds 정규화 보존 — quest 완료 영구 ledger.
    //   cycle-260 회귀 가드 테스트가 migrateData output 명시 검증.
    target.stats.claimedQuestIds = Array.isArray(target.stats.claimedQuestIds) ? target.stats.claimedQuestIds : [];
    target.stats.visitedMaps = Array.isArray(target.stats.visitedMaps) ? target.stats.visitedMaps : [];
    target.stats.exploresByLocation = target.stats.exploresByLocation
        && typeof target.stats.exploresByLocation === 'object'
        && !Array.isArray(target.stats.exploresByLocation)
        ? target.stats.exploresByLocation
        : {};
    target.stats.exploreState = { ...DEFAULT_EXPLORE_STATE, ...(target.stats.exploreState || {}) };
    target.activeExpedition = normalizeActiveExpedition(target.activeExpedition);
    target.lastExpeditionSummary = normalizeExpeditionSummary(target.lastExpeditionSummary);
    target.expeditionFocusQuestIds = Array.isArray(target.expeditionFocusQuestIds)
        ? getPreparedExpeditionFocusQuestIds({ ...target, activeExpedition: null })
        : getDefaultExpeditionFocusQuestIds(target, target.activeExpedition?.destination);
    if (target.loc && !target.stats.visitedMaps.includes(target.loc)) {
        target.stats.visitedMaps.push(target.loc);
    }

    if (!Array.isArray(savedData.quickSlots)) {
        savedData.quickSlots = [null, null, null];
    } else {
        savedData.quickSlots = savedData.quickSlots.slice(0, 3);
        while (savedData.quickSlots.length < 3) savedData.quickSlots.push(null);
    }

    // v4.0 — 신규 필드 기본값 (기존 세이브 호환)
    // cycle 382: target.relics / target.titles normalizations 제거 (cycle 373-381 동일 lens) —
    //   모든 consumer가 이미 `|| []` 또는 `Array.isArray` 또는 optional chain fallback 처리.
    // cycle 375: target.activeTitle = target.activeTitle || null 제거 — 모든 consumer가
    //   이미 fallback (`|| null`) 또는 truthy 체크로 undefined / null 안전하게 처리.
    target.combatFlags = {
        comboCount: 0,
        deathSaveUsed: false,
        voidHeartUsed: Boolean(target.combatFlags?.voidHeartUsed),
        voidHeartArmed: Boolean(target.combatFlags?.voidHeartArmed),
    };
    // cycle 378: 8 sub-field fallback 일괄 제거 (cycle 373-377 동일 lens) —
    //   prestigeRank / relicCount / crafts / buildWins / abyssFloor / abyssRecord /
    //   demonKingSlain / dailyProtocol. 모든 consumer가 이미 fallback / optional chain
    //   처리. ascensionActions 직접 read도 checkTitles `|| 0` fallback으로 안전.
    // cycle 277: totalPrestigeAtk/Hp/Mp 3 dead 필드 정규화 제거 — read 0건. 잔존 saved 데이터는 무해.
    // cycle 124: dead `comboCount` migrate 제거. INITIAL_STATE에서도 제거됨.
    //   활성 combo 카운터는 combatFlags.comboCount(별도 필드)로 처리.
    // cycle 120: dead 'discoveries' migrate 제거 (cycle 84 INITIAL_STATE 정리 후속).
    //   신규 영구 카운터 default 추가 — cycle 119 ASCEND preserve와 정합.
    // cycle 120/131 회귀 가드: 다음 4 필드는 migrate output 명시 검증으로 fallback 유지.
    target.stats.escapes         = target.stats.escapes         || 0;
    target.stats.syntheses       = target.stats.syntheses       || 0;
    target.stats.maxKillStreak   = target.stats.maxKillStreak   || 0;
    target.stats.discoveryChains = Array.isArray(target.stats.discoveryChains) ? target.stats.discoveryChains : [];
    // pendingRelics는 런타임 전용 — 저장 불필요, 로드 시 null로 초기화
    savedData.pendingRelics = null;

    // v4.1 — 도감(Codex) + 프리미엄 재화
    if (!target.stats.codex) {
        target.stats.codex = { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} };
        // 기존 인벤토리에서 codex 부트스트랩
        for (const item of toArray(target.inv)) {
            const cat = item.type === 'weapon' ? 'weapons'
                : item.type === 'armor' ? 'armors'
                : item.type === 'shield' ? 'shields'
                : item.type === 'mat' ? 'materials' : null;
            if (cat && item.name) {
                target.stats.codex[cat][item.name] = { discovered: true };
            }
        }
        // 기존 장비에서도 부트스트랩
        for (const slot of ['weapon', 'armor', 'offhand']) {
            const eq = target.equip?.[slot];
            if (eq?.name) {
                const cat = eq.type === 'weapon' ? 'weapons'
                    : eq.type === 'armor' ? 'armors'
                    : eq.type === 'shield' ? 'shields' : null;
                if (cat) target.stats.codex[cat][eq.name] = { discovered: true };
            }
        }
        // killRegistry에서 몬스터 codex 부트스트랩
        for (const [name, kills] of Object.entries(target.stats.killRegistry || {}) as Array<[string, number]>) {
            if (kills > 0) {
                target.stats.codex.monsters[name] = { discovered: true, kills };
            }
        }
    }
    target.premiumCurrency = target.premiumCurrency || 0;
    // cycle 383: codexClaimed array normalization 제거 (cycle 373-382 동일 lens) —
    //   모든 consumer (Codex / rewardHandlers / progressionHandlers)가 이미 `|| []` 또는
    //   `Array.isArray` fallback 처리. cosmeticTitles는 cycle 189 회귀 가드로 보존.

    // cycle 189: PremiumShop 구매 자산 4종 default — cycle 185(cosmetic title) /
    //   cycle 186(reviveTokens, synthProtects) / cycle 188(ASCEND preserve) 정합성.
    //   옛 save에 미정의된 필드를 명시 0/[] 초기화 → fallback 분기 단순화 + 데이터 형태 lock.
    target.reviveTokens = Math.max(0, Number(target.reviveTokens) || 0);
    if (target.maxInv !== undefined) target.maxInv = Math.max(20, Number(target.maxInv) || 20);
    target.stats.synthProtects = Math.max(0, Number(target.stats.synthProtects) || 0);
    target.stats.cosmeticTitles = Array.isArray(target.stats.cosmeticTitles) ? target.stats.cosmeticTitles : [];

    // v4.2 — 시즌 패스
    if (!target.seasonPass) {
        target.seasonPass = { xp: 0, tier: 0, claimed: [], isPremium: false, seasonId: 'S1' };
    }

    // v4.3 — 강화, 주간 미션, 챌린지, 스킬 분기, 묘비 침략
    if (!target.weeklyProtocol) {
        target.weeklyProtocol = { kills: 0, explores: 0, bossKills: 0, lastResetWeek: 0, claimed: [] };
    }
    // cycle 387: skillChoices / challengeModifiers normalizations 제거 (cycle 373-386
    //   동일 lens) — 모든 consumer가 이미 optional chain (`?.[name]`, `?.includes()`)
    //   또는 `|| {}` / `|| []` fallback 처리.
    // cycle 386: dailyInvadeCount / lastInvadeDate fallback 제거 (cycle 373-385 동일 lens) —
    //   모든 consumer가 이미 `|| 0` fallback 또는 strict equal 비교 (`=== today`)로
    //   undefined / null 안전 처리.
    // 인벤 아이템에 enhance 기본값 보장
    if (Array.isArray(target.inv)) {
        target.inv = target.inv.map((item: any) => item ? { ...item, enhance: item.enhance || 0 } : item);
    }

    // v5.0 — 진 엔딩, 이벤트 체인, 시너지
    if (!target.eventChainProgress || typeof target.eventChainProgress !== 'object') {
        target.eventChainProgress = {};
    }
    // cycle 384: areaBossDefeated / deathSaveUsedCount fallback 제거 (cycle 373-383 동일
    //   lens) — 모든 consumer가 이미 optional chain (`?.areaBossDefeated?.[name]`) 또는
    //   `|| {}` / `|| 0` fallback 처리.
    // cycle 388: killStreak 정규화 제거 (cycle 373-387 동일 lens) — 모든 consumer가
    //   `player.killStreak || 0` fallback 처리. 비숫자 값(corrupt save)도 이후 비교에서
    //   NaN → false 반환으로 안전 (crash 없음).
    // cycle 206: 진 엔딩 파편 dead meta 필드 제거 — v5.0 schema 잔해 wire-up 안 됨.
    //   파편 메커니즘은 inv 기반 (combatBossHandlers.ts:15 inv.filter shard count)으로
    //   구현되어 있어 meta 필드는 dead. cycle 120(discoveries) / cycle 124(comboCount) /
    //   cycle 195(6 dead constants)와 동일 cleanup 패턴.

    // cycle 385: discoveryChains 정규화 중복 제거 — 동일 코드가 line 440(cycle 120 영역)에
    //   이미 존재. 두 번째는 noop이라 redundant.

    // 접두사 마이그레이션 — prefixed 플래그가 있지만 prefixName 누락된 아이템 보강
    const fixPrefixedItem = (item: any) => {
        if (!item || !item.prefixed) return item;
        if (!item.prefixName && item.name) {
            // 이름에서 접두사 추출 시도 (첫 번째 공백 기준)
            const parts = item.name.split(' ');
            if (parts.length > 1) {
                item.prefixName = parts[0];
            }
        }
        return item;
    };
    if (Array.isArray(target.inv)) {
        target.inv = target.inv.map(fixPrefixedItem);
    }
    if (target.equip) {
        target.equip.weapon = fixPrefixedItem(target.equip.weapon);
        target.equip.armor = fixPrefixedItem(target.equip.armor);
        target.equip.offhand = fixPrefixedItem(target.equip.offhand);
    }

    return savedData;
};
