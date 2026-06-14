import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Slice 28: 전면 디자인 시스템 통일 — radius 토큰 스케일 + 상호작용 레이어.
 *
 * 진단(디자인 토큰 감사): aether-* 클래스가 배경/보더/그림자만 정의하고
 * border-radius는 컴포넌트가 매번 rounded-[Xrem]으로 인라인 지정 → 같은 tier
 * 패널이 1.45/1.5/1.55/1.9/1.95/2rem 제각각이라 화면마다 다른 디자인처럼 보임.
 *
 * 레퍼런스(Balatro / Slay the Spire / Hades): 화면 전체가 하나의 둥근 모서리
 * 리듬 + 누를 수 있어 보이는 촉각 피드백을 공유한다.
 *
 * 수정:
 * - :root에 4단계 radius 토큰(--aether-r-cell/card/panel/shell + overlay).
 * - aether-* 클래스가 radius를 직접 소유(@tailwind utilities 이후 정의라 인라인
 *   rounded를 덮어씀) → 컴포넌트 인라인 분산을 토큰으로 흡수.
 * - 버튼/CTA hover lift + transition 상호작용 레이어(high-readability 모드 무효화).
 * - focus-panel 루트 5종의 죽은 인라인 rounded 제거, 전체화면 외 1.9rem 패널 정규화.
 * - IntroScreen 시작 버튼 → aether-cta-primary(누를 수 있는 confirm).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('slice 28: radius 4단계 토큰이 :root에 정의', async () => {
    const css = await readSrc('src/index.css');
    for (const token of ['--aether-r-cell', '--aether-r-card', '--aether-r-panel', '--aether-r-shell', '--aether-r-overlay']) {
        assert.ok(new RegExp(`${token}:\\s*[0-9.]+rem`).test(css), `${token} 정의`);
    }
});

test('slice 28: aether 클래스가 radius 토큰을 직접 소유', async () => {
    const css = await readSrc('src/index.css');
    assert.ok(/\.aether-focus-panel\s*\{\s*border-radius:\s*var\(--aether-r-shell\)/.test(css),
        'focus-panel → shell radius');
    assert.ok(/\.aether-action-button[\s\S]{0,200}border-radius:\s*var\(--aether-r-panel\)/.test(css),
        'action-button → panel radius');
    assert.ok(/\.aether-shop-row[\s\S]{0,260}border-radius:\s*var\(--aether-r-card\)/.test(css),
        'shop-row → card radius');
});

test('slice 28: 버튼/CTA 상호작용 레이어 (hover lift + high 모드 무효화)', async () => {
    const css = await readSrc('src/index.css');
    assert.ok(/\.aether-cta-primary:hover:not\(:disabled\)[\s\S]{0,400}translateY\(-1px\)/.test(css)
        || /:hover:not\(:disabled\)[\s\S]{0,200}transform:\s*translateY\(-1px\)/.test(css),
        'hover lift 정의');
    assert.ok(/\[data-readability-mode="high"\][\s\S]{0,300}transform:\s*none/.test(css),
        'high-readability 모드에서 lift 무효화');
});

test('slice 28: focus-panel 루트 5종 — 죽은 인라인 rounded 제거', async () => {
    const roots = [
        'src/components/EventPanel.tsx',
        'src/components/ShopPanel.tsx',
        'src/components/tabs/QuestBoardPanel.tsx',
        'src/components/tabs/CraftingPanel.tsx',
        'src/components/tabs/JobChangePanel.tsx',
    ];
    for (const rel of roots) {
        const src = await readSrc(rel);
        assert.ok(/aether-focus-panel/.test(src), `${rel}: aether-focus-panel 사용`);
        assert.ok(!/aether-focus-panel[^"]*rounded-\[1\.95rem\]/.test(src)
            && !/aether-focus-panel[^"]*rounded-\[1\.45rem\]/.test(src),
            `${rel}: focus-panel 루트에 충돌 인라인 rounded 제거`);
    }
});

test('slice 28: in-flow 패널 1.9/1.95rem 잔존 0건 (전체화면 오버레이 제외)', async () => {
    // 전체화면 모달(Relic/RunSummary/Ascension/Intro/Boot)은 overlay tier로 2rem 유지.
    const inFlow = [
        'src/components/ControlPanel.tsx',
        'src/components/tabs/CombatPanel.tsx',
        'src/components/EventPanel.tsx',
        'src/components/tabs/CraftingPanel.tsx',
        'src/components/tabs/JobChangePanel.tsx',
    ];
    for (const rel of inFlow) {
        const src = await readSrc(rel);
        assert.ok(!/rounded-\[1\.9rem\]/.test(src) && !/rounded-\[1\.95rem\]/.test(src),
            `${rel}: 1.9/1.95rem 인라인 0건`);
    }
});

test('slice 28: IntroScreen 시작 버튼 → aether-cta-primary', async () => {
    const src = await readSrc('src/components/IntroScreen.tsx');
    assert.ok(/data-testid="intro-start-button"[\s\S]{0,400}aether-cta-primary/.test(src),
        '시작 버튼이 CTA primary 사용');
});
