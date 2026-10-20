// 2026-10 Wave 133(원장 §146, 소유자 결정 "위치를 둘째 줄로") — 화면의 글자는 어디서나 11px 이상이다.
//
// Wave 132가 유물 선택 · 사망 화면을 11px 하한 안에 넣은 뒤, 화면 전수(마을 · 기록 탭 11개 · 상점 · 귀환 브리핑 · 전투 ·
// 기록 창)를 세 폭으로 재자 9 ~ 10px 글자가 컴포넌트 15개 파일 86곳 + 기록 창 배지(8px, CSS)에 남아 있었다. 상점의 구매 판단 줄
// ("능력치 하락" · "공격력 −N" · "버서커 세트 +N")이 9px였다. 11px로 올려도 가로 넘침 · 새 잘림은 0이었고 스크롤 높이만 늘었다.
//
// 상태 표시줄만 배치가 걸렸다: 첫 줄(이름 · 직업 · 레벨 · 위치 · 골드)에서 위치가 줄어드는 칸이라, 지금도 여섯 글자 이름이면
// 375 · 390px에서 지역 이름이 거의 다 잘렸고 '드래곤 나이트'와 함께면 0px로 사라졌다. 소유자 결정으로 위치는 둘째 줄
// (상황 칩 줄) 맨 앞이고 그 줄은 늘 그린다(높이: 칩 없을 때 110 → 132px, 있을 때 133 → 136px).
//
// 이 파일은 두 부재 불변식(소스의 글자 크기 클래스 · CSS의 글자 크기)과 상태 표시줄 배치를 지킨다. 실제 계산된 크기 ·
// 가로 넘침 · 위치 잘림은 e2e `mobile-legibility.spec.ts`가 세 폭에서 잰다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ts from 'typescript';

import { MSG } from '../src/data/messages.ts';
import StatusBar from '../src/components/StatusBar.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLOOR_PX = 11;
const SIZE_CLASS = /(?:^|:)text-\[(\d*\.?\d+)(px|rem)\]$/u;
const LITERAL_SIZE = /^(\d*\.?\d+)(px|rem)$/u;
const toPx = (value, unit) => Number(value) * (unit === 'rem' ? 16 : 1);

const listFiles = (dir, exts) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(rel, exts);
    return exts.some((ext) => entry.name.endsWith(ext)) ? [rel] : [];
});

const STRING_KINDS = new Set([
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
]);

/** src의 모든 문자열 조각에서 하한보다 작은 글자 크기 클래스(반응형 접두어 포함)를 파일:줄과 함께 찾는다. */
const findUndersizedClassTokens = () => {
    const found = [];
    for (const rel of listFiles('src', ['.ts', '.tsx'])) {
        const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
        const file = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, kind);
        const visit = (node) => {
            if (STRING_KINDS.has(node.kind)) {
                for (const token of String(node.text ?? '').split(/\s+/u)) {
                    const match = token.match(SIZE_CLASS);
                    if (match && toPx(match[1], match[2]) < FLOOR_PX) {
                        const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
                        found.push(`${rel}:${line + 1} ${token}`);
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(file);
    }
    return found;
};

/** CSS의 글자 크기 선언 — 값은 11px 이상의 수치이거나 타입 스케일 변수여야 하고, 타입 스케일 변수도 11px 이상이다. */
const findUndersizedCss = () => {
    const found = [];
    let checked = 0;
    for (const rel of listFiles('src', ['.css'])) {
        const source = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, ' '));
        for (const match of source.matchAll(/(font-size|--aether-type-[a-z-]+)\s*:\s*([^;]+);/gu)) {
            const [, property, rawValue] = match;
            const value = rawValue.trim();
            const line = source.slice(0, match.index).split('\n').length;
            checked += 1;
            const literal = value.match(LITERAL_SIZE);
            if (literal) {
                if (toPx(literal[1], literal[2]) < FLOOR_PX) found.push(`${rel}:${line} ${property}: ${value}`);
            } else if (!(property === 'font-size' && /^var\(--aether-type-[a-z-]+\)$/u.test(value))) {
                found.push(`${rel}:${line} ${property}: ${value} (수치도 타입 스케일 변수도 아니다)`);
            }
        }
    }
    return { found, checked };
};

test('[부재 불변식] src의 어떤 문자열에도 11px 미만 글자 크기 클래스가 없다', () => {
    assert.deepEqual(findUndersizedClassTokens(), []);
});

test('[부재 불변식] CSS의 글자 크기는 11px 이상이다 — 기록 창 배지 포함, 타입 스케일 변수도', () => {
    const { found, checked } = findUndersizedCss();
    assert.ok(checked >= 10, `글자 크기 선언을 실제로 읽었다(${checked}개)`);
    assert.deepEqual(found, []);
});

const renderBar = (overrides, enemy = null) => renderStatic(React.createElement(StatusBar, {
    player: makePlayerFixture({ name: '조사', killStreak: 0, status: [], ...overrides }),
    stats: null,
    enemy,
}));
const openingTag = (html, testId) => html.match(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`, 'u'))?.[0] || '';
const sectionOf = (html, testId) => html.match(new RegExp(`<div[^>]*data-testid="${testId}"[^>]*>([\\s\\S]*?)</div>`, 'u'))?.[1] || '';

test('[상태 표시줄] 위치는 칩이 없어도 둘째 줄(상황 칩 줄) 맨 앞에 있고, 줄이지 않는다', () => {
    // 칩이 없는 경우를 재려면 보스 접근 칩이 없는 안전지대여야 한다(사냥 지역은 보스 접근 칩이 뜬다).
    for (const loc of ['여행자의 쉼터', '시작의 마을']) {
        const html = renderBar({ name: '열여섯글자의아주긴모험가이름이다', job: '드래곤 나이트', loc });
        const line = sectionOf(html, 'status-context-line');
        assert.ok(line, `${loc}: 상황 칩이 없어도 둘째 줄을 그린다`);
        assert.doesNotMatch(line, /-chip"/u, `${loc}: 칩 없는 경우다`);
        assert.match(line, new RegExp(`^\\s*<span[^>]*data-testid="status-location"[^>]*>${loc}</span>`, 'u'), `${loc}: 둘째 줄의 맨 앞이 위치다`);
        assert.doesNotMatch(openingTag(html, 'status-location'), /\btruncate\b/u, '위치는 말줄임 칸이 아니다');
        assert.doesNotMatch(sectionOf(html, 'status-player-summary'), new RegExp(`${loc}|status-location`, 'u'), '첫 줄에는 위치가 없다');
    }
    // 가장 긴 지역 이름(사냥 지역 — 보스 접근 칩과 같은 줄)도 그대로 그린다.
    const field = renderBar({ name: '열여섯글자의아주긴모험가이름이다', job: '드래곤 나이트', loc: '차원의 균열 전초기지' });
    assert.match(sectionOf(field, 'status-context-line'), /^\s*<span[^>]*data-testid="status-location"[^>]*>차원의 균열 전초기지<\/span>/u);
});

test('[상태 표시줄] 칩은 위치 뒤에 같은 줄로 이어지고, 대기 · 전투 화면 모두 11px 미만 글자가 없다', () => {
    const idle = renderBar({ loc: '시작의 마을', killStreak: 5, status: ['burn'] });
    const line = sectionOf(idle, 'status-context-line');
    assert.ok(line.indexOf('status-location') < line.indexOf('status-debuff-chip'), '위치 → 상황 칩 순서');
    assert.ok(line.includes(MSG.STATUS_LABELS.burn), '상태이상 칩');
    const combat = renderBar({ loc: '시작의 마을' }, { name: '고블린 정찰병', baseName: '고블린 정찰병', hp: 40, maxHp: 80, isBoss: true });
    for (const html of [idle, combat]) {
        const small = [...html.matchAll(/class="([^"]*)"/gu)].flatMap(([, classes]) => classes.split(/\s+/u))
            .filter((token) => { const match = token.match(SIZE_CLASS); return match && toPx(match[1], match[2]) < FLOOR_PX; });
        assert.deepEqual(small, []);
    }
    assert.ok(combat.includes('data-testid="enemy-status-label"'), '전투 화면도 그렸다');
});

test('[상태 표시줄] 길 잃은 여행 회차에서는 둘째 줄의 위치도 가린다(getVisibleLocationName)', () => {
    const html = renderBar({ loc: '차원의 균열 전초기지', challengeModifiers: ['blindMap'] });
    assert.match(sectionOf(html, 'status-context-line'), new RegExp(`data-testid="status-location"[^>]*>${MSG.BLIND_MAP_LOCATION.replace(/\?/gu, '\\?')}<`, 'u'));
    assert.ok(!html.includes('차원의 균열 전초기지'), '지역 이름이 새지 않는다');
});
