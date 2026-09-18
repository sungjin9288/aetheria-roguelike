import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { readFile } from 'node:fs/promises';

import SystemTab from '../src/components/tabs/SystemTab.tsx';
import { getTitleLabel, getTitlePassiveLabel } from '../src/utils/gameUtils.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * Wave 5 W3-B — system-settings-design.test.js 원본 계약(소스 텍스트 grep):
 *
 *   1. 설정 화면은 "플레이 설정" → "장기 성장"(에테르 거울/에테르 교환소 링크 포함)
 *      → "기타"(부가 도구) 순으로 3개 큰 섹션을 배치한다(우선순위 = DOM 순서).
 *   2. 칭호 선택은 현재 적용 중인 칭호 효과를 먼저 보여주고, 칭호 목록/유물 목록/
 *      명예의 전당/의견 보내기/지원 도구는 전부 기본 접힌 <details>다. "오늘의
 *      임무" 같은 옛 UI는 남아있지 않다.
 *   3. 작은 문구(9~10px)/작은 버튼(min-h 34~42px) 장식은 없고, 읽기 모드/장비
 *      정보 모드/칭호 적용 버튼은 실제로 actions.* 콜백을 호출하며, 피드백
 *      전송(addDoc)과 QA 설정 저장(setDoc), 관리자 도구(actions.isAdmin())
 *      권한 체크는 그대로 있다.
 *
 * 1, 2, 3의 "화면에 보이는 것" 부분은 실제 렌더 결과로 검증한다. 3의 "버튼을
 * 누르면 실제로 무슨 일이 일어나는가"(이벤트 핸들러 실행, Firebase 비동기 호출,
 * 관리자 권한 게이팅)는 renderToStaticMarkup이 이벤트를 발생시키지 않아 관찰할
 * 수 없으므로 구조 불변식(소스 텍스트)으로 남긴다.
 */

const buildFixture = (overrides = {}) => {
    const player = makePlayerFixture({
        name: '테스트', job: '전사', level: 10, loc: '시작의 마을',
        titles: ['wanderer', 'cartographer'],
        activeTitle: 'wanderer',
        relics: [{ id: 'r1', name: '용기의 문장', rarity: 'legendary', desc: '전설급 유물' }],
        settings: { readabilityMode: 'standard', equipmentDetailMode: 'auto' },
        ...overrides.player,
    });
    const stats = { maxHp: 150, maxMp: 50, ...overrides.stats };
    const actions = {
        leaderboard: [],
        setReadabilityMode: () => {},
        setEquipmentDetailMode: () => {},
        setActiveTitle: () => {},
        isAdmin: () => false,
        ...overrides.actions,
    };
    const runtime = { viewport: 'mobile', gameState: 'idle', syncStatus: 'synced', isAiThinking: false, ...overrides.runtime };
    return { player, stats, actions, runtime };
};

test('설정 화면은 플레이 설정 → 장기 성장 → 기타 순으로 배치되고, 장기 성장에는 에테르 거울/교환소 링크가 있다', () => {
    const { player, stats, actions, runtime } = buildFixture();
    const html = renderStatic(createElement(SystemTab, { player, actions, stats, runtime }));

    const playerSettings = html.indexOf('data-testid="system-player-settings"');
    const growthLinks = html.indexOf('data-testid="system-growth-links"');
    const secondaryTools = html.indexOf('data-testid="system-secondary-tools"');

    assert.ok(playerSettings >= 0, '플레이 설정 섹션이 렌더된다');
    assert.ok(growthLinks > playerSettings, '장기 성장이 플레이 설정 다음에 온다');
    assert.ok(secondaryTools > growthLinks, '기타(부가 도구)가 장기 성장 다음에 온다');
    assert.ok(html.includes('플레이 설정'));
    assert.ok(html.includes('장기 성장'));
    assert.ok(html.includes('에테르 거울'));
    assert.ok(html.includes('에테르 교환소'));
});

test('칭호 선택: 현재 적용 중인 칭호의 실제 라벨/패시브 설명이 먼저 보이고, 나머지는 기본 접힌 details다', () => {
    const { player, stats, actions, runtime } = buildFixture();
    const html = renderStatic(createElement(SystemTab, { player, actions, stats, runtime }));

    const expectedLabel = `[${getTitleLabel(player.activeTitle)}]`;
    const expectedPassive = getTitlePassiveLabel(player.activeTitle);
    const titleSectionIdx = html.indexOf('data-testid="system-title-section"');
    const pickerIdx = html.indexOf('data-testid="system-title-picker"');

    assert.ok(titleSectionIdx > -1 && pickerIdx > titleSectionIdx, '칭호 섹션 안에 칭호 바꾸기 details가 있다');
    const currentEffectBlock = html.slice(titleSectionIdx, pickerIdx);
    assert.ok(currentEffectBlock.includes(getTitleLabel(player.activeTitle)), '현재 칭호 라벨이 details보다 먼저 보인다');
    assert.ok(currentEffectBlock.includes(expectedPassive), '현재 칭호의 실제 패시브 설명이 먼저 보인다');
    assert.ok(html.includes(expectedLabel), '칭호 표기 형식([라벨])도 그대로 렌더된다');

    for (const testId of [
        'system-title-picker',
        'system-relic-list',
        'system-online-records',
        'system-feedback',
        'system-support-tools',
    ]) {
        assert.ok(html.includes(`data-testid="${testId}"`), `${testId} 섹션이 렌더된다`);
    }
    assert.ok(!/<details[^>]*\sopen(?:=|\s|>)/.test(html), '어떤 details도 기본으로 펼쳐져 있지 않다');
    assert.ok(!html.includes('오늘의 임무'), '옛 "오늘의 임무" UI는 남아있지 않다');
});

test('설정 화면에는 작은 문구(9~10px)/작은 버튼(min-h 34~42px) 장식이 실제 렌더 결과에 없다', () => {
    const { player, stats, actions, runtime } = buildFixture();
    const html = renderStatic(createElement(SystemTab, { player, actions, stats, runtime }));

    assert.doesNotMatch(html, /text-\[(?:9|10)px\]/, '9~10px 크기의 초소형 문구가 없다');
    assert.doesNotMatch(html, /min-h-\[(?:34|42)px\]/, '34~42px 높이의 작은 버튼이 없다');
});

// ─── 구조 불변식(소스 텍스트) — 버튼을 누르면 실제로 일어나는 일 ───
//
// renderToStaticMarkup은 이벤트를 발생시키지 않는다. "읽기 모드/장비 정보 모드/
// 칭호 버튼이 실제로 actions.* 콜백을 부르는가", "피드백 전송이 실제로 Firestore에
// addDoc하는가", "QA 설정 저장이 setDoc을 부르는가", "관리자 도구가 actions.isAdmin()
// 으로 게이팅되는가"는 DOM 이벤트 시뮬레이션(jsdom 등, 이 프로젝트에는 없다) 없이는
// 관찰할 수 없어 소스 텍스트로 남긴다.
test('구조 불변식: 설정 화면의 상호작용은 실제 actions 콜백/Firebase 호출/관리자 게이팅으로 연결된다', async () => {
    const source = await readFile(new URL('../src/components/tabs/SystemTab.tsx', import.meta.url), 'utf8');

    assert.match(source, /getTitlePassiveLabel\(player\.activeTitle\)/);
    assert.match(source, /actions\?\.setReadabilityMode\?\./);
    assert.match(source, /actions\?\.setEquipmentDetailMode\?\./);
    assert.match(source, /actions\?\.setActiveTitle\?\./);
    assert.match(source, /await addDoc\(feedbackCol/);
    assert.match(source, /await setDoc\(configRef/);
    assert.match(source, /actions\?\.isAdmin\(\)/);
});
