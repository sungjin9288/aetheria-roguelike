import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * 2026-10 에테르 유리 디자인 시스템 — 화면 코드의 디자인 부채는 늘지 못한다.
 *
 * 화면 3차(8개 묶음)가 컴포넌트의 색 · 둥글기 · 표면을 토큰(`ae-*` 클래스 · `--aether-*` 변수 · `.ae-*` 표면 · ui 원시 요소)으로
 * 옮겼다. 착수 실측(`src/components`, 주석 제외 문자열 조각): hex 827 · rgb 274 · 임의 둥글기 165 · slate 글자 518 ·
 * 투명도 글자 167 · 옛 주 행동 클래스 17 · 옛 표면 60 · 회색 테두리 상자 280 · 임의 색 클래스 758.
 * 상한은 통합 뒤 실측값이고 하락만 허용한다 — 새 화면은 토큰을 쓴다.
 *
 * 남은 것: hex 4는 기록 탭 줄의 가림 그라데이션(`#000`은 색이 아니라 알파 마스크)이고, rgb는 토큰 채널
 * (`rgb(var(--aether-…-rgb) / a)` · 채널 변수를 받는 템플릿)이다. 숫자로 쓴 rgb 색은 픽셀 아바타의 하이라이트 하나뿐이다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const STRING_KINDS = new Set([
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
    ts.SyntaxKind.JsxText,
]);

const CATEGORIES = {
    hexColor: /#[0-9a-fA-F]{3,8}\b/u,
    rgbColor: /rgba?\(/u,
    numericRgbColor: /rgba?\(\s*\d/u,
    arbitraryRadius: /(?:^|:)rounded(?:-[a-z]{1,2})?-\[/u,
    slateText: /(?:^|:)text-slate-\d{2,3}(?:\/\d+)?$/u,
    opacityInk: /(?:^|:)text-(?:white|slate-\d{2,3}|gray-\d{2,3})\/\d+$/u,
    legacyCta: /^(?:aether-cta-primary|aether-cta-gold|aether-action-button)$/u,
    legacySurface: /^(?:panel-noise|aether-surface|aether-surface-strong|aether-panel-[a-z-]+)$/u,
    greyBorderBox: /(?:^|:)border-(?:white|slate-\d{2,3}|gray-\d{2,3})(?:\/\d+)?$/u,
    arbitraryColorClass: /(?:^|:)(?:text|bg|border|from|via|to|ring|shadow|fill|stroke)-\[(?:#|rgba?\()/u,
};

const CEILINGS = {
    hexColor: 4,
    rgbColor: 88,
    numericRgbColor: 1,
    arbitraryRadius: 0,
    slateText: 0,
    opacityInk: 0,
    legacyCta: 0,
    legacySurface: 0,
    greyBorderBox: 0,
    arbitraryColorClass: 0,
};

const listSources = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return listSources(rel);
    return /\.(ts|tsx)$/u.test(entry.name) ? [rel] : [];
});

/** 소스 한 편의 문자열 조각(주석 제외)을 공백으로 나눈 토큰을 범주별로 센다. */
const measureDesignDebt = (relPath, source) => {
    const counts = Object.fromEntries(Object.keys(CATEGORIES).map((key) => [key, 0]));
    const kind = relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(relPath, source, ts.ScriptTarget.Latest, true, kind);
    const visit = (node) => {
        if (STRING_KINDS.has(node.kind)) {
            for (const token of String(node.text ?? '').split(/\s+/u)) {
                if (!token) continue;
                for (const [key, pattern] of Object.entries(CATEGORIES)) {
                    if (pattern.test(token)) counts[key] += 1;
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return counts;
};

const measureComponents = () => {
    const totals = Object.fromEntries(Object.keys(CATEGORIES).map((key) => [key, 0]));
    const byFile = {};
    const files = listSources('src/components');
    for (const rel of files) {
        const counts = measureDesignDebt(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'));
        for (const [key, value] of Object.entries(counts)) {
            totals[key] += value;
            if (value > 0) (byFile[key] ??= []).push(`${rel}:${value}`);
        }
    }
    return { totals, byFile, fileCount: files.length };
};

test('디자인 부채 상한 — src/components의 범주마다 통합 뒤 실측값을 넘지 않는다', () => {
    const { totals, byFile, fileCount } = measureComponents();
    assert.ok(fileCount > 100, `비공허 — 컴포넌트 파일을 스캔했다 (${fileCount})`);
    for (const [key, ceiling] of Object.entries(CEILINGS)) {
        assert.ok(
            totals[key] <= ceiling,
            `${key}: ${totals[key]} > 상한 ${ceiling} — 토큰(ae-* · --aether-* · .ae-* · ui 원시 요소)을 쓸 것. ${(byFile[key] ?? []).join(', ')}`,
        );
    }
});

test('측정기는 각 범주를 실제로 센다 (공허참 방지)', () => {
    const sample = [
        "const a = 'text-[#ff0000] rounded-[12px] text-slate-400 text-white/60 border-white/10';",
        "const b = 'aether-cta-primary panel-noise';",
        "const c = `rgba(1, 2, 3, ${0.5})`;",
        "const d = '#abc';",
        "// '#ffffff text-slate-500' — 주석은 세지 않는다",
    ].join('\n');
    const counts = measureDesignDebt('sample.tsx', sample);
    assert.deepEqual(counts, {
        hexColor: 2,
        rgbColor: 1,
        numericRgbColor: 1,
        arbitraryRadius: 1,
        slateText: 1,
        opacityInk: 1,
        legacyCta: 1,
        legacySurface: 1,
        greyBorderBox: 1,
        arbitraryColorClass: 1,
    });
});
