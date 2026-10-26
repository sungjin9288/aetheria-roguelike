// 2026-10 디자인 기반(VD-08 · VD-05 · CH-06) — 에테르 유리 팔레트만 쓴다.
//
// 사이버 네온 팔레트(`cyber-*` 색 · `neon-*` 그림자 · scanline/glitch 움직임)는 하이 판타지 화면에 맞지 않았고, 일부는
// 투명도 수식어가 생성되지 않아(VD-01) 의도와 다른 색으로 그려졌다. 쓰던 곳은 의미대로 옮겼다 — 초록 → good, 파랑 → ether
// (기력 물약은 will), 분홍 연속 공격 표시 → 금(공격 보상), 보라 → exp · 희귀 등급.
// 표제 글꼴 Rajdhani는 한글이 없어 대체 글꼴로 떨어졌고, 첫 화면 전에 fonts.googleapis.com으로 외부 요청을 보냈다
// (개인정보 처리방침의 국외 이전 행이 그 때문이었다). 표제는 본문 한글 글꼴 굵기 800이다.
//
// 모두 부재 불변식이다 — 되돌아오면 붉다. 정규식은 서식이 아니라 식별자만 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import ts from 'typescript';

import tailwindConfig from '../tailwind.config.js';
import MainLayout from '../src/components/MainLayout.tsx';
import { renderStatic } from './helpers/render.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STRING_KINDS = new Set([
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
    ts.SyntaxKind.JsxText,
]);

const RETIRED_CLASS = /(?:^|:|!|-)(?:cyber-[a-z]+|shadow-neon-[a-z]+|font-rajdhani|animate-(?:scanline|glitch))(?:\/\d+)?$/u;
const NEON_HEX = /#(?:00ff9d|00ccff|ff00ff|bc13fe|0a0a0f|1a1a2e)\b|rgba?\(\s*(?:0\s*,\s*204\s*,\s*255|0\s*,\s*255\s*,\s*157|255\s*,\s*0\s*,\s*255)\b/iu;

const listFiles = (dir, exts) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(rel, exts);
    return exts.some((ext) => entry.name.endsWith(ext)) ? [rel] : [];
});

/** src 문자열 조각(JSX 글자 포함)을 낱말로 나눠 술어에 걸리는 것을 파일:줄과 함께 모은다. 주석은 보지 않는다. */
const findInSourceStrings = (predicate) => {
    const found = [];
    let strings = 0;
    for (const rel of listFiles('src', ['.ts', '.tsx'])) {
        const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
        const file = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, kind);
        const visit = (node) => {
            if (STRING_KINDS.has(node.kind)) {
                strings += 1;
                const text = String(node.text ?? '');
                for (const token of text.split(/\s+/u)) {
                    if (token && predicate(token, text)) {
                        const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
                        found.push(`${rel}:${line + 1} ${token}`);
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(file);
    }
    return { found, strings };
};

const stripCssComments = (css) => css.replace(/\/\*[\s\S]*?\*\//gu, '');

test('[부재 불변식] src 문자열에 사이버 네온 클래스(cyber-* · shadow-neon-* · scanline · glitch · font-rajdhani)가 없다', () => {
    const { found, strings } = findInSourceStrings((token) => RETIRED_CLASS.test(token));
    assert.ok(strings > 10_000, `문자열을 실제로 읽었다(${strings}개)`);
    assert.deepEqual(found, []);
});

test('[부재 불변식] src 문자열 · CSS에 사이버 네온 색 값(#00ccff · #bc13fe …)이 없다', () => {
    const { found } = findInSourceStrings((token) => NEON_HEX.test(token));
    assert.deepEqual(found, []);
    const cssHits = listFiles('src', ['.css'])
        .filter((rel) => NEON_HEX.test(stripCssComments(fs.readFileSync(path.join(ROOT, rel), 'utf8'))));
    assert.deepEqual(cssHits, []);
});

test('[부재 불변식] Tailwind 설정에 cyber 색 · neon 그림자 · rajdhani 글꼴 · scanline/glitch 움직임이 없다', () => {
    const extend = tailwindConfig.theme.extend;
    assert.ok(extend.colors?.ae, '에테르 유리 색(ae)이 있다 — 비교 대상이 실제 설정이다');
    assert.equal(extend.colors.cyber, undefined);
    assert.deepEqual(Object.keys(extend.boxShadow ?? {}).filter((key) => key.startsWith('neon')), []);
    assert.equal(extend.fontFamily?.rajdhani, undefined);
    assert.deepEqual(Object.keys(extend.animation ?? {}).filter((key) => /scanline|glitch/u.test(key)), []);
    assert.deepEqual(Object.keys(extend.keyframes ?? {}).filter((key) => /scanline|glitch/u.test(key)), []);
});

test('[부재 불변식] 외부 글꼴을 불러오지 않는다 — index.html에 Google Fonts가 없고 표제 글꼴은 본문 글꼴이다', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/u);
    assert.doesNotMatch(html, /rajdhani/iu);

    const css = stripCssComments(fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8'));
    assert.doesNotMatch(css, /rajdhani/iu);
    assert.doesNotMatch(css, /@import\s+url\(\s*['"]?https?:/u, 'CSS가 외부 글꼴 · 스타일을 불러오지 않는다');
    const display = css.match(/--aether-display-font:\s*([^;]+);/u);
    assert.ok(display, '표제 글꼴 변수가 있다');
    assert.equal(display[1].trim(), 'var(--aether-readable-font)');
});

test('앱 셸은 고정폭 글꼴을 쓰지 않는다 — 숫자만 font-fira (VD-05)', () => {
    for (const immersive of [false, true]) {
        const html = renderStatic(createElement(MainLayout, { immersive }, createElement('p', null, '본문')));
        const shell = html.match(/<div data-app-shell="[^"]*"[^>]*class="([^"]*)"/u);
        assert.ok(shell, `셸을 그렸다(immersive=${immersive})`);
        const classes = shell[1].split(/\s+/u);
        assert.ok(classes.includes('bg-ae-void'), '셸 바탕은 에테르 유리 토큰이다');
        assert.ok(!classes.includes('font-mono'), `셸에 font-mono가 없다: ${shell[1]}`);
    }
});
