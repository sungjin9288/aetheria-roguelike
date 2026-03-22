import { BOSS_BRIEFS } from '../data/monsters.js';
import { getDifficultyMults, calcPerformanceScore, countLowHpWins } from '../systems/DifficultyManager.js';
import { getExploreState } from './explorationPacing.js';
import { isFocusOffhand, isMagicWeapon, isShield, isTwoHandWeapon, isWeapon } from './equipmentUtils.js';
import {
    ARCHETYPE_LABELS,
    TRAIT_DEFINITIONS,
    ELEMENT_TO_STATUS,
    CLASS_BUILD_IDENTITIES,
} from '../data/traits.js';

// --- Internal helpers ---

const scoreTag = (id, name, desc, score, reasons = []) => ({
    id,
    name,
    desc,
    score,
    reasons,
});

const relicEffectsOf = (player) => new Set((player?.relics || []).map((relic) => relic.effect));
const hasProfileTag = (profile, id) => profile?.primary?.id === id || (profile?.tags || []).some((tag) => tag.id === id);
const labelTag = (id) => ARCHETYPE_LABELS[id] || id;
const toPercent = (value = 0) => `${Math.round(value * 100)}%`;
const hasAnyJob = (item, jobs = []) => Array.isArray(item?.jobs) && jobs.some((job) => item.jobs.includes(job));
const isConsumableType = (item) => ['hp', 'mp', 'cure', 'buff'].includes(item?.type);
const hasElement = (item) => Boolean(item?.elem && item.elem !== '물리');

// --- Class build functions ---

export const getClassBuildIdentity = (job = '모험가') => (
    CLASS_BUILD_IDENTITIES[job] || CLASS_BUILD_IDENTITIES['모험가']
);

export const getClassBuildCompatibility = (job, profile) => {
    const identity = getClassBuildIdentity(job);
    const matchedTags = identity.preferredTags.filter((tag) => hasProfileTag(profile, tag));
    const primaryMatch = hasProfileTag(profile, identity.preferredTags[0]);
    const score = matchedTags.length + (primaryMatch ? 1 : 0);

    let label = '엇갈림';
    if (score >= 2 && matchedTags.length >= 1) label = '최적';
    else if (matchedTags.length >= 1) label = '양호';
    else if (profile?.primary?.id === 'balanced') label = '정착 전';

    return {
        label,
        matchedTags,
        matchedLabels: matchedTags.map(labelTag),
        summary: matchedTags.length > 0
            ? `${job}은(는) ${matchedTags.map(labelTag).join(' / ')} 축과 잘 맞습니다.`
            : `${job} 정체성과 현재 빌드가 아직 완전히 맞물리진 않습니다.`,
    };
};

export const getClassBuildBonus = (job, profile) => {
    const identity = getClassBuildIdentity(job);
    const activeSynergy = identity.synergies.find((entry) => entry.tags.some((tag) => hasProfileTag(profile, tag))) || null;
    const bonus = activeSynergy?.bonus || {};

    return {
        matched: Boolean(activeSynergy),
        label: activeSynergy?.label || '기본 교전',
        desc: activeSynergy?.desc || identity.desc,
        atkMult: bonus.atkMult || 1,
        defMult: bonus.defMult || 1,
        hpFlat: bonus.hpFlat || 0,
        mpFlat: bonus.mpFlat || 0,
        critBonus: bonus.critBonus || 0,
    };
};

// --- Run build profile ---

export const getRunBuildProfile = (player, stats = {}) => {
    const relicEffects = relicEffectsOf(player);
    const mainWeapon = player?.equip?.weapon || null;
    const offhand = player?.equip?.offhand || null;
    const dualWield = isWeapon(mainWeapon) && isWeapon(offhand) && !isTwoHandWeapon(mainWeapon);
    const twoHand = isTwoHandWeapon(mainWeapon);
    const shield = isShield(offhand) && !isFocusOffhand(offhand);
    const focus = isFocusOffhand(offhand);
    const hpRatio = (player?.hp || 0) / Math.max(1, stats?.maxHp || player?.maxHp || 1);
    const tags = [];

    if (twoHand || relicEffects.has('execute_bonus') || relicEffects.has('armor_pen')) {
        const reasons = [];
        let score = 0;
        if (twoHand) { score += 4; reasons.push('양손 무기'); }
        if (relicEffects.has('execute_bonus')) { score += 2; reasons.push('처형 보정'); }
        if (relicEffects.has('armor_pen')) { score += 2; reasons.push('방어 관통'); }
        if (relicEffects.has('ancient_power')) { score += 2; reasons.push('고대의 분노'); }
        if (relicEffects.has('void_heart')) { score += 1; reasons.push('허공의 심장'); }
        tags.push(scoreTag('crusher', '양손 파쇄', '강한 한 방과 마무리 화력에 집중된 런.', score, reasons));
    }

    if (dualWield || relicEffects.has('combo_stack') || relicEffects.has('double_strike')) {
        const reasons = [];
        let score = 0;
        if (dualWield) { score += 4; reasons.push('쌍수 무기'); }
        if (relicEffects.has('combo_stack')) { score += 2; reasons.push('연격 스택'); }
        if (relicEffects.has('double_strike')) { score += 2; reasons.push('2회 타격'); }
        if (relicEffects.has('crit_mp_regen')) { score += 1; reasons.push('치명타 MP 회복'); }
        tags.push(scoreTag('dual', '쌍수 연격', '치명타와 연속 타격으로 압박하는 런.', score, reasons));
    }

    if (shield || relicEffects.has('reflect') || relicEffects.has('stone_skin') || relicEffects.has('fortress')) {
        const reasons = [];
        let score = 0;
        if (shield) { score += 4; reasons.push('방패 운용'); }
        if (relicEffects.has('reflect')) { score += 2; reasons.push('반사 피해'); }
        if (relicEffects.has('stone_skin')) { score += 2; reasons.push('방어 배율'); }
        if (relicEffects.has('fortress')) { score += 2; reasons.push('요새 유물'); }
        if (relicEffects.has('crit_block')) { score += 1; reasons.push('강타 차단'); }
        tags.push(scoreTag('fortress', '방패 요새', '방어와 반사, 안정성을 우선하는 런.', score, reasons));
    }

    if (stats?.isMagic || focus || isMagicWeapon(mainWeapon) || isMagicWeapon(offhand)) {
        const reasons = [];
        let score = 0;
        if (stats?.isMagic) { score += 2; reasons.push('마법 공격'); }
        if (focus) { score += 3; reasons.push('주문서/마도서'); }
        if (isMagicWeapon(mainWeapon) || isMagicWeapon(offhand)) { score += 2; reasons.push('마법 무기'); }
        if (relicEffects.has('mp_mult')) { score += 1; reasons.push('최대 MP 증가'); }
        if (relicEffects.has('free_skill')) { score += 2; reasons.push('MP 무소모 확률'); }
        if (relicEffects.has('mp_regen_turn')) { score += 2; reasons.push('턴당 MP 회복'); }
        if (relicEffects.has('skill_mult')) { score += 2; reasons.push('스킬 증폭'); }
        tags.push(scoreTag('arcane', '비전 공명', 'MP 순환과 무기 공명 스킬이 강한 런.', score, reasons));
    }

    if (relicEffects.has('event_chance') || relicEffects.has('drop_rate') || relicEffects.has('gold_mult') || relicEffects.has('exp_mult') || relicEffects.has('boss_hunter')) {
        const reasons = [];
        let score = 0;
        if (relicEffects.has('event_chance')) { score += 2; reasons.push('이벤트 증가'); }
        if (relicEffects.has('drop_rate')) { score += 2; reasons.push('드롭 증가'); }
        if (relicEffects.has('gold_mult')) { score += 1; reasons.push('골드 수급'); }
        if (relicEffects.has('exp_mult')) { score += 1; reasons.push('EXP 수급'); }
        if (relicEffects.has('boss_hunter')) { score += 3; reasons.push('보스 추적'); }
        tags.push(scoreTag('explorer', '탐험 수집가', '이벤트와 드롭, 보스 발견을 노리는 런.', score, reasons));
    }

    if (relicEffects.has('glass_cannon') || relicEffects.has('cursed_power') || relicEffects.has('low_hp_atk') || hpRatio < 0.45) {
        const reasons = [];
        let score = 0;
        if (relicEffects.has('glass_cannon')) { score += 2; reasons.push('유리 대포'); }
        if (relicEffects.has('cursed_power')) { score += 2; reasons.push('체력 대가 화력'); }
        if (relicEffects.has('low_hp_atk')) { score += 2; reasons.push('저체력 보너스'); }
        if (hpRatio < 0.45) { score += 1; reasons.push('현재 저체력'); }
        if (relicEffects.has('ancient_power')) { score += 1; reasons.push('공격 치중'); }
        tags.push(scoreTag('risk', '광전 도박', '생존을 희생해 순간 화력을 끌어올리는 런.', score, reasons));
    }

    if (relicEffects.has('dot_mult') || (mainWeapon?.elem && mainWeapon.elem !== '물리')) {
        const reasons = [];
        let score = 0;
        if (relicEffects.has('dot_mult')) { score += 3; reasons.push('지속 피해 증폭'); }
        if (mainWeapon?.elem && mainWeapon.elem !== '물리') { score += 2; reasons.push(`${mainWeapon.elem} 속성 무기`); }
        if (isMagicWeapon(mainWeapon)) { score += 1; reasons.push('상태이상 스킬 연계'); }
        tags.push(scoreTag('status', '상태이상 집행자', '독·화상·속성 연계로 누적 피해를 노리는 런.', score, reasons));
    }

    const ranked = tags
        .filter((tag) => tag.score >= 3)
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ko'));

    const primary = ranked[0] || scoreTag('balanced', '균형형 런', '아직 특정 축에 치우치지 않은 기본 빌드.', 0, ['다양한 선택 가능']);

    return {
        primary,
        secondary: ranked.slice(1, 3),
        tags: ranked.slice(0, 5),
    };
};

// --- Trait functions ---

const pickTraitId = (player, buildProfile) => {
    const relicEffects = relicEffectsOf(player);
    const primaryId = buildProfile.primary.id;
    const lowHpWins = countLowHpWins(player?.stats, 0.2);
    const hasRealRiskBuild = relicEffects.has('glass_cannon')
        || relicEffects.has('cursed_power')
        || relicEffects.has('low_hp_atk')
        || lowHpWins >= 2;

    if (hasRealRiskBuild) return 'risk';
    if (primaryId === 'risk') return 'balanced';
    return TRAIT_DEFINITIONS[primaryId] ? primaryId : 'balanced';
};

const buildTraitSkill = (traitId, player, stats = {}) => {
    const definition = TRAIT_DEFINITIONS[traitId] || TRAIT_DEFINITIONS.balanced;
    if (!definition.skill) return null;

    if (traitId === 'arcane' || traitId === 'status') {
        const baseElem = player?.equip?.weapon?.elem || stats?.elem || '물리';
        const effect = ELEMENT_TO_STATUS[baseElem] || definition.skill.effect;
        return {
            ...definition.skill,
            type: baseElem,
            effect,
            fromTrait: true,
        };
    }

    if (traitId === 'crusher' || traitId === 'dual') {
        const baseElem = player?.equip?.weapon?.elem || '물리';
        return {
            ...definition.skill,
            type: baseElem,
            fromTrait: true,
        };
    }

    return {
        ...definition.skill,
        fromTrait: true,
    };
};

export const getTraitProfile = (player, stats = {}) => {
    const buildProfile = getRunBuildProfile(player, stats);
    const traitId = pickTraitId(player, buildProfile);
    const definition = TRAIT_DEFINITIONS[traitId] || TRAIT_DEFINITIONS.balanced;
    const behaviorStats = player?.stats || {};
    const lowHpWins = countLowHpWins(behaviorStats, 0.2);
    const reasons = [...buildProfile.primary.reasons.slice(0, 2)];

    if (traitId === 'explorer' && (behaviorStats.explores || 0) > 0) reasons.push(`탐험 ${behaviorStats.explores}회`);
    if (traitId === 'fortress' && (behaviorStats.rests || 0) > 0) reasons.push(`휴식 ${behaviorStats.rests}회`);
    if (traitId === 'balanced' && (behaviorStats.crafts || 0) > 0) reasons.push(`제작 ${behaviorStats.crafts}회`);
    if (traitId === 'risk' && lowHpWins > 0) reasons.push(`저체력 승리 ${lowHpWins}회`);

    const skill = buildTraitSkill(traitId, player, stats);

    return {
        ...definition,
        buildProfile,
        reasons: reasons.slice(0, 3),
        bonus: {
            atkMult: definition.bonus.atkMult || 1,
            defMult: definition.bonus.defMult || 1,
            mpFlat: definition.bonus.mpFlat || 0,
            critBonus: definition.bonus.critBonus || 0,
        },
        skill,
        skillLabel: skill ? `${skill.name} · MP ${skill.mp}` : '특수 스킬 없음',
        rewardFocus: definition.rewardFocus,
        questFocus: definition.questFocus,
        bossDirective: definition.bossDirective,
    };
};

export const getTraitBonus = (player, stats = {}) => getTraitProfile(player, stats).bonus;

export const getTraitSkill = (player, stats = {}) => getTraitProfile(player, stats).skill;

export const getTraitPassiveParts = (traitProfile) => {
    const bonus = traitProfile?.bonus || {};
    const parts = [];
    if ((bonus.atkMult || 1) > 1) parts.push(`ATK +${toPercent((bonus.atkMult || 1) - 1)}`);
    if ((bonus.defMult || 1) > 1) parts.push(`DEF +${toPercent((bonus.defMult || 1) - 1)}`);
    if ((bonus.critBonus || 0) > 0) parts.push(`CRIT +${toPercent(bonus.critBonus || 0)}`);
    if ((bonus.mpFlat || 0) > 0) parts.push(`MP +${bonus.mpFlat}`);
    return parts;
};

export const getTraitItemResonance = (item, traitProfile, player = null) => {
    if (!item) return { score: 0, label: null, reasons: [], summary: null };

    const traitId = traitProfile?.id || 'balanced';
    const reasons = [];
    let score = 0;

    switch (traitId) {
        case 'crusher':
            if (isWeapon(item) && isTwoHandWeapon(item)) { score += 6; reasons.push('양손 파쇄 무기'); }
            if (hasAnyJob(item, ['전사', '버서커', '나이트'])) { score += 2; reasons.push('전열 클래스 장비'); }
            if (item?.elem === '화염' || item?.elem === '대지') { score += 1; reasons.push('강타 속성'); }
            if (item?.type === 'buff' && (item?.effect === 'atk_up' || item?.effect === 'all_up')) { score += 3; reasons.push('화력 강화 소모품'); }
            break;
        case 'dual':
            if (isWeapon(item) && !isTwoHandWeapon(item)) { score += 6; reasons.push('한손 연계 무기'); }
            if (String(item?.name || '').includes('단검') || String(item?.name || '').includes('표창')) { score += 2; reasons.push('쌍수 급소 장비'); }
            if (hasAnyJob(item, ['도적', '어쌔신'])) { score += 2; reasons.push('연계 클래스 장비'); }
            if (item?.type === 'buff' && item?.effect === 'atk_up') { score += 2; reasons.push('순간 화력 보조'); }
            break;
        case 'fortress':
            if (isShield(item)) { score += 6; reasons.push(isFocusOffhand(item) ? '보조 촉매' : '방패 장비'); }
            if (item?.type === 'armor') { score += 4; reasons.push('방어구'); }
            if (item?.type === 'buff' && (item?.effect === 'def_up' || item?.effect === 'all_up')) { score += 3; reasons.push('생존 강화 소모품'); }
            if (hasAnyJob(item, ['전사', '나이트', '팔라딘'])) { score += 1; reasons.push('수호 클래스 장비'); }
            break;
        case 'arcane':
            if (isMagicWeapon(item)) { score += 6; reasons.push('비전 무기'); }
            if (isFocusOffhand(item)) { score += 6; reasons.push('마도서/집중 촉매'); }
            if (item?.type === 'mp') { score += 4; reasons.push('마나 회복'); }
            if (hasElement(item)) { score += 2; reasons.push('속성 공명'); }
            if (hasAnyJob(item, ['마법사', '아크메이지', '흑마법사', '성직자'])) { score += 2; reasons.push('비전 클래스 장비'); }
            break;
        case 'explorer':
            if (isConsumableType(item)) { score += 3; reasons.push('탐험 보급'); }
            if (String(item?.name || '').includes('활') || String(item?.name || '').includes('궁')) { score += 4; reasons.push('원거리 개척 장비'); }
            if (hasAnyJob(item, ['레인저', '모험가'])) { score += 2; reasons.push('개척 클래스 장비'); }
            if (String(item?.name || '').includes('외투') || String(item?.name || '').includes('망토')) { score += 1; reasons.push('기동 장비'); }
            break;
        case 'risk':
            if (isWeapon(item) && (isTwoHandWeapon(item) || item?.elem === '화염' || item?.elem === '어둠')) { score += 5; reasons.push('고위험 화력 장비'); }
            if (item?.type === 'buff' && (item?.effect === 'atk_up' || item?.effect === 'all_up')) { score += 4; reasons.push('폭발력 증폭'); }
            if (hasAnyJob(item, ['버서커', '흑마법사', '어쌔신'])) { score += 2; reasons.push('리스크 클래스 장비'); }
            break;
        case 'status':
            if (hasElement(item)) { score += 5; reasons.push('속성/상태 장비'); }
            if (isMagicWeapon(item)) { score += 3; reasons.push('주문 연계'); }
            if (hasAnyJob(item, ['레인저', '마법사', '흑마법사', '어쌔신'])) { score += 2; reasons.push('상태 집행 클래스 장비'); }
            if (item?.type === 'cure' || (item?.type === 'buff' && item?.effect === 'all_up')) { score += 1; reasons.push('상태 관리 보조'); }
            break;
        case 'balanced':
        default:
            if (isConsumableType(item)) { score += 2; reasons.push('범용 보급'); }
            if (['weapon', 'armor', 'shield'].includes(item?.type)) { score += 1; reasons.push('범용 장비'); }
            if (hasAnyJob(item, ['모험가'])) { score += 1; reasons.push('모험가 장비 장착 가능'); }
            break;
    }

    if (player?.job && Array.isArray(item?.jobs) && item.jobs.includes(player.job)) {
        score += 1;
        reasons.push('현재 직업 장착 가능');
    }

    const label = score >= 6 ? '성향 공명' : score >= 3 ? '호응' : null;

    return {
        score,
        label,
        reasons,
        summary: reasons.slice(0, 2).join(' · ') || null,
    };
};

export const getTraitFeaturedItems = (items = [], traitProfile, player = null, limit = 3) => (
    (items || [])
        .map((item) => ({
            item,
            resonance: getTraitItemResonance(item, traitProfile, player),
        }))
        .filter((entry) => entry.resonance.score >= 3)
        .sort((left, right) => right.resonance.score - left.resonance.score || (left.item.price || 0) - (right.item.price || 0))
        .slice(0, limit)
);

export const getTraitLootHint = (items = [], traitProfile, player = null) => {
    const [best] = getTraitFeaturedItems(items, traitProfile, player, 1);
    if (!best) return null;

    return {
        name: best.item.name,
        score: best.resonance.score,
        label: best.resonance.label,
        summary: best.resonance.summary || `${traitProfile?.name || '현재 성향'}과 잘 맞는 전리품입니다.`,
        traitName: traitProfile?.name || null,
    };
};

export const getTraitQuestResonance = (quest, traitProfile) => {
    if (!quest) return { score: 0, label: null, summary: null };

    const buildTags = new Set([
        traitProfile?.id,
        traitProfile?.buildProfile?.primary?.id,
        ...((traitProfile?.buildProfile?.tags || []).map((tag) => tag.id))
    ].filter(Boolean));

    let score = 0;
    const reasons = [];

    if (quest.buildTag && buildTags.has(quest.buildTag)) {
        score += 6;
        reasons.push(`${labelTag(quest.buildTag)} 축과 일치`);
    }

    if (quest.type === 'discovery_count' && buildTags.has('explorer')) {
        score += 5;
        reasons.push('탐험 성향과 맞는 발견형 임무');
    }

    if (quest.type === 'build_victory' && buildTags.has(quest.target)) {
        score += 4;
        reasons.push('현재 성향 승리 루프와 직접 연결');
    }

    if (quest.type === 'survive_low_hp' && buildTags.has('risk')) {
        score += 3;
        reasons.push('고위험 런과 궁합');
    }

    if (quest.type === 'bounty_count' && buildTags.has('explorer')) {
        score += 2;
        reasons.push('개척/추적 루프와 호응');
    }

    return {
        score,
        label: score >= 6 ? '성향 추천' : score >= 3 ? '호응' : null,
        summary: reasons.slice(0, 2).join(' · ') || null,
    };
};

// --- Diagnostics ---

export const getRunDiagnostics = (player, stats = {}) => {
    const buildProfile = getRunBuildProfile(player, stats);
    const classIdentity = getClassBuildIdentity(player?.job);
    const classCompatibility = getClassBuildCompatibility(player?.job, buildProfile);
    const classBonus = getClassBuildBonus(player?.job, buildProfile);
    const recentBattles = (player?.stats?.recentBattles || []).slice(-20);
    const wins = recentBattles.filter((battle) => battle.result === 'win');
    const winRate = recentBattles.length > 0
        ? Math.round((wins.length / recentBattles.length) * 100)
        : null;
    const avgWinHp = wins.length > 0
        ? Math.round((wins.reduce((sum, battle) => sum + ((battle.hpRatio || 0) * 100), 0) / wins.length))
        : null;
    const exploreState = getExploreState(player?.stats);
    const difficulty = getDifficultyMults(calcPerformanceScore(player));

    let pacingLabel = '안정';
    let pacingNote = '전투와 발견이 무난하게 섞이고 있습니다.';
    if (exploreState.quietStreak >= 3) {
        pacingLabel = '건조';
        pacingNote = '조용한 탐험이 길게 이어졌습니다. 곧 이벤트 pity가 강하게 작동합니다.';
    } else if (exploreState.sinceNarrativeEvent >= 4) {
        pacingLabel = '이벤트 대기';
        pacingNote = '특수 이벤트 누적이 쌓였습니다. 몇 번 안에 발견이 나올 가능성이 높습니다.';
    } else if (['narrative_event', 'anomaly', 'key_event', 'relic_found'].includes(exploreState.lastOutcome)) {
        pacingLabel = '발견 직후';
        pacingNote = '방금 큰 발견이 나왔습니다. 다음 몇 턴은 전투/정리 리듬이 됩니다.';
    }

    const recommendations = [];
    if (winRate !== null && winRate < 45) recommendations.push('최근 승률이 낮습니다. 휴식과 방패/회복 루틴을 우선하세요.');
    if (avgWinHp !== null && avgWinHp < 35) recommendations.push('전투 종료 HP가 낮습니다. DEF 또는 회복 수단을 더 챙기는 편이 좋습니다.');
    if (classCompatibility.label === '엇갈림') {
        recommendations.push(`${player?.job || '현재 직업'}은 ${classIdentity.preferredTags.map(labelTag).join(' / ')} 축에서 더 강합니다.`);
    }
    if (difficulty.label === '압도' || difficulty.label === '우세') recommendations.push('현재 템포가 좋습니다. 보스나 상위 지역 진입을 시도할 타이밍입니다.');
    if (pacingLabel === '건조') recommendations.push('이벤트 pity가 쌓였습니다. 탐험을 조금 더 이어가면 발견 확률이 올라갑니다.');
    if (recommendations.length === 0) recommendations.push('현재 런은 안정적입니다. 빌드 축을 유지하며 보스 타이밍을 준비하세요.');

    return {
        buildProfile,
        classIdentity,
        classCompatibility,
        classBonus,
        difficultyLabel: difficulty.label,
        winRate,
        avgWinHp,
        pacingLabel,
        pacingNote,
        recentBattles: recentBattles.length,
        recommendations,
    };
};

// --- Enemy tactical profile ---

export const getEnemyTacticalProfile = (enemy, stats = {}) => {
    if (!enemy) return null;

    const pattern = enemy.pattern || {};
    const guardChance = Math.max(0, Math.round((pattern.guardChance || 0) * 100));
    const heavyChance = Math.max(0, Math.round((pattern.heavyChance || 0) * 100));
    const estimatedHit = Math.max(1, Math.floor((enemy.atk || 0) - (stats.def || 0)));
    const estimatedHeavy = Math.max(1, Math.floor((enemy.atk || 0) * 1.4 - (stats.def || 0)));
    const role = heavyChance >= guardChance + 10 ? '파쇄형' : guardChance >= heavyChance + 10 ? '수비형' : '교전형';
    const tier = enemy.isBoss ? 'BOSS' : enemy.isElite ? 'ELITE' : 'NORMAL';
    const bossBrief = enemy.isBoss ? BOSS_BRIEFS[enemy.baseName || enemy.name] : null;
    const rawPhaseHint = bossBrief?.phaseHint || (enemy.isBoss && enemy.phase2 ? 'HP 50% 이하에서 2페이즈로 전환됩니다.' : null);
    const phaseHint = rawPhaseHint && enemy.isBoss && enemy.phase2 && !rawPhaseHint.includes('50%')
        ? `${rawPhaseHint} (전환 기준 HP 50%)`
        : rawPhaseHint;
    const hint = heavyChance >= 30
        ? '강타 비중이 높습니다. 방어/회복 타이밍을 아껴두는 편이 좋습니다.'
        : guardChance >= 30
            ? '방어 빈도가 높습니다. 큰 스킬은 가드가 빠진 뒤에 쓰는 편이 좋습니다.'
            : '공격 패턴이 고른 편입니다. 안정적인 교전이 유리합니다.';

    return {
        role,
        tier,
        guardChance,
        heavyChance,
        estimatedHit,
        estimatedHeavy,
        weakness: enemy.weakness || null,
        resistance: enemy.resistance || null,
        hint,
        entryHint: bossBrief?.entryHint || null,
        signature: bossBrief?.signature || null,
        counterHint: bossBrief?.counterHint || null,
        phaseHint,
        rewardHint: bossBrief?.rewardHint || null,
        warningChips: bossBrief?.warningChips || [],
        recommendedBuilds: bossBrief?.recommendedBuilds || [],
        phaseTriggered: Boolean(enemy.phase2Triggered),
    };
};
