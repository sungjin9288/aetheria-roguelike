import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRunShareText } from '../src/utils/runShareText.js';

/**
 * Run summary 클립보드 공유 텍스트 — Reflection 체인의 social 레이어.
 *
 * RunSummaryCard는 cycle 18에서 signaturesAcquired/signatureNames를 UI에 노출했지만
 * SHARE_TEXT(클립보드로 복사되는 자랑 텍스트)에는 여전히 kills/bosses/relics/gold만
 * 들어 있다. 전설 획득은 한 런의 가장 자랑할 만한 사건이므로, 공유 텍스트에서도
 * 별도 라인으로 칭송돼야 viral 루프가 닫힌다.
 *
 * 동시에 SHARE_TEXT 로직 자체가 컴포넌트 안에서 string template으로 잠겨 있어
 * 단위 테스트가 불가능했다. 순수 함수로 추출해 컴포넌트는 호출만 담당하게 한다.
 *
 * 계약:
 *   1. buildRunShareText는 pure function — DOM/clipboard에 의존하지 않음
 *   2. 기본 필드(레벨/직업/위치/kills/bosses/relics/gold/prestige) 모두 포함
 *   3. activeTitle이 있으면 [타이틀] prefix
 *   4. signaturesAcquired === 0이면 signature 라인 없음 (silence over noise)
 *   5. signaturesAcquired > 0이면 "전설 각인" 라벨 + 개수
 *   6. signatureNames가 있으면 개별 이름도 표기
 *   7. 해시태그(#에테리아 #AetheriaRPG) 유지 — viral metadata
 */

const baseSummary = {
    activeTitle: null,
    job: '전사',
    level: 12,
    loc: '심연 1층',
    kills: 87,
    bossKills: 3,
    relicsFound: 5,
    totalGold: 12450,
    prestigeRank: 0,
    signaturesAcquired: 0,
    signatureNames: [],
};

test('buildRunShareText returns a string with required base fields', () => {
    const text = buildRunShareText(baseSummary);
    assert.equal(typeof text, 'string');
    assert.ok(text.includes('전사'), 'job missing');
    assert.ok(text.includes('Lv.12'), 'level missing');
    assert.ok(text.includes('심연 1층'), 'location missing');
    assert.ok(text.includes('87'), 'kill count missing');
    assert.ok(/보스[^0-9]*3/.test(text), 'boss kills missing');
    assert.ok(/유물[^0-9]*5/.test(text), 'relic count missing');
    assert.ok(text.includes('12,450'), 'formatted gold missing');
});

test('buildRunShareText preserves social hashtags', () => {
    const text = buildRunShareText(baseSummary);
    assert.ok(text.includes('#에테리아') || text.includes('#AetheriaRPG'), 'hashtag missing');
});

test('buildRunShareText omits signature line when none acquired', () => {
    const text = buildRunShareText(baseSummary);
    assert.ok(!/전설 각인/.test(text), 'signature line should be silent when count is 0');
});

test('buildRunShareText emits 전설 각인 line with count when signatures acquired', () => {
    const text = buildRunShareText({
        ...baseSummary,
        signaturesAcquired: 2,
        signatureNames: ['성검 에테르니아', '마왕의 대낫'],
    });
    assert.ok(/전설 각인/.test(text), '전설 각인 label missing');
    assert.ok(/2/.test(text), 'signature count missing');
    assert.ok(text.includes('성검 에테르니아'), 'first signature name missing');
    assert.ok(text.includes('마왕의 대낫'), 'second signature name missing');
});

test('buildRunShareText prefixes activeTitle when present', async () => {
    // getTitleLabel은 string in / string out — 빈 string이어도 문제 없음
    const text = buildRunShareText({
        ...baseSummary,
        activeTitle: 'titanslayer',
    });
    // 어떤 식으로든 타이틀 brackets가 나와야 함
    assert.ok(/\[/.test(text) && /\]/.test(text), 'activeTitle brackets missing');
});

test('RunSummaryCard delegates clipboard text to buildRunShareText', async () => {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const path = await import('node:path');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = await readFile(path.join(here, '..', 'src/components/RunSummaryCard.tsx'), 'utf8');
    assert.ok(
        /import\s*\{[^}]*buildRunShareText[^}]*\}\s*from\s*['"][^'"]*runShareText/.test(source),
        'RunSummaryCard should import buildRunShareText'
    );
    assert.ok(
        /buildRunShareText\(/.test(source),
        'RunSummaryCard should call buildRunShareText to produce clipboard text'
    );
});

// cycle 65: primaryBuild + difficultyLabel 라인 자랑 텍스트 추가.
test('buildRunShareText includes primaryBuild + difficulty when provided', () => {
    const text = buildRunShareText({
        ...baseSummary,
        primaryBuild: '쌍수 연격',
        difficultyLabel: '균형',
    });
    assert.ok(text.includes('쌍수 연격'), 'primaryBuild missing');
    assert.ok(text.includes('균형'), 'difficultyLabel missing');
    assert.ok(text.includes('🎯'), 'build emoji missing');
    assert.ok(text.includes('📊'), 'difficulty emoji missing');
});

test('buildRunShareText silently omits build line when both fields missing', () => {
    const text = buildRunShareText({
        ...baseSummary,
        primaryBuild: undefined,
        difficultyLabel: undefined,
    });
    assert.ok(!text.includes('🎯'), 'build emoji should be silent');
    assert.ok(!text.includes('📊'), 'difficulty emoji should be silent');
});

test('buildRunShareText shows only primaryBuild when difficulty missing', () => {
    const text = buildRunShareText({
        ...baseSummary,
        primaryBuild: '비전 공명',
        difficultyLabel: null,
    });
    assert.ok(text.includes('비전 공명'));
    assert.ok(text.includes('🎯'));
    assert.ok(!text.includes('📊'), 'difficulty emoji silent without label');
});

// cycle 78: 도주 카운트 라인 — buildRunSummary가 stats.escapes를 노출하면
// reflection share text도 한 줄로 자랑.
test('buildRunShareText silently omits escape line when escapes=0', () => {
    const text = buildRunShareText({ ...baseSummary, escapes: 0 });
    assert.ok(!text.includes('🏃'), 'escape emoji should be silent at 0');
});

test('buildRunShareText shows escape line when escapes > 0', () => {
    const text = buildRunShareText({ ...baseSummary, escapes: 7 });
    assert.ok(text.includes('🏃'), 'escape emoji should appear');
    assert.ok(text.includes('7회'), 'escape count visible');
});

test('buildRunShareText escape line silent when field missing', () => {
    const summary = { ...baseSummary };
    delete summary.escapes;
    const text = buildRunShareText(summary);
    assert.ok(!text.includes('🏃'));
});
