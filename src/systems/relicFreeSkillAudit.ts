import type { ClassDef } from '../types/class.js';
import type { Relic } from '../types/relic.js';
import { getStrongestNumericRelicValue } from './CombatEngine.actions.js';

type RelicSynergy = {
    bonus?: {
        effect?: unknown;
        freeSkillChance?: unknown;
    };
};

export interface RelicFreeSkillReport {
    schemaVersion: 1;
    predecessor: {
        spellEchoChance: number;
        timeRingChance: number;
    };
    candidate: {
        spellEchoChance: number;
        timeRingChance: number;
        bothOrdersChance: [number, number];
    };
    synergy: {
        addedChance: number;
        spellEchoCombined: number;
        timeRingCombined: number;
    };
    jobMatrix: Array<{
        job: string;
        representativeSkill: string;
        mpCost: number;
        expectedMpSavedPerUse: {
            predecessorUncommon: number;
            candidateUncommon: number;
            epic: number;
        };
    }>;
    errors: string[];
}

const compareText = (left: string, right: string) => (
    left < right ? -1 : left > right ? 1 : 0
);

const CANONICAL_JOBS = Object.freeze([
    '모험가', '전사', '마법사', '도적', '나이트', '버서커', '아크메이지', '흑마법사',
    '어쌔신', '레인저', '성직자', '팔라딘', '드래곤 나이트', '대마법사', '그림자 주군',
    '무당', '시간술사', '사냥의 군주',
] as const);

const isFiniteChance = (value: unknown): value is number => (
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
);

export const canonicalizeRelicFreeSkillReport = (
    report: RelicFreeSkillReport,
): RelicFreeSkillReport => ({
    schemaVersion: 1,
    predecessor: { ...report.predecessor },
    candidate: {
        spellEchoChance: report.candidate.spellEchoChance,
        timeRingChance: report.candidate.timeRingChance,
        bothOrdersChance: [...report.candidate.bothOrdersChance] as [number, number],
    },
    synergy: { ...report.synergy },
    jobMatrix: report.jobMatrix.map((row) => ({
        job: row.job,
        representativeSkill: row.representativeSkill,
        mpCost: row.mpCost,
        expectedMpSavedPerUse: { ...row.expectedMpSavedPerUse },
    })).sort((left, right) => compareText(left.job, right.job)),
    errors: [...new Set(report.errors)].sort(compareText),
});

export const buildRelicFreeSkillReport = ({
    relics,
    synergies,
    classes,
}: {
    relics: readonly Relic[];
    synergies: readonly RelicSynergy[];
    classes: Readonly<Record<string, ClassDef>>;
}): RelicFreeSkillReport => {
    const errors = new Set<string>();
    const family = relics.filter((relic) => relic.effect === 'free_skill');
    const spellEcho = family.find((relic) => relic.id === 'spell_echo');
    const timeRing = family.find((relic) => relic.id === 'time_ring');

    const familyIds = family.map((relic) => (
        typeof relic.id === 'string' ? relic.id : ''
    )).sort(compareText);
    if (family.length !== 2
        || familyIds[0] !== 'spell_echo'
        || familyIds[1] !== 'time_ring') {
        errors.add('FREE_SKILL_FAMILY_IDS_MISMATCH');
    }

    const spellEchoChance = isFiniteChance(spellEcho?.val) ? spellEcho.val : 0;
    const timeRingChance = isFiniteChance(timeRing?.val) ? timeRing.val : 0;
    if (spellEcho?.rarity !== 'uncommon'
        || spellEchoChance !== 0.08
        || typeof spellEcho?.desc !== 'string'
        || !/8%.*기력을 소모하지 않음/.test(spellEcho.desc)) {
        errors.add('SPELL_ECHO_POLICY_MISMATCH');
    }
    if (timeRing?.rarity !== 'epic'
        || timeRingChance !== 0.15
        || typeof timeRing?.desc !== 'string'
        || !/15%.*기력을 소모하지 않음/.test(timeRing.desc)
        || /재사용 대기/.test(timeRing.desc)) {
        errors.add('TIME_RING_POLICY_MISMATCH');
    }

    let bothOrdersChance: [number, number] = [0, 0];
    if (spellEcho && timeRing && isFiniteChance(spellEcho.val) && isFiniteChance(timeRing.val)) {
        bothOrdersChance = [
            getStrongestNumericRelicValue([spellEcho, timeRing], 'free_skill'),
            getStrongestNumericRelicValue([timeRing, spellEcho], 'free_skill'),
        ];
    }
    if (bothOrdersChance[0] !== 0.15 || bothOrdersChance[1] !== 0.15) {
        errors.add('FREE_SKILL_STACKING_POLICY_MISMATCH');
    }

    const arcaneSingularity = synergies.find((synergy) => (
        synergy.bonus?.effect === 'arcane_singularity'
    ));
    const addedChance = isFiniteChance(arcaneSingularity?.bonus?.freeSkillChance)
        ? arcaneSingularity.bonus.freeSkillChance
        : 0;
    if (addedChance !== 0.35) errors.add('ARCANE_SINGULARITY_MISMATCH');

    const classJobs = Object.keys(classes);
    if (classJobs.length !== CANONICAL_JOBS.length) errors.add('JOB_COUNT_MISMATCH');
    const canonicalJobSet = new Set<string>(CANONICAL_JOBS);
    classJobs.filter((job) => !canonicalJobSet.has(job))
        .forEach((job) => errors.add(`JOB_UNKNOWN:${job}`));
    CANONICAL_JOBS.filter((job) => !Object.hasOwn(classes, job))
        .forEach((job) => errors.add(`JOB_MISSING:${job}`));

    const jobMatrix = CANONICAL_JOBS.map((job) => {
        const classData = classes[job];
        const skill = Array.isArray(classData?.skills)
            ? classData.skills.find((entry) => entry.passive !== true)
            : undefined;
        const representativeSkill = typeof skill?.name === 'string' && skill.name.length > 0
            ? skill.name
            : '';
        const mpCost = typeof skill?.mp === 'number' && Number.isFinite(skill.mp) && skill.mp > 0
            ? skill.mp
            : 0;
        if (!representativeSkill) errors.add(`JOB_SKILL_MISSING:${job}`);
        if (mpCost === 0) errors.add(`JOB_SKILL_MP_INVALID:${job}`);
        return {
            job,
            representativeSkill,
            mpCost,
            expectedMpSavedPerUse: {
                predecessorUncommon: mpCost * 0.15,
                candidateUncommon: mpCost * spellEchoChance,
                epic: mpCost * timeRingChance,
            },
        };
    });

    return canonicalizeRelicFreeSkillReport({
        schemaVersion: 1,
        predecessor: {
            spellEchoChance: 0.15,
            timeRingChance: 0.15,
        },
        candidate: {
            spellEchoChance,
            timeRingChance,
            bothOrdersChance,
        },
        synergy: {
            addedChance,
            spellEchoCombined: spellEchoChance + addedChance,
            timeRingCombined: timeRingChance + addedChance,
        },
        jobMatrix,
        errors: [...errors],
    });
};
