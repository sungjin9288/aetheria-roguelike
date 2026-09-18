/**
 * codexRewards.js — 도감 마일스톤 보상 정의
 * 각 카테고리별 발견 수에 따른 보상 + 프리미엄 재화
 *
 * 리터럴(CODEX_MILESTONES)이 단일 진실 원천이고, 카테고리 키·마일스톤 모양·보상 키
 * 모두 여기서 `typeof`로 도출한다. 소비처(utils/codexPresentation.ts 등)는 이 타입을
 * import해서 쓰고 재선언하지 않는다.
 */
import type { Player } from '../types/index.js';

// cycle 286: export 제거 — getCodexProgress 내부에서만 사용. private const로 downgrade.
const CODEX_MILESTONES = {
    weapons: [
        { count: 5,  reward: { atk: 2 }, label: '무기 수집가 I' },
        { count: 15, reward: { atk: 4, premiumCurrency: 5 }, label: '무기 수집가 II' },
        { count: 30, reward: { atk: 6, premiumCurrency: 10 }, label: '무기 수집가 III' },
        { count: 50, reward: { atk: 10, premiumCurrency: 20 }, label: '무기 대가' },
        { count: 80, reward: { atk: 15, premiumCurrency: 30 }, label: '전설의 무기장인' },
    ],
    armors: [
        { count: 5,  reward: { def: 2 }, label: '방어구 수집가 I' },
        { count: 15, reward: { def: 4, premiumCurrency: 5 }, label: '방어구 수집가 II' },
        { count: 30, reward: { def: 8, premiumCurrency: 15 }, label: '방어구 대가' },
        { count: 50, reward: { def: 12, premiumCurrency: 25 }, label: '철벽의 수호자' },
    ],
    shields: [
        { count: 3,  reward: { def: 2 }, label: '방패 수집가 I' },
        { count: 6,  reward: { def: 4, premiumCurrency: 10 }, label: '방패 수집가 II' },
        { count: 10, reward: { def: 8, premiumCurrency: 20 }, label: '완전 방어' },
    ],
    monsters: [
        { count: 10, reward: { hp: 15 }, label: '탐험가 I' },
        { count: 25, reward: { hp: 30, premiumCurrency: 5 }, label: '탐험가 II' },
        { count: 40, reward: { hp: 50, def: 3, premiumCurrency: 10 }, label: '정복자 I' },
        { count: 60, reward: { hp: 80, atk: 3, def: 5, premiumCurrency: 20 }, label: '정복자 II' },
        { count: 80, reward: { hp: 120, atk: 5, def: 8, premiumCurrency: 35 }, label: '세계의 사냥꾼' },
        { count: 100, reward: { hp: 200, atk: 10, def: 10, premiumCurrency: 50 }, label: '만물 정복자' },
    ],
    recipes: [
        { count: 5,  reward: { gold: 2000 }, label: '견습 대장장이' },
        { count: 10, reward: { gold: 5000, premiumCurrency: 5 }, label: '숙련 대장장이' },
        { count: 20, reward: { gold: 15000, premiumCurrency: 15 }, label: '장인' },
        { count: 30, reward: { gold: 30000, premiumCurrency: 25 }, label: '전설의 장인' },
    ],
    materials: [
        { count: 5,  reward: { gold: 1000 }, label: '채집가 I' },
        { count: 10, reward: { gold: 3000, premiumCurrency: 5 }, label: '채집가 II' },
        { count: 20, reward: { gold: 8000, premiumCurrency: 15 }, label: '희귀 채집가' },
        { count: 30, reward: { gold: 20000, premiumCurrency: 25 }, label: '마스터 채집가' },
    ],
};

/** 도감 카테고리 키 — 마일스톤 리터럴에서 도출. */
export type CodexCategoryId = keyof typeof CODEX_MILESTONES;

/** 마일스톤 정의 1건(count/reward/label) — 리터럴 값에서 도출. */
type CodexMilestoneDef = (typeof CODEX_MILESTONES)[CodexCategoryId][number];

/** 유니온 각 멤버의 키를 모은다 (reward 모양이 마일스톤마다 다르다). */
type UnionKeyOf<T> = T extends unknown ? keyof T : never;

/** 도감 보상 키 — 리터럴 reward들의 키 합집합에서 도출. */
export type CodexRewardKey = UnionKeyOf<CodexMilestoneDef['reward']>;

/** 도감 보상 1건. 마일스톤마다 지급 항목이 달라 전부 선택 필드다. */
export type CodexReward = Partial<Record<CodexRewardKey, number>>;

/** getCodexProgress가 만드는 마일스톤 1건 (정의 + id/category). */
export type CodexMilestoneEntry = Omit<CodexMilestoneDef, 'reward'> & {
    id: string;
    category: CodexCategoryId;
    reward: CodexReward;
};

/** 진행 상태까지 붙은 마일스톤 1건 — `milestones` 목록의 원소. */
export type CodexMilestone = CodexMilestoneEntry & {
    reached: boolean;
    claimed: boolean;
};

/** getCodexProgress 반환값. `unclaimed`는 아직 수령하지 않은 달성 마일스톤. */
export interface CodexProgress {
    milestones: CodexMilestone[];
    unclaimed: CodexMilestoneEntry[];
}

/** 생산자(Player)에서 도출한 입력 타입 — 도감 발견 기록과 수령 완료 ID 목록. */
type PlayerCodexState = NonNullable<NonNullable<Player['stats']>['codex']>;
type ClaimedMilestoneIds = NonNullable<NonNullable<Player['stats']>['codexClaimed']>;

/**
 * 현재 도감 상태에서 달성한 마일스톤 계산
 */
// cycle 596: codex / claimed defaults 제거 — Codex:41 + cycle-286:46 (2 callers)
//   모두 명시 전달이라 두 default 모두 도달 불가. 청소 메가 시리즈 추가
//   (data/ 디렉토리 진입).
export const getCodexProgress = (
    codex: PlayerCodexState,
    claimed: ClaimedMilestoneIds,
): CodexProgress => {
    const claimedSet = new Set(claimed);
    const milestones: CodexMilestone[] = [];
    const unclaimed: CodexMilestoneEntry[] = [];

    for (const [category, milestoneList] of Object.entries(CODEX_MILESTONES) as Array<[CodexCategoryId, CodexMilestoneDef[]]>) {
        const catEntries = codex[category] || {};
        const discovered = Object.keys(catEntries).length;

        for (const ms of milestoneList) {
            const msId = `${category}_${ms.count}`;
            const reached = discovered >= ms.count;
            const isClaimed = claimedSet.has(msId);
            milestones.push({ id: msId, category, ...ms, reached, claimed: isClaimed });
            if (reached && !isClaimed) unclaimed.push({ id: msId, category, ...ms });
        }
    }

    // 전체 도감 아이템 수 (DB 기반으로 계산은 UI에서)
    return { milestones, unclaimed };
};

export const getClaimableCodexMilestone = (
    codex: PlayerCodexState,
    claimed: ClaimedMilestoneIds,
    milestoneId: string,
): CodexMilestoneEntry | null => getCodexProgress(codex, claimed).unclaimed.find((milestone) => (
    milestone.id === milestoneId
)) || null;
