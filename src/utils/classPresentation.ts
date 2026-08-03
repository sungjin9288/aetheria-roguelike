import type { ClassDef } from '../types/class.js';

export type ClassStatGrade = '낮음' | '보통' | '높음' | '매우 높음';

export const getClassStatGrade = (value = 1): ClassStatGrade => {
    if (value < 0.8) return '낮음';
    if (value < 1.15) return '보통';
    if (value < 1.5) return '높음';
    return '매우 높음';
};

export const getClassIdentity = (description = '') => {
    const [rawFocus = '', ...identityParts] = description.split('—');
    const focus = rawFocus
        .trim()
        .replaceAll('/', ' · ')
        .replace(/\s*특화$/, ' 중심');
    const identity = identityParts.join('—').trim();

    return {
        focus: focus || '균형 있는 성장',
        identity: identity || focus || '자신만의 방식으로 싸우는 모험가',
    };
};

export const getActiveClassSkillNames = (classData?: ClassDef, limit = 3): string[] => (
    (classData?.skills || [])
        .filter((skill) => !skill.passive && skill.name)
        .slice(0, limit)
        .map((skill) => skill.name as string)
);
