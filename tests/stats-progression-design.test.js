import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { readFile } from 'node:fs/promises';

import StatsPanel from '../src/components/StatsPanel.tsx';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * Wave 5 W3-B — stats-progression-design.test.js 원본 계약(소스 텍스트 grep):
 *
 *   1. "현재 성장"(stats-current-growth) → "핵심 기록"(stats-core-records) →
 *      "세부 기록"(stats-lifetime-records) 순으로 섹션이 배치된다(우선순위 = DOM 순서).
 *   2. 핵심 기록은 레벨/총 처치/보스 처치/최대 연속 처치 4개만 상시 노출하고,
 *      나머지(사망/현상수배/탐험 등)는 세부 기록 details 안에 접혀 들어간다.
 *   3. 세부 기록/처치 분포/계승 기록은 모두 <details>(기본 접힘)이고, 각 라벨
 *      (사망, 현상수배 완료, 처치/사망, 누적 골드, 탐험 횟수, 발견 지역, 휴식 횟수,
 *      도주 횟수, 제작 횟수, 합성 횟수, 완료한 발견 여정)이 실제로 노출된다.
 *   4. 작은 문구(8~10.5px)와 영문 대문자 장식(uppercase/tracking)을 쓰지 않는다.
 *   5. signature 세트/prefix 세트/유물 조합 보너스가 실제 배율 텍스트(±N%)로 렌더된다.
 *
 * 아래는 이 계약을 실제 렌더 결과로 검증한다. 단 uppercase/tracking-[] 부분은
 * SignalBadge 등 자식 컴포넌트의 디자인 토큰과 뒤섞여 렌더되므로, StatsPanel
 * 자신의 소스 텍스트로만 검증하는 구조 불변식으로 남긴다(아래 표기 참고).
 */

const buildStatsFixture = () => ({
    maxHp: 200,
    maxMp: 60,
    activeSignatureSet: {
        key: 'sig-fire', name: '화염 세트', tier: 2, tone: 'fire',
        desc: '화염 피해를 강화한다', atkMult: 1.18, defMult: 1.0, hpMult: 0.9,
    },
    activeSet: { prefix: '불타는', desc: '불타는 세트 보너스' },
    activeSynergies: [{ label: '조합 알파', desc: '전투 시 추가 확률 이벤트가 발생한다' }],
});

const buildPlayerFixture = () => makePlayerFixture({
    level: 12,
    stats: {
        kills: 40, deaths: 3, total_gold: 1200, bossKills: 2, bountiesCompleted: 1,
        killRegistry: { '슬라임': 10, '고블린': 5 },
        explores: 22, visitedMaps: ['시작의 마을', '고요한 숲'], rests: 4, escapes: 1,
        crafts: 2, syntheses: 1, maxKillStreak: 6, discoveryChains: ['첫 발견 여정'],
    },
    meta: { essence: 40, rank: 1, bonusAtk: 5, bonusHp: 20 },
});

test('상태 화면은 현재 성장 → 핵심 기록 → 세부 기록 순으로 배치된다', () => {
    const html = renderStatic(createElement(StatsPanel, { player: buildPlayerFixture(), stats: buildStatsFixture() }));

    const growthIndex = html.indexOf('data-testid="stats-current-growth"');
    const coreIndex = html.indexOf('data-testid="stats-core-records"');
    const detailsIndex = html.indexOf('data-testid="stats-lifetime-records"');

    assert.ok(growthIndex > 0, '현재 성장 섹션이 렌더된다');
    assert.ok(coreIndex > growthIndex, '핵심 기록이 현재 성장 다음에 온다');
    assert.ok(detailsIndex > coreIndex, '세부 기록이 핵심 기록 다음에 온다');
});

test('핵심 기록은 레벨/총 처치/보스 처치/최대 연속 처치 4개만 상시 노출한다', () => {
    const html = renderStatic(createElement(StatsPanel, { player: buildPlayerFixture(), stats: buildStatsFixture() }));

    const coreStart = html.indexOf('data-testid="stats-core-records"');
    const coreEnd = html.indexOf('data-testid="stats-lifetime-records"');
    const coreBlock = html.slice(coreStart, coreEnd);

    for (const label of ['레벨', '총 처치', '보스 처치', '최대 연속 처치']) {
        assert.ok(coreBlock.includes(label), `핵심 기록에 "${label}"이 노출된다`);
    }
    for (const label of ['사망', '현상수배 완료', '탐험 횟수', '휴식 횟수', '도주 횟수', '제작 횟수', '합성 횟수']) {
        assert.ok(!coreBlock.includes(label), `"${label}"은 핵심 기록에는 없다(세부 기록으로 밀림)`);
    }
});

test('세부 기록/처치 분포/계승 기록은 모두 기본 접힌 <details>이고, 각 라벨이 실제로 노출된다', () => {
    const html = renderStatic(createElement(StatsPanel, { player: buildPlayerFixture(), stats: buildStatsFixture() }));

    for (const testId of ['stats-lifetime-records', 'stats-top-kills', 'stats-legacy-records']) {
        const openIdx = html.indexOf(`<details data-testid="${testId}"`);
        assert.ok(openIdx > -1, `${testId}는 <details>로 렌더된다`);
    }
    // react-dom/server는 boolean attribute가 없을 때 속성을 렌더하지 않으므로,
    // open 속성이 없다는 것은 "기본 접힘"의 직접적 증거다.
    assert.ok(!/<details[^>]*\sopen(?:=|\s|>)/.test(html), '어떤 details도 기본으로 펼쳐져 있지 않다');

    for (const label of [
        '사망', '현상수배 완료', '처치/사망', '누적 골드', '탐험 횟수',
        '발견 지역', '휴식 횟수', '도주 횟수', '제작 횟수', '합성 횟수', '완료한 발견 여정',
    ]) {
        assert.ok(html.includes(label), `"${label}"이 세부 기록에 실제로 렌더된다`);
    }
});

test('작은 문구(8~10.5px)는 StatsPanel 렌더 결과에 없다', () => {
    // text-[8px]/[9px]/[10px]/[10.5px]는 StatsPanel 자신의 authored 스타일이라
    // 렌더 결과에서 바로 확인할 수 있다.
    const html = renderStatic(createElement(StatsPanel, { player: buildPlayerFixture(), stats: buildStatsFixture() }));
    assert.doesNotMatch(html, /text-\[(?:8|9|10|10\.5)px\]/, '8~10.5px 크기의 초소형 문구가 없다');
});

// ─── 구조 불변식(소스 텍스트) — uppercase/tracking-[] 장식 표기 제거 ───
//
// 렌더 결과에는 StatsPanel이 합성하는 자식 컴포넌트(SignalBadge 등)가 자체적으로
// 쓰는 uppercase/tracking-[] 클래스도 섞여 나온다. 이 계약은 "StatsPanel 자신이
// 새로 authored한 영문식 장식 표기를 쓰지 않는다"는 뜻이므로, StatsPanel.tsx
// 자신의 소스 텍스트로만 검증해야 다른 컴포넌트의 디자인 토큰을 오탐하지 않는다.
test('구조 불변식: StatsPanel 자신의 소스에는 uppercase/tracking-[] 장식 표기가 없다', async () => {
    const source = await readFile(new URL('../src/components/StatsPanel.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /uppercase|tracking-\[/);
});

test('signature 세트 / prefix 세트 / 유물 조합 보너스가 실제 배율·설명 텍스트로 렌더된다', () => {
    const html = renderStatic(createElement(StatsPanel, { player: buildPlayerFixture(), stats: buildStatsFixture() }));

    assert.ok(html.includes('화염 세트'), 'activeSignatureSet.name 노출');
    assert.ok(html.includes('+18%'), 'activeSignatureSet.atkMult(1.18)이 +18%로 변환되어 노출');
    assert.ok(html.includes('—'), 'activeSignatureSet.defMult(1.0)은 변화 없음(—) 표기');
    assert.ok(html.includes('-10%'), 'activeSignatureSet.hpMult(0.9)이 -10%로 변환되어 노출');

    assert.ok(html.includes('불타는 세트'), 'activeSet.prefix 기반 세트 이름 노출');
    assert.ok(html.includes('불타는 세트 보너스'), 'activeSet.desc 노출');

    assert.ok(html.includes('조합 알파'), '유물 조합 라벨 노출');
    assert.ok(html.includes('전투 시 추가 확률 이벤트가 발생한다'), '유물 조합 설명 노출');
});

test('activeSignatureSet / activeSet / activeSynergies가 없으면 해당 블록은 렌더되지 않는다 (회귀 가드)', () => {
    const html = renderStatic(createElement(StatsPanel, { player: buildPlayerFixture(), stats: { maxHp: 200, maxMp: 60 } }));

    assert.ok(!html.includes('data-testid="stats-active-signature-set"'));
    assert.ok(!html.includes('data-testid="stats-active-set"'));
    assert.ok(!html.includes('data-testid="stats-active-synergies"'));
});
