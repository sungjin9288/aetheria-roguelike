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
export const buildRunShareText = (s: any) => {
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
            ? `\n   ${signatureNames.map((n: any) => `✦ ${n}`).join(' · ')}`
            : '';
        signatureLine = `\n${head}${detail}`;
    }

    // cycle 65: 빌드 + 난이도 라벨 — 자랑 텍스트에 플레이 스타일 노출
    const primaryBuild = s?.primaryBuild;
    const difficultyLabel = s?.difficultyLabel;
    let buildLine = '';
    if (primaryBuild || difficultyLabel) {
        const parts: string[] = [];
        if (primaryBuild) parts.push(`🎯 빌드: ${primaryBuild}`);
        if (difficultyLabel) parts.push(`📊 ${difficultyLabel}`);
        buildLine = `\n${parts.join(' · ')}`;
    }

    // cycle 78: 도주 누적 카운트 — 0이면 silent ("silence over noise"),
    // >0이면 보수적 운영 자랑 라인. cycle 74 stats.escapes 도입 + cycle 76/77
    // quest/title 통합 후 reflection 단계까지 한 줄 노출 완성.
    const escapeCount = s?.escapes ?? 0;
    const escapeLine = escapeCount > 0 ? `\n🏃 도주 ${escapeCount}회 — 위험 회피 운영` : '';

    return `⚔️ AETHERIA RUN ENDED
─────────────────────
${titlePrefix}${job} Lv.${level}
📍 ${loc}에서 전사

🗡️ 처치: ${kills}마리 (보스 ${bossKills}회)
💎 유물: ${relicsFound}개 수집
💰 총 골드: ${totalGold}
⚡ 프레스티지: ${prestigeRank}랭크${buildLine}${escapeLine}${signatureLine}

#에테리아 #AetheriaRPG #로그라이크`;
};
