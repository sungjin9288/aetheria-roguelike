import { BOSS_BRIEFS } from '../data/monsters.js';
import { getDifficultyMults, calcPerformanceScore } from '../systems/DifficultyManager.js';
import { getExploreState } from './explorationPacing.js';
import { isFocusOffhand, isMagicWeapon, isShield, isTwoHandWeapon, isWeapon } from './equipmentUtils.js';

const ARCHETYPE_LABELS = Object.freeze({
    balanced: '균형형 런',
    crusher: '양손 파쇄',
    dual: '쌍수 연격',
    fortress: '방패 요새',
    arcane: '비전 공명',
    explorer: '탐험 수집가',
    risk: '광전 도박',
    status: '상태이상 집행자',
});

const TRAIT_DEFINITIONS = Object.freeze({
    balanced: {
        id: 'balanced',
        name: '균형',
        title: '유연한 방랑자',
        accent: 'text-cyber-blue',
        chipClass: 'border-cyber-blue/30 bg-cyber-blue/10 text-cyber-blue',
        desc: '어느 쪽에도 치우치지 않은 기본 전투 감각입니다.',
        passiveLabel: 'ATK +3% / DEF +3% / CRIT +1%',
        unlockHint: '모든 무기군을 무난하게 다룰 수 있습니다.',
        bonus: { atkMult: 1.03, defMult: 1.03, critBonus: 0.01 },
        skill: { name: '전환 태세', type: 'buff', effect: 'all_up', val: 1.18, turn: 2, mp: 16, cooldown: 3, desc: '짧은 시간 공격과 방어를 함께 끌어올립니다.' },
    },
    crusher: {
        id: 'crusher',
        name: '파쇄',
        title: '파쇄 본능',
        accent: 'text-amber-300',
        chipClass: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
        desc: '무거운 한 방으로 전열을 무너뜨리는 성향입니다.',
        passiveLabel: 'ATK +10% / CRIT +1%',
        unlockHint: '양손 무기에서 성향 스킬 효율이 가장 높습니다.',
        bonus: { atkMult: 1.1, critBonus: 0.01 },
        skill: { name: '파쇄 강타', type: '물리', effect: 'stun', mult: 3.15, mp: 20, cooldown: 3, desc: '강한 단일 일격으로 적을 흔듭니다.' },
    },
    dual: {
        id: 'dual',
        name: '연계',
        title: '연계 사냥꾼',
        accent: 'text-cyan-300',
        chipClass: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
        desc: '치명타와 연속 타격으로 흐름을 잡는 성향입니다.',
        passiveLabel: 'ATK +5% / CRIT +6%',
        unlockHint: '한손 + 한손, 한손 + 보조 세팅에서 가장 안정적입니다.',
        bonus: { atkMult: 1.05, critBonus: 0.06 },
        skill: { name: '연쇄 베기', type: '물리', effect: 'bleed', mult: 2.25, mp: 18, cooldown: 2, desc: '재빠른 연속 베기로 출혈을 노립니다.' },
    },
    fortress: {
        id: 'fortress',
        name: '수호',
        title: '전열 수호자',
        accent: 'text-emerald-300',
        chipClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
        desc: '방패, 반격, 버티기에 강한 안정형 성향입니다.',
        passiveLabel: 'DEF +10% / CRIT BLOCK 강화',
        unlockHint: '방패와 중갑, 장기전 운영에 유리합니다.',
        bonus: { defMult: 1.1 },
        skill: { name: '수호 방벽', type: 'buff', effect: 'def_up', val: 1.35, turn: 3, mp: 16, cooldown: 3, desc: '짧은 시간 방어력을 크게 높입니다.' },
    },
    arcane: {
        id: 'arcane',
        name: '비전',
        title: '비전 공명자',
        accent: 'text-violet-300',
        chipClass: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
        desc: '마나 순환과 속성 스킬 활용에 특화된 성향입니다.',
        passiveLabel: 'ATK +6% / MP +10 / CRIT +2%',
        unlockHint: '주문서·지팡이·속성 무기에서 추가 스킬이 활성화됩니다.',
        bonus: { atkMult: 1.06, mpFlat: 10, critBonus: 0.02 },
        skill: { name: '비전 파동', type: '빛', effect: 'stun', mult: 2.7, mp: 22, cooldown: 2, desc: '속성 공명을 터뜨려 적을 흔듭니다.' },
    },
    explorer: {
        id: 'explorer',
        name: '개척',
        title: '개척 감각',
        accent: 'text-teal-300',
        chipClass: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
        desc: '탐험과 발견, 리듬 운영을 중시하는 성향입니다.',
        passiveLabel: 'ATK +4% / DEF +4%',
        unlockHint: '탐험 루프와 보스 진입 타이밍이 더 안정적입니다.',
        bonus: { atkMult: 1.04, defMult: 1.04 },
        skill: { name: '개척자의 호흡', type: 'buff', effect: 'all_up', val: 1.15, turn: 2, mp: 14, cooldown: 3, desc: '짧은 전술 정비로 전열을 가다듬습니다.' },
    },
    risk: {
        id: 'risk',
        name: '도박',
        title: '혈투 도박사',
        accent: 'text-rose-300',
        chipClass: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
        desc: '위험을 감수하고 순간 화력을 극대화하는 성향입니다.',
        passiveLabel: 'ATK +8% / CRIT +4%',
        unlockHint: '체력 관리가 어렵지만 폭발력이 가장 큽니다.',
        bonus: { atkMult: 1.08, critBonus: 0.04 },
        skill: { name: '혈로 돌파', type: 'buff', effect: 'berserk', val: 1.55, turn: 2, mp: 15, cooldown: 3, desc: '방어를 낮추는 대신 폭발적인 화력을 끌어냅니다.' },
    },
    status: {
        id: 'status',
        name: '집행',
        title: '상태 집행자',
        accent: 'text-fuchsia-300',
        chipClass: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300',
        desc: '속성과 상태이상 누적으로 적을 압박하는 성향입니다.',
        passiveLabel: 'ATK +5% / CRIT +2%',
        unlockHint: '속성 무기와 디버프 운영에 가장 잘 맞습니다.',
        bonus: { atkMult: 1.05, critBonus: 0.02 },
        skill: { name: '집행 각인', type: '어둠', effect: 'curse', mult: 2.45, mp: 20, cooldown: 2, desc: '적에게 속성 저주를 새겨 누적 압박을 만듭니다.' },
    },
});

const ELEMENT_TO_STATUS = Object.freeze({
    화염: 'burn',
    냉기: 'freeze',
    자연: 'poison',
    어둠: 'curse',
    빛: 'stun',
    대지: 'stun',
    물리: 'bleed',
});

const CLASS_BUILD_IDENTITIES = Object.freeze({
    모험가: {
        label: '개척형',
        desc: '탐험과 기본기 중심으로 어떤 축이든 무난하게 시작할 수 있습니다.',
        preferredTags: ['explorer', 'balanced'],
        synergies: [
            { tags: ['explorer'], label: '개척자의 감각', desc: '탐험 수집형 런에서 균형 스탯을 받습니다.', bonus: { atkMult: 1.03, defMult: 1.03, hpFlat: 12, mpFlat: 6 } },
            { tags: ['balanced'], label: '기본기 완성', desc: '아직 축이 선명하지 않아도 안정성을 확보합니다.', bonus: { defMult: 1.04, hpFlat: 15 } },
        ],
    },
    전사: {
        label: '전열 압박',
        desc: '양손 화력과 중갑 교전에서 강점을 발휘합니다.',
        preferredTags: ['crusher', 'fortress'],
        synergies: [
            { tags: ['crusher'], label: '양손 숙련', desc: '양손 무기 운용 시 강한 마무리 화력을 얻습니다.', bonus: { atkMult: 1.08, hpFlat: 18 } },
            { tags: ['fortress'], label: '중갑 대응', desc: '방패/중갑 운용 시 방어력이 더 잘 살아납니다.', bonus: { defMult: 1.08, hpFlat: 20 } },
        ],
    },
    나이트: {
        label: '수호 전열',
        desc: '방패 운영과 장기전 안정성이 핵심입니다.',
        preferredTags: ['fortress', 'arcane'],
        synergies: [
            { tags: ['fortress'], label: '방패 교전술', desc: '방패 빌드일 때 가장 안정적인 전열을 형성합니다.', bonus: { defMult: 1.1, hpFlat: 24 } },
            { tags: ['arcane'], label: '성광 보조', desc: '빛 속성/성스러운 스킬 운용을 보조합니다.', bonus: { defMult: 1.05, mpFlat: 12 } },
        ],
    },
    버서커: {
        label: '광전 압살',
        desc: '양손 돌파와 저체력 고화력 런에 최적화됩니다.',
        preferredTags: ['crusher', 'risk'],
        synergies: [
            { tags: ['crusher'], label: '파쇄 본능', desc: '양손 런에서 강한 일격이 더 위력적입니다.', bonus: { atkMult: 1.1, critBonus: 0.01 } },
            { tags: ['risk'], label: '광전 각성', desc: '위험을 감수하는 런일수록 화력이 살아납니다.', bonus: { atkMult: 1.08, critBonus: 0.02 } },
        ],
    },
    '드래곤 나이트': {
        label: '용혈 돌격',
        desc: '양손 화염 화력과 압도적인 마무리 능력이 핵심입니다.',
        preferredTags: ['crusher', 'risk'],
        synergies: [
            { tags: ['crusher'], label: '용창 강타', desc: '양손 빌드에서 강타 화력이 크게 살아납니다.', bonus: { atkMult: 1.1, hpFlat: 12 } },
            { tags: ['risk'], label: '혈룡 광란', desc: '리스크형 빌드에서 치명타와 화력이 강화됩니다.', bonus: { atkMult: 1.08, critBonus: 0.02 } },
        ],
    },
    마법사: {
        label: '원소 공명',
        desc: '마도서와 속성 시너지 빌드를 가장 잘 활용합니다.',
        preferredTags: ['arcane', 'status'],
        synergies: [
            { tags: ['arcane'], label: '원소 순환', desc: 'MP 회전과 스킬 화력이 안정적으로 오릅니다.', bonus: { atkMult: 1.09, mpFlat: 18 } },
            { tags: ['status'], label: '상태 폭주', desc: '속성/상태이상 런의 누적 압박이 좋아집니다.', bonus: { atkMult: 1.06, critBonus: 0.01 } },
        ],
    },
    아크메이지: {
        label: '비전 지배',
        desc: '고MP 고화력 비전 런에 가장 강한 정체성을 가집니다.',
        preferredTags: ['arcane', 'status'],
        synergies: [
            { tags: ['arcane'], label: '비전 폭주', desc: '비전 공명 빌드의 최대 MP와 화력을 밀어 올립니다.', bonus: { atkMult: 1.1, mpFlat: 24 } },
            { tags: ['status'], label: '원소 잔향', desc: '상태이상 집행 빌드의 마무리를 보조합니다.', bonus: { atkMult: 1.06, mpFlat: 10 } },
        ],
    },
    '대마법사': {
        label: '절대 원소',
        desc: '끝까지 MP를 굴리는 장기전 비전 런에 최적화됩니다.',
        preferredTags: ['arcane', 'status'],
        synergies: [
            { tags: ['arcane'], label: '절대 공명', desc: '마도서/지팡이 운용에서 MP와 화력이 가장 높습니다.', bonus: { atkMult: 1.11, mpFlat: 26 } },
            { tags: ['status'], label: '잔류 재해', desc: '지속 피해와 속성 딜을 함께 올립니다.', bonus: { atkMult: 1.07, critBonus: 0.01 } },
        ],
    },
    흑마법사: {
        label: '저주 집행',
        desc: '위험한 대가와 상태이상 빌드를 가장 잘 받아냅니다.',
        preferredTags: ['status', 'risk'],
        synergies: [
            { tags: ['status'], label: '저주 각인', desc: '상태이상 누적 딜과 마도 공격이 강화됩니다.', bonus: { atkMult: 1.07, mpFlat: 12 } },
            { tags: ['risk'], label: '생명 대가', desc: '위험한 런에서 마무리 화력이 더욱 크게 튑니다.', bonus: { atkMult: 1.08, critBonus: 0.02 } },
        ],
    },
    성직자: {
        label: '성광 보조',
        desc: '비전 운용과 안정적인 생존 보조에 특화됩니다.',
        preferredTags: ['arcane', 'fortress'],
        synergies: [
            { tags: ['arcane'], label: '신성 순환', desc: '빛 속성/마도 운용이 더 안정적으로 이어집니다.', bonus: { atkMult: 1.06, mpFlat: 16 } },
            { tags: ['fortress'], label: '수호 기도', desc: '방패/생존형 세팅에서 유지력이 더 좋아집니다.', bonus: { defMult: 1.08, hpFlat: 18 } },
        ],
    },
    팔라딘: {
        label: '성역 수호',
        desc: '방패와 빛 속성 빌드를 함께 밀어주는 방어형 하이브리드입니다.',
        preferredTags: ['fortress', 'arcane'],
        synergies: [
            { tags: ['fortress'], label: '성역 방벽', desc: '방패 빌드에서 가장 높은 안정성을 냅니다.', bonus: { defMult: 1.1, hpFlat: 24 } },
            { tags: ['arcane'], label: '성광 순환', desc: '빛/마도 빌드의 MP 여유를 보강합니다.', bonus: { atkMult: 1.05, mpFlat: 14 } },
        ],
    },
    도적: {
        label: '약점 포착',
        desc: '쌍수와 리스크 런에서 치명타를 극대화합니다.',
        preferredTags: ['dual', 'risk'],
        synergies: [
            { tags: ['dual'], label: '쌍수 숙련', desc: '쌍수 연격 빌드에서 치명타 빈도가 올라갑니다.', bonus: { atkMult: 1.05, critBonus: 0.04 } },
            { tags: ['risk'], label: '그림자 도박', desc: '위험한 런일수록 급소 화력이 커집니다.', bonus: { atkMult: 1.06, critBonus: 0.03 } },
        ],
    },
    어쌔신: {
        label: '암살 교리',
        desc: '쌍수와 상태이상, 급소 빌드에서 가장 높은 치명타 효율을 냅니다.',
        preferredTags: ['dual', 'status'],
        synergies: [
            { tags: ['dual'], label: '암살 연계', desc: '쌍수 빌드의 치명타와 마무리 화력이 강화됩니다.', bonus: { atkMult: 1.06, critBonus: 0.05 } },
            { tags: ['status'], label: '독살 숙련', desc: '상태이상 런에서 지속 압박을 강화합니다.', bonus: { atkMult: 1.05, critBonus: 0.02 } },
        ],
    },
    '그림자 주군': {
        label: '절명 그림자',
        desc: '쌍수, 상태이상, 고위험 런을 모두 강하게 받습니다.',
        preferredTags: ['dual', 'risk', 'status'],
        synergies: [
            { tags: ['dual'], label: '그림자 연쇄', desc: '쌍수 런에서 즉결 화력이 크게 오릅니다.', bonus: { atkMult: 1.07, critBonus: 0.05 } },
            { tags: ['risk'], label: '허무 베기', desc: '위험한 런에서 치명타 기대값이 더 올라갑니다.', bonus: { atkMult: 1.08, critBonus: 0.03 } },
        ],
    },
    레인저: {
        label: '추적 사냥',
        desc: '상태이상과 탐험형 빌드를 묶어 긴 탐험 루프에 강합니다.',
        preferredTags: ['status', 'explorer'],
        synergies: [
            { tags: ['status'], label: '속성 사격', desc: '속성/상태이상 빌드의 누적 딜을 보조합니다.', bonus: { atkMult: 1.05, critBonus: 0.02 } },
            { tags: ['explorer'], label: '추적 감각', desc: '탐험과 보스 추적 런에서 전투 안정성이 올라갑니다.', bonus: { atkMult: 1.04, defMult: 1.04 } },
        ],
    },
    '사냥의 군주': {
        label: '지배 사냥',
        desc: '상태이상과 탐험 루프, 보스 추적을 가장 잘 받는 성장형 클래스입니다.',
        preferredTags: ['status', 'explorer'],
        synergies: [
            { tags: ['status'], label: '지배 화살', desc: '속성/상태이상 빌드의 화력이 더 안정적으로 유지됩니다.', bonus: { atkMult: 1.06, critBonus: 0.02 } },
            { tags: ['explorer'], label: '사냥 본능', desc: '탐험형 빌드에서 공격과 방어를 동시에 보강합니다.', bonus: { atkMult: 1.04, defMult: 1.04, hpFlat: 12 } },
        ],
    },
});

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

const pickTraitId = (player, buildProfile) => {
    const relicEffects = relicEffectsOf(player);
    const primaryId = buildProfile.primary.id;
    if (primaryId === 'risk') {
        const hasRealRiskBuild = relicEffects.has('glass_cannon')
            || relicEffects.has('cursed_power')
            || relicEffects.has('low_hp_atk')
            || (player?.stats?.lowHpWins || 0) >= 2;
        return hasRealRiskBuild ? 'risk' : 'balanced';
    }
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
    const reasons = [...buildProfile.primary.reasons.slice(0, 2)];

    if (traitId === 'explorer' && (behaviorStats.explores || 0) > 0) reasons.push(`탐험 ${behaviorStats.explores}회`);
    if (traitId === 'fortress' && (behaviorStats.rests || 0) > 0) reasons.push(`휴식 ${behaviorStats.rests}회`);
    if (traitId === 'balanced' && (behaviorStats.crafts || 0) > 0) reasons.push(`제작 ${behaviorStats.crafts}회`);
    if (traitId === 'risk' && (behaviorStats.lowHpWins || 0) > 0) reasons.push(`저체력 승리 ${behaviorStats.lowHpWins}회`);

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
        signature: bossBrief?.signature || null,
        counterHint: bossBrief?.counterHint || null,
        phaseHint,
        recommendedBuilds: bossBrief?.recommendedBuilds || [],
        phaseTriggered: Boolean(enemy.phase2Triggered),
    };
};
