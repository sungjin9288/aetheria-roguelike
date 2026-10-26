// 2026-10 디자인 기반(VD-01) — src가 쓰는 색 투명도 수식어(`border-white/8` · `text-slate-300/76` …)는 실제로 CSS가 생성된다.
//
// Tailwind 3의 색 수식어는 `theme.opacity` 눈금에서 값을 찾는다. 기본 눈금은 5 단위라 `/8` · `/76` · `/82` 같은 값은 CSS가
// 아예 생성되지 않았다 — 쓰인 1,405곳 중 786곳이 그랬다. 글자는 투명도 없이 물려받은 밝은 색으로, 테두리는 preflight 기본 회색
// (#e5e7eb)으로 그려졌다. 화면이 시안과 달랐던 것은 이 때문이다. `tailwind.config.js`가 0 ~ 100 정수 전부를 눈금에 둔다.
// 생성되자 4.5:1 아래로 내려간 정보 글자(`text-slate-400/68 ~ 82` · `text-slate-500/80 ~ 88` 등 89곳)는 설계의 3차 글자색
// `text-ae-ink-3`(s4 표면 위 5.3:1)로 올렸다 — 남은 투명 글자는 글자가 아닌 표식(3:1)뿐이다(2026-10 실측).
//
// 이 파일은 실제 설정 · 실제 content로 Tailwind를 돌려 생성된 CSS를 읽는다(소스 정규식이 아니라 생성 결과를 본다).
// 결함 주입: `theme.extend.opacity`를 지우면 첫 테스트가 수백 개 클래스를 이름과 함께 붉게 보고한다(2026-10 실측 — 아래 대조군도 같은 것을 고정한다).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import ts from 'typescript';

import tailwindConfig from '../tailwind.config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STRING_KINDS = new Set([
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
    ts.SyntaxKind.JsxText,
]);

// 색을 받는 유틸 접두어 — 분수(`w-1/2` · `-translate-x-1/2`)는 색이 아니므로 고르지 않는다.
const COLOR_UTILITY = /^(?:[\w[\]&>*@.-]+:)*!?-?(?:bg|text|border(?:-[xytrbl])?|ring(?:-offset)?|from|via|to|fill|stroke|outline|divide|decoration|shadow|placeholder|accent|caret)-(?:[a-z][\w-]*|\[[^\]\s]+\])\/(\d{1,3})$/u;

const listFiles = (dir, exts) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(rel, exts);
    return exts.some((ext) => entry.name.endsWith(ext)) ? [rel] : [];
});

/** src의 문자열 조각(JSX 글자 포함)에서 정수 투명도 수식어가 붙은 색 유틸을 모은다. 값 → 처음 나온 파일:줄. */
const collectModifierClasses = () => {
    const found = new Map();
    for (const rel of listFiles('src', ['.ts', '.tsx'])) {
        const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
        const file = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, kind);
        const visit = (node) => {
            if (STRING_KINDS.has(node.kind)) {
                for (const token of String(node.text ?? '').split(/\s+/u)) {
                    if (!token || token.includes('${') || !COLOR_UTILITY.test(token) || found.has(token)) continue;
                    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
                    found.set(token, `${rel}:${line + 1}`);
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(file);
    }
    return found;
};

const unescapeCss = (value) => value
    .replace(/\\([0-9a-fA-F]{1,6})\s?/gu, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\(.)/gu, '$1');

/** 생성된 CSS의 모든 선택자에서 클래스 이름(이스케이프를 푼 원래 이름)을 모은다. */
const collectGeneratedClasses = (css) => {
    const classes = new Set();
    postcss.parse(css).walkRules((rule) => {
        for (const match of rule.selector.matchAll(/\.((?:\\[0-9a-fA-F]{1,6}\s?|\\[^\s0-9a-fA-F]|[\w-])+)/gu)) {
            classes.add(unescapeCss(match[1]));
        }
    });
    return classes;
};

const generateUtilities = async (config) => {
    const result = await postcss([tailwindcss(config)]).process('@tailwind utilities;', { from: undefined });
    return collectGeneratedClasses(result.css);
};

const withAbsoluteContent = (config) => ({
    ...config,
    content: [path.join(ROOT, 'index.html'), path.join(ROOT, 'src/**/*.{js,ts,jsx,tsx}')],
});

const withoutOpacityScale = (config) => {
    const { opacity: _opacity, ...extend } = config.theme.extend;
    return { ...config, theme: { ...config.theme, extend } };
};

test('src가 쓰는 색 투명도 수식어는 모두 실제 CSS로 생성된다 (VD-01)', async () => {
    const used = collectModifierClasses();
    // 공허참 방지: 실제로 읽었고, 기본 눈금 밖 값(7 · 14)도 표본에 있다.
    //   2026-10 화면 디자인 3차가 색을 토큰 · `.ae-*` 표면으로 옮겨 수식어가 300여 개에서 40여 개로 줄었다(slate · white 수식어 0).
    assert.ok(used.size >= 40, `수식어 클래스를 실제로 모았다(${used.size}개)`);
    assert.ok(used.has('border-ae-ink/7'), '기본 눈금 밖 테두리 표본(border-ae-ink/7)');
    assert.ok(used.has('bg-ae-rarity-legendary/14'), '기본 눈금 밖 배경 표본(bg-ae-rarity-legendary/14)');

    const generated = await generateUtilities(withAbsoluteContent(tailwindConfig));
    const missing = [...used].filter(([token]) => !generated.has(token)).map(([token, where]) => `${where} ${token}`);
    assert.deepEqual(missing, []);
});

test('대조군: 눈금 확장이 없으면 같은 클래스가 생성되지 않는다 — 위 테스트가 이 결함을 가린다', async () => {
    const probe = { content: [{ raw: 'border-white/8 text-slate-300/76 bg-black/16 text-white/40', extension: 'html' }] };
    const fixed = await generateUtilities({ ...tailwindConfig, ...probe });
    const broken = await generateUtilities({ ...withoutOpacityScale(tailwindConfig), ...probe });

    for (const token of ['border-white/8', 'text-slate-300/76', 'bg-black/16']) {
        assert.ok(fixed.has(token), `${token}: 0 ~ 100 눈금에서 생성`);
        assert.ok(!broken.has(token), `${token}: 기본 눈금(5 단위)에서는 생성되지 않는다`);
    }
    // 5 단위 값은 두 설정 모두에서 생성된다 — 확장은 기존 값을 바꾸지 않는다.
    assert.ok(fixed.has('text-white/40') && broken.has('text-white/40'));
});

test('투명도 눈금은 0 ~ 100 정수 전부이고 값은 백분율 그대로다', () => {
    const scale = tailwindConfig.theme.extend.opacity;
    assert.equal(Object.keys(scale).length, 101);
    for (let step = 0; step <= 100; step += 1) {
        assert.equal(Number(scale[String(step)]), step / 100, `/${step}`);
    }
});
