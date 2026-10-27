/**
 * 기술 성장(분기) 선택이 새로 열리는 순간 — 소유자 결정 D5(2026-10-26, 감사 CL-08).
 *
 * 분기는 직업이 가진 데이터(`CLASSES[*].skillBranches`)라 직업을 얻을 때 열린다: 여정 시작(이전 직업 없음)과 전직.
 * 레벨 상승만으로는 열리지 않는다(직업 기술은 레벨로 잠기지 않는다). 기록 한 줄은 그 직업 전이가 낸다 — 이 판정이
 * 무엇이 "새로" 열렸는지를 정한다: 다음 직업의 분기 기술 중 이전 직업에 이미 있던 것 · 이미 고른 것은 빼서
 * 같은 분기를 두 번 알리지 않는다. 고르지 않은 채로 남은 분기를 다시 알리는 경로(반복 안내)는 두지 않는다.
 */
import { CLASSES } from '../data/classes';
import { MSG } from '../data/messages';

const getBranchSkillNames = (job: string | null | undefined): string[] => (
    job ? Object.keys(CLASSES[job]?.skillBranches || {}) : []
);

/** `previousJob`(여정 시작이면 `null`)에서 `nextJob`으로 바뀔 때 새로 고를 수 있게 된 분기 기술 이름(데이터 순서). */
export const getOpenedSkillBranchSkills = (
    previousJob: string | null | undefined,
    nextJob: string,
    skillChoices: Readonly<Record<string, string>> | null | undefined,
): string[] => {
    const alreadyOpen = new Set(getBranchSkillNames(previousJob));
    return getBranchSkillNames(nextJob)
        .filter((skillName) => !alreadyOpen.has(skillName) && !skillChoices?.[skillName]);
};

/** 직업 전이의 기록 한 줄 — 새로 열린 분기가 없으면 `null`. */
export const getSkillBranchOpenedLog = (
    previousJob: string | null | undefined,
    nextJob: string,
    skillChoices: Readonly<Record<string, string>> | null | undefined,
): string | null => {
    const opened = getOpenedSkillBranchSkills(previousJob, nextJob, skillChoices);
    return opened.length > 0 ? MSG.SKILL_BRANCH_OPENED(opened) : null;
};
