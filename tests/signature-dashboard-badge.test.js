import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import ArchiveTabButton from '../src/components/ArchiveTabButton.tsx';
import Dashboard from '../src/components/Dashboard.tsx';
import { getSignatureDiscoveryProgress } from '../src/data/signatureItems.js';
import { Star } from 'lucide-react';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

/**
 * 원래 계약 (Dashboard의 도감 탭에 signature 도감 진행도 뱃지가 연결되어 있는지):
 *   1. ArchiveTabButton이 badge prop을 받고 absolute 뱃지로 렌더링
 *   2. Dashboard가 getSignatureDiscoveryProgress를 사용해 codex 탭 badge 계산
 *   3. discovered=0 인 경우 뱃지 노출 안 함 (UI 노이즈 방지)
 *   4. production ArchiveTabButton rail은 단 하나(...getTabExtras(tab.id) spread 1회)
 *
 * 기존 테스트는 "React 컴포넌트 런타임 테스트는 JSX 변환 없이 불가능"이라는 주석 아래
 * 소스 텍스트 정규식만 검사했다 — tsx 로더 도입 이후에는 사실이 아니므로(Wave 4 P3
 * 패턴) 실제 렌더 검증으로 옮긴다. 4번(단일 production rail)만 여러 파일에 걸친
 * "라우팅 중복 금지" 구조 불변식이라 소스 텍스트로 유지한다.
 */

test('ArchiveTabButton은 badge=null이면 뱃지를 렌더링하지 않는다', () => {
    const html = renderStatic(createElement(ArchiveTabButton, {
        icon: Star, label: '도감', active: false, onClick: () => {}, testId: 'archive-tab-codex',
    }));
    assert.ok(!html.includes('archive-tab-codex-badge'), 'badge=null(default)이면 뱃지 노드 없음');
});

test('ArchiveTabButton은 badge가 주어지면 절대 위치 뱃지로 렌더링한다', () => {
    const html = renderStatic(createElement(ArchiveTabButton, {
        icon: Star, label: '도감', active: false, onClick: () => {},
        testId: 'archive-tab-codex', badge: '3/12', badgeTitle: '전설 각인 3/12 수집 (25%)',
    }));

    assert.ok(html.includes('data-testid="archive-tab-codex-badge"'), '뱃지 노드가 testId-badge로 렌더링됨');
    assert.ok(html.includes('>3/12<'), '뱃지 텍스트 노출');
    assert.ok(html.includes('title="전설 각인 3/12 수집 (25%)"'), 'badgeTitle이 title 툴팁으로 전달됨');
    const badgeStart = html.indexOf('data-testid="archive-tab-codex-badge"');
    const badgeTagStart = html.lastIndexOf('<span', badgeStart);
    const badgeTagEnd = html.indexOf('>', badgeStart);
    const badgeSpan = html.slice(badgeTagStart, badgeTagEnd);
    assert.match(badgeSpan, /class="[^"]*absolute[^"]*"/, '뱃지가 absolute 포지션으로 아이콘 위에 뜸');
});

test('getSignatureDiscoveryProgress: codex 미기록 플레이어는 discovered=0', () => {
    const player = makePlayerFixture();
    const progress = getSignatureDiscoveryProgress(player);
    assert.equal(progress.discovered, 0);
    assert.ok(progress.total > 0);
});

test('Dashboard는 codex 탭에서만, discovered>0일 때만 signature 뱃지를 실제로 렌더링한다', () => {
    const noDiscovery = makePlayerFixture();
    const htmlNoDiscovery = renderStatic(createElement(Dashboard, {
        player: noDiscovery, uid: 'test-uid', grave: null, sideTab: 'none',
        setSideTab: () => {}, actions: {}, stats: null, quickSlots: [],
        runtime: null, onReturnToLog: () => {},
    }));
    assert.ok(!htmlNoDiscovery.includes('archive-tab-codex-badge'), 'discovered=0이면 codex 탭에 뱃지 노이즈 없음');
    // 다른 탭에는 badge extras가 아예 안 붙는지도 확인 (tabId !== 'codex' 가드)
    for (const otherTab of ['equipment', 'inventory', 'quest', 'achievements', 'skills', 'map', 'stats', 'pass', 'graves', 'system']) {
        assert.ok(!htmlNoDiscovery.includes(`archive-tab-${otherTab}-badge`), `${otherTab} 탭에는 뱃지가 붙지 않음`);
    }

    const discoveredPlayer = makePlayerFixture({
        stats: {
            ...noDiscovery.stats,
            codex: { weapons: { '성검 에테르니아': true } },
        },
    });
    const expectedProgress = getSignatureDiscoveryProgress(discoveredPlayer);
    assert.ok(expectedProgress.discovered > 0, '전제: 픽스처가 실제로 discovered>0을 만들어야 함');

    const htmlDiscovered = renderStatic(createElement(Dashboard, {
        player: discoveredPlayer, uid: 'test-uid', grave: null, sideTab: 'none',
        setSideTab: () => {}, actions: {}, stats: null, quickSlots: [],
        runtime: null, onReturnToLog: () => {},
    }));

    assert.ok(htmlDiscovered.includes('data-testid="archive-tab-codex-badge"'), 'discovered>0이면 codex 탭에 뱃지가 렌더링됨');
    assert.ok(
        htmlDiscovered.includes(`>${expectedProgress.discovered}/${expectedProgress.total}<`),
        '실제 getSignatureDiscoveryProgress 결과와 동일한 discovered/total 표시',
    );
});

// 구조 불변식(소스 텍스트) — "production ArchiveTabButton rail은 하나뿐"이라는
// 중복 방지 규칙은 렌더 1회로는 검증할 수 없다(같은 파일 안의 '다른 곳'이 없다는
// 부재 증명). 파일 전체에서 스프레드 호출 횟수를 세는 정적 검사로 유지한다.
test('the single production archive rail spreads getTabExtras', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../src/components/Dashboard.tsx', import.meta.url), 'utf8');
    const extrasSpread = (source.match(/\.\.\.getTabExtras\(tab\.id\)/g) || []).length;
    assert.equal(extrasSpread, 1, `expected one production ArchiveTabButton rail, got ${extrasSpread}`);
    assert.doesNotMatch(source, /mobile-archive-sheet|dashboard-tab-/);
});
