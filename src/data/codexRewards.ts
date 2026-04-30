/**
 * codexRewards.js — 도감 마일스톤 보상 정의
 * 각 카테고리별 발견 수에 따른 보상 + 프리미엄 재화
 */
export const CODEX_MILESTONES = {
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

/**
 * 현재 도감 상태에서 달성한 마일스톤 계산
 * @param {object} codex - player.stats.codex
 * @param {string[]} claimed - player.stats.codexClaimed (이미 보상 수령한 마일스톤 ID)
 * @returns {{ total, discovered, milestones: { category, label, reward, claimed }[], unclaimed: [] }}
 */
export const getCodexProgress = (codex = {}, claimed = []) => {
    const claimedSet = new Set(claimed);
    const milestones = [];
    const unclaimed = [];

    for (const [category, milestoneList] of Object.entries(CODEX_MILESTONES)) {
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
