// 2026-10 Wave 134(원장 §147) — 화면에 그리는 문자열에는 영어 낱말이 없다(게임 제목 로고 · 터미널 명령어만 예외).
//
// Wave 130 · 131 계약은 약어(HP · ATK · Lv …)와 한국어 두 번째 이름을 잡지만 영어 낱말은 잡지 않았다. 그래서 전설 각인 화면 ·
// 전투 결과 카드의 'Legendary', 진 엔딩의 'True Ending' 제목과 'New Game+' 단추(= 계승), 시즌 이벤트 띠의 'XP'가 남았다.
//
// 출력 위치의 문자열만 본다 — JSX 텍스트, JSX 자식 식의 문자열 · 템플릿(조건 갈래 · && · || · ?? 포함), 화면 문구 속성(title ·
// aria-label · placeholder · alt · label). 비교 · 키 · 클래스 이름 같은 코드 문자열은 화면에 나오지 않는다.
// MSG는 값 · 함수의 반환식 · 조건 갈래 · 템플릿 조각을 본다. 호출하지 않는다 — 표본 인자는 'undefined' 같은 허상 낱말을 만든다.
// utils · hooks · systems 등 화면 뷰모델의 문장(한글이 든 문자열)에 섞인 영어도 본다 — 안전지대 안내가 "다음 signature 드롭 확률",
// 사망 화면의 공유 문구가 "AETHERIA RUN ENDED"였다.
// 변수로 건너오는 값(레지스트리의 그림 생성 지시문 artNote · 배지 aria-label)은 AST가 보지 못하므로 전설 각인 화면 두 곳을 25개 전부
// 렌더해 글자와 화면 문구 속성을 읽는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createElement } from 'react';

import LegendaryDropOverlay from '../src/components/LegendaryDropOverlay.tsx';
import { LegendaryCodexDetail } from '../src/components/codex/LegendaryCodex.tsx';
import { DB } from '../src/data/db.ts';
import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.ts';
import { getItemStatText } from '../src/utils/equipmentUtils.ts';
import { renderStatic } from './helpers/render.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORD = /[A-Za-z]{2,}/gu;
const TEXT_ATTRS = new Set(['title', 'aria-label', 'placeholder', 'alt', 'label']);
// 게임 제목 로고(상표)만 영어로 그린다.
const ALLOWED_SCREEN_WORDS = new Set(['AETHERIA']);
// 터미널 명령어 안내는 플레이어가 입력하는 명령 낱말(move · explore …)을 그대로 보인다 — 터미널은 두 번째 입력 표면이다(Wave 17).
const COMMAND_MESSAGE_KEY = /^CMD_/u;
// 사망 화면 공유 문구의 해시태그(#AetheriaRPG)는 게임 이름이다.
const ALLOWED_BRAND_WORDS = new Set(['AETHERIA', 'AetheriaRPG']);
// 뷰모델 문장 검사에서 빼는 곳 — 화면에 그리지 않는다. QA 시드 API는 프로덕션 번들에서 빠지고(칭호 id 'elite:지역'),
// 장비 경제 감사는 데이터 행의 desc_stat("ATK+47(독)")을 증빙과 대조한다(화면은 변환기 `getItemStatText`를 읽는다).
const NON_SCREEN_CODE = [/^src\/hooks\/useGameTestApi\.ts$/u, /^src\/systems\/[A-Za-z]+Audit\.ts$/u];
const HANGUL = /[\uAC00-\uD7A3]/u;
// 정규식 원문 속의 유니코드 이스케이프(\uAC00)는 낱말이 아니다.
const UNICODE_ESCAPE = /\\u[0-9A-Fa-f]{4}/gu;

const listFiles = (dir, ext) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(rel, ext);
    return entry.name.endsWith(ext) ? [rel] : [];
});
const parse = (rel) => ts.createSourceFile(rel, fs.readFileSync(path.join(ROOT, rel), 'utf8'), ts.ScriptTarget.Latest, true,
    rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const wordsOf = (text) => [...new Set(String(text).match(WORD) || [])];

/** JSX에서 이 문자열 노드가 화면에 그려지는 자리인가 — 자식 · 조건 갈래 · 논리 연산의 값 · 화면 문구 속성. */
const isScreenOutput = (node) => {
    const parent = node.parent;
    if (!parent) return false;
    if (ts.isJsxExpression(parent)) {
        const holder = parent.parent;
        if (holder && (ts.isJsxElement(holder) || ts.isJsxFragment(holder))) return true;
        return Boolean(holder && ts.isJsxAttribute(holder) && TEXT_ATTRS.has(holder.name.getText()));
    }
    if (ts.isJsxAttribute(parent)) return TEXT_ATTRS.has(parent.name.getText());
    if (ts.isParenthesizedExpression(parent)) return isScreenOutput(parent);
    if (ts.isConditionalExpression(parent)) return (node === parent.whenTrue || node === parent.whenFalse) && isScreenOutput(parent);
    if (ts.isBinaryExpression(parent)) {
        const op = parent.operatorToken.kind;
        if (op === ts.SyntaxKind.AmpersandAmpersandToken) return node === parent.right && isScreenOutput(parent);
        if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return isScreenOutput(parent);
    }
    return false;
};

const literalText = (node) => (ts.isTemplateExpression(node)
    ? [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(' ')
    : node.text);

/** 컴포넌트가 화면에 그리는 문자열의 영어 낱말(허용 낱말 제외) — 파일:줄. */
export const findComponentEnglish = (files = listFiles('src', '.tsx')) => {
    const found = [];
    const allowedSeen = new Set();
    for (const rel of files) {
        const file = parse(rel);
        const check = (node, text) => {
            for (const word of wordsOf(text)) {
                if (ALLOWED_SCREEN_WORDS.has(word)) { allowedSeen.add(word); continue; }
                const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
                found.push(`${rel}:${line + 1} ${word} (${String(text).replace(/\s+/gu, ' ').trim().slice(0, 40)})`);
            }
        };
        const visit = (node) => {
            if (node.kind === ts.SyntaxKind.JsxText && node.text.trim()) check(node, node.text);
            else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) && isScreenOutput(node)) {
                check(node, literalText(node));
            }
            ts.forEachChild(node, visit);
        };
        visit(file);
    }
    return { found, allowedSeen };
};

/** MSG의 출력 문자열(값 · 반환식 · 조건 갈래 · 템플릿 조각)의 영어 낱말 — 키 경로. 명령어 안내 키는 따로 모은다. */
export const findMessageEnglish = (rel = 'src/data/messages.ts') => {
    const file = parse(rel);
    const found = [];
    const commandWords = new Set();
    const moduleConsts = new Map(file.statements
        .flatMap((statement) => (ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : []))
        .filter((decl) => ts.isIdentifier(decl.name) && decl.initializer)
        .map((decl) => [decl.name.text, decl.initializer]));
    const msg = moduleConsts.get('MSG');
    const target = msg && (ts.isAsExpression(msg) || ts.isSatisfiesExpression(msg)) ? msg.expression : msg;
    assert.ok(target && ts.isObjectLiteralExpression(target), 'MSG 객체를 찾았다');
    const resolved = new Set();
    // MSG가 모듈 상수를 그대로 싣는 값(STATUS_LABELS · DOT_LABELS …)은 그 상수의 값을 읽는다.
    const collectConst = (name, key) => {
        if (resolved.has(name) || !moduleConsts.has(name)) return;
        resolved.add(name);
        collect(moduleConsts.get(name), key);
    };
    const collect = (expr, key) => {
        if (!expr) return;
        if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr)) return collect(expr.expression, key);
        if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr) || ts.isTemplateExpression(expr)) {
            for (const word of wordsOf(literalText(expr))) {
                if (COMMAND_MESSAGE_KEY.test(key.split('.')[0])) commandWords.add(word);
                else found.push(`MSG.${key} ${word}`);
            }
            if (ts.isTemplateExpression(expr)) expr.templateSpans.forEach((span) => collect(span.expression, key));
            return;
        }
        if (ts.isIdentifier(expr)) return collectConst(expr.text, key);
        if (ts.isArrayLiteralExpression(expr)) { expr.elements.forEach((element) => collect(element, key)); return; }
        if (ts.isConditionalExpression(expr)) { collect(expr.whenTrue, key); collect(expr.whenFalse, key); return; }
        if (ts.isBinaryExpression(expr)) {
            const op = expr.operatorToken.kind;
            if (op === ts.SyntaxKind.AmpersandAmpersandToken) collect(expr.right, key);
            if ([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.PlusToken].includes(op)) {
                collect(expr.left, key);
                collect(expr.right, key);
            }
            return;
        }
        if (ts.isCallExpression(expr)) {
            const callee = expr.expression;
            // 낱말에 조사를 붙인 값(withJosa)은 그 낱말을, 배열을 이은 값(join · filter · map)은 그 배열과 각 칸의 값을 그린다.
            // 숫자 서식(toLocaleString('ko-KR'))의 인자는 코드 문자열이다.
            if (ts.isIdentifier(callee) && callee.text === 'withJosa') collect(expr.arguments[0], key);
            if (ts.isPropertyAccessExpression(callee) && ['join', 'filter', 'map'].includes(callee.name.text)) {
                collect(callee.expression, key);
                if (callee.name.text === 'map') collect(expr.arguments[0], key);
            }
            return;
        }
        if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
            if (ts.isBlock(expr.body)) {
                const visitReturns = (node) => {
                    if (ts.isReturnStatement(node)) collect(node.expression, key);
                    else if (!ts.isFunctionLike(node)) ts.forEachChild(node, visitReturns);
                };
                visitReturns(expr.body);
            } else collect(expr.body, key);
            return;
        }
        if (ts.isObjectLiteralExpression(expr)) {
            for (const prop of expr.properties) {
                if (ts.isPropertyAssignment(prop)) collect(prop.initializer, `${key}.${prop.name.getText(file)}`);
            }
        }
    };
    for (const prop of target.properties) {
        if (ts.isPropertyAssignment(prop)) collect(prop.initializer, prop.name.getText(file));
        else if (ts.isShorthandPropertyAssignment(prop)) collectConst(prop.name.text, prop.name.text);
        else if (ts.isMethodDeclaration(prop) && prop.body) {
            const visitReturns = (node) => {
                if (ts.isReturnStatement(node)) collect(node.expression, prop.name.getText(file));
                else if (!ts.isFunctionLike(node)) ts.forEachChild(node, visitReturns);
            };
            visitReturns(prop.body);
        }
    }
    return { found, commandWords };
};

/** 데이터(src/data) 밖 코드의 문장 — 한글이 든 문자열 · 템플릿 · JSX 텍스트에 섞인 영어 낱말(명령어 · 게임 이름 제외). */
export const findCodeSentenceEnglish = (commandWords, files = [...listFiles('src', '.ts'), ...listFiles('src', '.tsx')]) => {
    const found = [];
    for (const rel of files) {
        if (rel.startsWith('src/data/') || NON_SCREEN_CODE.some((pattern) => pattern.test(rel))) continue;
        const file = parse(rel);
        const visit = (node) => {
            let text = null;
            if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) text = literalText(node);
            else if (node.kind === ts.SyntaxKind.JsxText) text = node.text;
            if (text && HANGUL.test(text)) {
                for (const word of wordsOf(text.replace(UNICODE_ESCAPE, ' '))) {
                    if (ALLOWED_BRAND_WORDS.has(word) || commandWords.has(word)) continue;
                    const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
                    found.push(`${rel}:${line + 1} ${word} (${text.replace(/\s+/gu, ' ').trim().slice(0, 40)})`);
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(file);
    }
    return found;
};

/** 렌더한 HTML에서 사람이 읽는 것 — 글자와 화면 문구 속성(aria-label · title · alt · placeholder). */
const readableText = (html) => [
    html.replace(/<[^>]+>/gu, ' '),
    ...[...html.matchAll(/\s(?:aria-label|title|alt|placeholder)="([^"]*)"/gu)].map((match) => match[1]),
].join(' ').replace(/&[a-z#0-9]+;/giu, ' ');

const signatureEntries = () => {
    const items = [...DB.ITEMS.weapons, ...DB.ITEMS.armors];
    return Object.entries(SIGNATURE_ITEM_REGISTRY).map(([name, meta]) => ({ item: items.find((item) => item.name === name), meta }));
};

test('[화면] 컴포넌트가 그리는 문자열에 영어 낱말이 없다 — 게임 제목 로고만 예외', () => {
    const { found, allowedSeen } = findComponentEnglish();
    assert.deepEqual(found, []);
    assert.ok(allowedSeen.has('AETHERIA'), '검사가 실제로 화면 문자열을 읽었다(로고를 본다)');
});

test('[MSG] 화면 문구에 영어 낱말이 없다 — 터미널 명령어 안내의 명령 낱말만 예외', () => {
    const { found, commandWords } = findMessageEnglish();
    assert.deepEqual(found, []);
    for (const word of ['move', 'explore', 'help']) assert.ok(commandWords.has(word), `명령어 안내를 실제로 읽었다(${word})`);
});

test('[판별] 검사기는 출력 위치의 영어를 잡고 코드 문자열은 넘긴다', () => {
    const probe = path.join(ROOT, 'tests', `.screen-english-probe-${process.pid}.tsx`);
    fs.writeFileSync(probe, `
        const Probe = ({ busy, state }) => (
            <div className="text-[11px] uppercase" data-testid="probe" title="Boss">
                Legendary
                {busy ? '계승 중…' : 'New Game+'}
                {state === 'combat' && \`XP+\${3}%\`}
                {getLabel('ascension', 'kept')}
            </div>
        );
    `);
    try {
        const rel = path.relative(ROOT, probe).split(path.sep).join('/');
        const words = findComponentEnglish([rel]).found.map((line) => line.split(' ')[1]).sort();
        assert.deepEqual(words, ['Boss', 'Game', 'Legendary', 'New', 'XP']);
    } finally {
        fs.rmSync(probe, { force: true });
    }
});

test('[판별] MSG 검사기는 상수 · 배열 · 조사 · 잇기 · 더하기의 영어를 잡고 숫자 서식 인자는 넘긴다', () => {
    const probe = path.join(ROOT, 'tests', `.screen-english-msg-probe-${process.pid}.ts`);
    fs.writeFileSync(probe, `
        const LABELS = { burn: 'Burn' } satisfies Record<string, string>;
        const STAGES = ['처치', 'Elite'];
        export const MSG = {
            LABELS,
            STAGES,
            NAMED: (name) => withJosa(\`Hero \${name}\`, '을'),
            JOINED: (tags) => [tags.a ? 'Fast' : '', '느림'].filter(Boolean).join(' · '),
            MAPPED: (levels) => levels.map((level) => \`Lv\${level}\`).join(', '),
            ADDED: (gold) => '골드 ' + gold.toLocaleString('ko-KR') + ' Gold',
            CMD_HELP: '이동: move <지역>',
        };
    `);
    try {
        const rel = path.relative(ROOT, probe).split(path.sep).join('/');
        const { found, commandWords } = findMessageEnglish(rel);
        assert.deepEqual(found.map((line) => line.split(' ')[1]).sort(), ['Burn', 'Elite', 'Fast', 'Gold', 'Hero', 'Lv']);
        assert.deepEqual([...commandWords], ['move']);
    } finally {
        fs.rmSync(probe, { force: true });
    }
});

test('[뷰모델] 데이터 밖 코드의 문장에 영어 낱말이 없다 — 명령어 · 게임 이름만 예외', () => {
    const { commandWords } = findMessageEnglish();
    assert.deepEqual(findCodeSentenceEnglish(commandWords), []);
    // 판별: 같은 검사기가 문장 속 영어를 잡고, 명령어 · 게임 이름 · 정규식 이스케이프는 넘긴다.
    const probe = path.join(ROOT, 'tests', `.screen-english-code-probe-${process.pid}.ts`);
    fs.writeFileSync(probe, [
        "export const a = (n) => `보스 토벌 ${n}회 — 다음 signature 드롭 확률`;",
        "export const b = `⚔️ AETHERIA RUN ENDED\\n#에테리아 #AetheriaRPG`;",
        "export const c = '이동 (move <지역명>)';",
        "export const d = new RegExp('(?:(으로|[을를])(?![\\\\uAC00-\\\\uD7A3]))?');",
        "export const e = 'data-testid';",
    ].join('\n'));
    try {
        const rel = path.relative(ROOT, probe).split(path.sep).join('/');
        const words = findCodeSentenceEnglish(commandWords, [rel]).map((line) => line.split(' ')[1]).sort();
        assert.deepEqual(words, ['ENDED', 'RUN', 'signature']);
    } finally {
        fs.rmSync(probe, { force: true });
    }
});

test('[전설 각인] 획득 화면과 도감 상세는 25개 모두 한국어만 그리고, 능력치는 변환기 값이다', () => {
    const entries = signatureEntries();
    assert.equal(entries.length, 25);
    for (const { item, meta } of entries) {
        assert.ok(item, '레지스트리의 각인이 장비 데이터에 있다');
        const overlay = renderStatic(createElement(LegendaryDropOverlay, { item, onDismiss: () => {} }));
        const detail = renderStatic(createElement(LegendaryCodexDetail, { entry: { item, meta } }));
        for (const [surface, html] of [['획득 화면', overlay], ['도감 상세', detail]]) {
            const text = readableText(html);
            assert.ok(text.includes(item.name), `${surface}가 ${item.name}을 그렸다`);
            assert.deepEqual(wordsOf(text), [], `${surface} · ${item.name}: ${text.replace(/\s+/gu, ' ').trim()}`);
            assert.ok(!text.includes(meta.artNote), `${surface}는 그림 생성 지시문을 그리지 않는다(${item.name})`);
        }
        assert.ok(readableText(overlay).includes(item.desc), `획득 화면은 아이템 설명을 그린다(${item.name})`);
        assert.ok(readableText(detail).includes(getItemStatText(item)), `도감 상세의 능력치는 장비 화면과 같은 값이다(${item.name})`);
        assert.ok(!readableText(detail).includes(item.desc_stat), `도감 상세는 데이터의 desc_stat을 그리지 않는다(${item.name})`);
    }
});

test('[부재] 화면 코드는 레지스트리의 그림 생성 지시문(artNote)을 읽지 않는다', () => {
    const readers = [];
    for (const rel of listFiles('src/components', '.tsx')) {
        const file = parse(rel);
        const visit = (node) => {
            if ((ts.isPropertyAccessExpression(node) || ts.isPropertyAccessChain?.(node)) && node.name.text === 'artNote') {
                readers.push(`${rel}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`);
            }
            ts.forEachChild(node, visit);
        };
        visit(file);
    }
    assert.deepEqual(readers, []);
});
