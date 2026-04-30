import { getTitleLabel } from './gameUtils.js';

/**
 * buildRunShareText — RunSummaryCard 클립보드 공유용 자랑 텍스트.
 *
 * 컴포넌트 안에 갇혀 있던 SHARE_TEXT 템플릿을 순수 함수로 추출해
 * 단위 테스트가 가능하도록 만들고, signaturesAcquired 라인을 추가했다.
 *
 * @param {object} s - buildRunSummary가 만든 run summary 객체
 * @returns {string} 클립보드/공유용 멀티라인 텍스트
 */
export const buildRunShareText = (s) => {
    const titlePrefix = s?.activeTitle ? `[${getTitleLabel(s.activeTitle)}] ` : '';
    const job = s?.job ?? '';
    const level = s?.level ?? 0;
    const loc = s?.loc ?? '';
    const kills = (s?.kills ?? 0).toLocaleString();
    const bossKills = s?.bossKills ?? 0;
    const relicsFound = s?.relicsFound ?? 0;
    const totalGold = (s?.totalGold ?? 0).toLocaleString();
    const prestigeRank = s?.prestigeRank ?? 0;

    const signatureCount = s?.signaturesAcquired ?? 0;
    const signatureNames = Array.isArray(s?.signatureNames) ? s.signatureNames : [];

    // 전설 각인 라인 — 0개면 silent, >0이면 자랑 라인 추가
    let signatureLine = '';
    if (signatureCount > 0) {
        const head = `✦ 전설 각인: ${signatureCount}종 획득`;
        const detail = signatureNames.length > 0
            ? `\n   ${signatureNames.map((n) => `✦ ${n}`).join(' · ')}`
            : '';
        signatureLine = `\n${head}${detail}`;
    }

    return `⚔️ AETHERIA RUN ENDED
─────────────────────
${titlePrefix}${job} Lv.${level}
📍 ${loc}에서 전사

🗡️ 처치: ${kills}마리 (보스 ${bossKills}회)
💎 유물: ${relicsFound}개 수집
💰 총 골드: ${totalGold}
⚡ 프레스티지: ${prestigeRank}랭크${signatureLine}

#에테리아 #AetheriaRPG #로그라이크`;
};
