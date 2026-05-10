import type { Item, Monster } from '../types/index.js';
import { BOSS_BRIEFS } from '../data/monsters.js';
import type { Player } from "../types/index.js";
// cycle 271: getDifficultyMults / calcPerformanceScore / getExploreState / CLASS_BUILD_IDENTITIES /
//   hasProfileTag — getRunDiagnostics + 3 class-build helpers 제거 후 dead imports cleanup.
import { countLowHpWins } from '../systems/DifficultyManager.js';
import { isFocusOffhand, isMagicWeapon, isShield, isTwoHandWeapon, isWeapon } from './equipmentUtils.js';
import {
    ARCHETYPE_LABELS,
    TRAIT_DEFINITIONS,
    ELEMENT_TO_STATUS,
} from '../data/traits.js';

// --- Internal helpers ---

// cycle 345: scoreTag desc 매개변수 제거 — tag.desc / primary.desc read 0건이던 dead 출력.
//   8 호출 사이트의 한국어 desc 문자열 인자도 함께 제거.
const scoreTag = (id: any, name: any, score: any, reasons: any[] = []) => ({
    id,
    name,
    score,
    reasons,
});

const relicEffectsOf = (player: Player) => new Set((player?.relics || []).map((relic: any) => relic.effect));
const labelTag = (id: any) => ARCHETYPE_LABELS[id] || id;
const toPercent = (value: any = 0) => `${Math.round(value * 100)}%`;
const hasAnyJob = (item: Item | null | undefined, jobs: any[] = []) => Array.isArray(item?.jobs) && jobs.some((job: any) => item?.jobs?.includes(job));
const isConsumableType = (item: Item | null | undefined) => ['hp', 'mp', 'cure', 'buff'].includes(item?.type as string);
const hasElement = (item: Item | null | undefined) => Boolean(item?.elem && item.elem !== '물리');

// cycle 271: getClassBuildIdentity / getClassBuildCompatibility / getClassBuildBonus 3 dead exports 제거.
//   미완성 diagnostics 기능의 일부였으나 production 호출 0건이라 dead. getRunDiagnostics 함께 제거.

// --- Run build profile ---

export const getRunBuildProfile = (player: Player, stats: any = {}) => {
    const relicEffects = relicEffectsOf(player);
    const mainWeapon = player?.equip?.weapon || null;
    const offhand = player?.equip?.offhand || null;
    const dualWield = isWeapon(mainWeapon) && isWeapon(offhand) && !isTwoHandWeapon(mainWeapon);
    const twoHand = isTwoHandWeapon(mainWeapon);
    const shield = isShield(offhand) && !isFocusOffhand(offhand);
    const focus = isFocusOffhand(offhand);
    const hpRatio = (player?.hp || 0) / Math.max(1, stats?.maxHp || player?.maxHp || 1);
    const tags: any[] = [];

    if (twoHand || relicEffects.has('execute_bonus') || relicEffects.has('armor_pen')) {
        const reasons: any[] = [];
        let score = 0;
        if (twoHand) { score += 4; reasons.push('양손 무기'); }
        if (relicEffects.has('execute_bonus')) { score += 2; reasons.push('처형 보정'); }
        if (relicEffects.has('armor_pen')) { score += 2; reasons.push('방어 관통'); }
        if (relicEffects.has('ancient_power')) { score += 2; reasons.push('고대의 분노'); }
        if (relicEffects.has('void_heart')) { score += 1; reasons.push('허공의 심장'); }
        tags.push(scoreTag('crusher', '양손 파쇄', score, reasons));
    }

    if (dualWield || relicEffects.has('combo_stack') || relicEffects.has('double_strike')) {
        const reasons: any[] = [];
        let score = 0;
        if (dualWield) { score += 4; reasons.push('쌍수 무기'); }
        if (relicEffects.has('combo_stack')) { score += 2; reasons.push('연격 스택'); }
        if (relicEffects.has('double_strike')) { score += 2; reasons.push('2회 타격'); }
        if (relicEffects.has('crit_mp_regen')) { score += 1; reasons.push('치명타 MP 회복'); }
        tags.push(scoreTag('dual', '쌍수 연격', score, reasons));
    }

    if (shield || relicEffects.has('reflect') || relicEffects.has('stone_skin') || relicEffects.has('fortress')) {
        const reasons: any[] = [];
        let score = 0;
        if (shield) { score += 4; reasons.push('방패 운용'); }
        if (relicEffects.has('reflect')) { score += 2; reasons.push('반사 피해'); }
        if (relicEffects.has('stone_skin')) { score += 2; reasons.push('방어 배율'); }
        if (relicEffects.has('fortress')) { score += 2; reasons.push('요새 유물'); }
        if (relicEffects.has('crit_block')) { score += 1; reasons.push('강타 차단'); }
        tags.push(scoreTag('fortress', '방패 요새', score, reasons));
    }

    if (stats?.isMagic || focus || isMagicWeapon(mainWeapon) || isMagicWeapon(offhand)) {
        const reasons: any[] = [];
        let score = 0;
        if (stats?.isMagic) { score += 2; reasons.push('마법 공격'); }
        if (focus) { score += 3; reasons.push('주문서/마도서'); }
        if (isMagicWeapon(mainWeapon) || isMagicWeapon(offhand)) { score += 2; reasons.push('마법 무기'); }
        if (relicEffects.has('mp_mult')) { score += 1; reasons.push('최대 MP 증가'); }
        if (relicEffects.has('free_skill')) { score += 2; reasons.push('MP 무소모 확률'); }
        if (relicEffects.has('mp_regen_turn')) { score += 2; reasons.push('턴당 MP 회복'); }
        if (relicEffects.has('skill_mult')) { score += 2; reasons.push('스킬 증폭'); }
        tags.push(scoreTag('arcane', '비전 공명', score, reasons));
    }

    if (relicEffects.has('event_chance') || relicEffects.has('drop_rate') || relicEffects.has('gold_mult') || relicEffects.has('exp_mult') || relicEffects.has('boss_hunter')) {
        const reasons: any[] = [];
        let score = 0;
        if (relicEffects.has('event_chance')) { score += 2; reasons.push('이벤트 증가'); }
        if (relicEffects.has('drop_rate')) { score += 2; reasons.push('드롭 증가'); }
        if (relicEffects.has('gold_mult')) { score += 1; reasons.push('골드 수급'); }
        if (relicEffects.has('exp_mult')) { score += 1; reasons.push('EXP 수급'); }
        if (relicEffects.has('boss_hunter')) { score += 3; reasons.push('보스 추적'); }
        tags.push(scoreTag('explorer', '탐험 수집가', score, reasons));
    }

    if (relicEffects.has('glass_cannon') || relicEffects.has('cursed_power') || relicEffects.has('low_hp_atk') || hpRatio < 0.45) {
        const reasons: any[] = [];
        let score = 0;
        if (relicEffects.has('glass_cannon')) { score += 2; reasons.push('유리 대포'); }
        if (relicEffects.has('cursed_power')) { score += 2; reasons.push('체력 대가 화력'); }
        if (relicEffects.has('low_hp_atk')) { score += 2; reasons.push('저체력 보너스'); }
        if (hpRatio < 0.45) { score += 1; reasons.push('현재 저체력'); }
        if (relicEffects.has('ancient_power')) { score += 1; reasons.push('공격 치중'); }
        tags.push(scoreTag('risk', '광전 도박', score, reasons));
    }

    if (relicEffects.has('dot_mult') || (mainWeapon?.elem && mainWeapon.elem !== '물리')) {
        const reasons: any[] = [];
        let score = 0;
        if (relicEffects.has('dot_mult')) { score += 3; reasons.push('지속 피해 증폭'); }
        if (mainWeapon?.elem && mainWeapon.elem !== '물리') { score += 2; reasons.push(`${mainWeapon.elem} 속성 무기`); }
        if (isMagicWeapon(mainWeapon)) { score += 1; reasons.push('상태이상 스킬 연계'); }
        tags.push(scoreTag('status', '상태이상 집행자', score, reasons));
    }

    // cycle 443: score 출력 dead 정리 — sort/filter 후 외부 read 0건 (consumer는
    //   tag.name / tag.id / tag.reasons만 read). cycle 347 _sortKey strip 패턴.
    const ranked = tags
        .filter((tag: any) => tag.score >= 3)
        .sort((a: any, b: any) => b.score - a.score || a.name.localeCompare(b.name, 'ko'))
        .map(({ score: _score, ...rest }: any) => { void _score; return rest; });

    const fallbackPrimary = scoreTag('balanced', '균형형 런', 0, ['다양한 선택 가능']);
    const { score: _ps, ...fallbackPrimaryStripped } = fallbackPrimary;
    void _ps;
    const primary = ranked[0] || fallbackPrimaryStripped;

    return {
        primary,
        // cycle 268: secondary 필드 제거 — dispatch 0건이던 dead config (cycle 267 동일 lens).
        tags: ranked.slice(0, 5),
    };
};

// --- Trait functions ---

const pickTraitId = (player: Player, buildProfile: any) => {
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

const buildTraitSkill = (traitId: any, player: Player, stats: any = {}) => {
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

export const getTraitProfile = (player: Player, stats: any = {}) => {
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

    // cycle 351: rewardFocus/questFocus/bossDirective 3 redundant overrides 제거 —
    //   `...definition` spread가 이미 동일 필드 노출. 명시 override는 dead duplicate.
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
        // cycle 267: skillLabel 필드 제거 — dispatch 0건이던 dead config. 컴포넌트들은
        //   trait.skill.{name, mp, cooldown}을 직접 접근 (BuildAdvicePanel은 cooldown까지 포함).
    };
};

export const getTraitBonus = (player: Player, stats: any = {}) => getTraitProfile(player, stats).bonus;

export const getTraitSkill = (player: Player, stats: any = {}) => getTraitProfile(player, stats).skill;

export const getTraitPassiveParts = (traitProfile: any) => {
    const bonus = traitProfile?.bonus || {};
    const parts: any[] = [];
    if ((bonus.atkMult || 1) > 1) parts.push(`ATK +${toPercent((bonus.atkMult || 1) - 1)}`);
    if ((bonus.defMult || 1) > 1) parts.push(`DEF +${toPercent((bonus.defMult || 1) - 1)}`);
    if ((bonus.critBonus || 0) > 0) parts.push(`CRIT +${toPercent(bonus.critBonus || 0)}`);
    if ((bonus.mpFlat || 0) > 0) parts.push(`MP +${bonus.mpFlat}`);
    return parts;
};

// cycle 409: reasons 출력 dead 정리 — 외부 read 0건. 내부 reasons 배열은 summary
//   계산용 로컬 var로만 사용. score / label / summary는 활성 보존.
export const getTraitItemResonance = (item: Item | null | undefined, traitProfile: any, player: Player | null = null) => {
    if (!item) return { score: 0, label: null, summary: null };

    const traitId = traitProfile?.id || 'balanced';
    const reasons: any[] = [];
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
            if (['weapon', 'armor', 'shield'].includes(item?.type as string)) { score += 1; reasons.push('범용 장비'); }
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
        summary: reasons.slice(0, 2).join(' · ') || null,
    };
};

export const getTraitFeaturedItems = (items: any[] = [], traitProfile: any, player: Player | null = null, limit: any = 3) => (
    (items || [])
        .map((item: any) => ({
            item,
            resonance: getTraitItemResonance(item, traitProfile, player),
        }))
        .filter((entry: any) => entry.resonance.score >= 3)
        .sort((left: any, right: any) => right.resonance.score - left.resonance.score || (left.item.price || 0) - (right.item.price || 0))
        .slice(0, limit)
);

// cycle 354: score / label / traitName 3 출력 필드 제거 — PostCombatCard / _helpers.ts
//   addCombatDigestLogs 두 consumer 모두 traitHint.name / .summary만 read.
//   score/label/traitName — src/, tests/ 어디에서도 read 0건.
export const getTraitLootHint = (items: any[] = [], traitProfile: any, player: Player | null = null) => {
    const [best] = getTraitFeaturedItems(items, traitProfile, player, 1);
    if (!best) return null;

    return {
        name: best.item.name,
        summary: best.resonance.summary || `${traitProfile?.name || '현재 성향'}과 잘 맞는 전리품입니다.`,
    };
};

export const getTraitQuestResonance = (quest: any, traitProfile: any) => {
    if (!quest) return { score: 0, label: null, summary: null };

    const buildTags = new Set([
        traitProfile?.id,
        traitProfile?.buildProfile?.primary?.id,
        ...((traitProfile?.buildProfile?.tags || []).map((tag: any) => tag.id))
    ].filter(Boolean));

    let score = 0;
    const reasons: any[] = [];

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

// cycle 271: getRunDiagnostics export 제거 — 미완성 diagnostics 기능. production 호출 0건이라
//   tests/만 사용. paired 3 함수 (getClassBuildIdentity / Compatibility / Bonus)와 함께 cleanup.

// --- Enemy tactical profile ---

export const getEnemyTacticalProfile = (enemy: Monster, stats: any = {}) => {
    if (!enemy) return null;
    void stats; // cycle 270: stats 파라미터는 estimatedHit/estimatedHeavy 계산용이었으나 dead — 시그니처 호환 보존.

    const pattern = enemy.pattern || {};
    const guardChance = Math.max(0, Math.round((pattern.guardChance || 0) * 100));
    const heavyChance = Math.max(0, Math.round((pattern.heavyChance || 0) * 100));
    const bossBrief = enemy.isBoss ? BOSS_BRIEFS[(enemy.baseName || enemy.name) as string] : null;
    const rawPhaseHint = bossBrief?.phaseHint || (enemy.isBoss && enemy.phase2 ? 'HP 50% 이하에서 2페이즈로 전환됩니다.' : null);
    const phaseHint = rawPhaseHint && enemy.isBoss && enemy.phase2 && !rawPhaseHint.includes('50%')
        ? `${rawPhaseHint} (전환 기준 HP 50%)`
        : rawPhaseHint;
    const hint = heavyChance >= 30
        ? '강타 비중이 높습니다. 방어/회복 타이밍을 아껴두는 편이 좋습니다.'
        : guardChance >= 30
            ? '방어 빈도가 높습니다. 큰 스킬은 가드가 빠진 뒤에 쓰는 편이 좋습니다.'
            : '공격 패턴이 고른 편입니다. 안정적인 교전이 유리합니다.';

    // cycle 270: 12 dead 필드 제거 (role/tier/guardChance/heavyChance/estimatedHit/estimatedHeavy/
    //   weakness/resistance/rewardHint/warningChips/recommendedBuilds/phaseTriggered) — dispatch 0건.
    //   사용 5종만 반환 (cycle 245 hint/entryHint/phaseHint, cycle 269 signature/counterHint).
    return {
        hint,
        entryHint: bossBrief?.entryHint || null,
        signature: bossBrief?.signature || null,
        counterHint: bossBrief?.counterHint || null,
        phaseHint,
    };
};
