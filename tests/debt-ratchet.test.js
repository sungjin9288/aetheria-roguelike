import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * Wave 4 Track P — 부채 래칫(ratchet) 회귀 가드.
 *
 * 이 파일은 "얼마나 깨끗한가"를 판정하지 않는다. Wave 3 종료 시점(HEAD)에서 실측한
 * 값을 *상한선*으로 고정해, 이후 커밋이 부채를 몰래 늘리는 것만 막는다.
 *
 * 각 BASELINE 상수는 오직 "낮추는" 방향으로만 고칠 것 — 회귀를 감춘다며 값을 올리는
 * 수정은 이 파일의 존재 목적을 무효화한다. 실측이 개선(감소)되면 BASELINE도 같이
 * 낮춰서 그 개선을 다시 래칫으로 고정한다.
 *
 * 카운터는 전부 `fs`로 직접 읽는다(셸 아웃/`grep` 없음) — CI 환경 차이 없이 동일하게
 * 재현되어야 하기 때문이다.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** src 트리를 재귀 탐색해 주어진 확장자의 파일 절대경로 목록을 반환한다. */
function listFiles(startDir, exts) {
    const absStart = path.join(ROOT, startDir);
    let out = [];
    let entries;
    try {
        entries = fs.readdirSync(absStart, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries) {
        const full = path.join(absStart, entry.name);
        if (entry.isDirectory()) {
            out = out.concat(listFiles(path.relative(ROOT, full), exts));
        } else if (exts.some((ext) => entry.name.endsWith(ext))) {
            out.push(full);
        }
    }
    return out;
}

/** ROOT 기준 상대경로(슬래시 통일) — 리포트/에러 메시지용. */
const rel = (absPath) => absPath.split(path.sep).join('/').slice(ROOT.split(path.sep).join('/').length + 1);

/** 파일별 매치 개수를 세고, {total, perFile: [[relPath, count], ...] (내림차순)} 로 반환. */
function countMatches(files, regex, preprocess = (source) => source) {
    let total = 0;
    const perFile = [];
    for (const file of files) {
        const content = preprocess(fs.readFileSync(file, 'utf8'));
        const matches = content.match(regex);
        if (matches && matches.length > 0) {
            total += matches.length;
            perFile.push([rel(file), matches.length]);
        }
    }
    perFile.sort((a, b) => b[1] - a[1]);
    return { total, perFile };
}

/** 주석(라인 주석 · 블록 주석 시작줄)을 제거한 소스 — 문자열 리터럴 탐지의 오탐을 줄인다. */
function stripCommentLines(source) {
    return source
        .split('\n')
        .filter((line) => {
            const t = line.trim();
            return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
        })
        .join('\n');
}

/** 문자열/템플릿 리터럴 중 한글(자모+음절)이 포함된 것만 세어 {total, perFile} 로 반환. */
function countKoreanStringLiterals(files) {
    const STRING_RE = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
    const KOREAN_RE = /[ㄱ-ㆎ가-힣]/;
    let total = 0;
    const perFile = [];
    for (const file of files) {
        const stripped = stripCommentLines(fs.readFileSync(file, 'utf8'));
        const literals = stripped.match(STRING_RE) || [];
        const count = literals.filter((lit) => KOREAN_RE.test(lit)).length;
        if (count > 0) {
            total += count;
            perFile.push([rel(file), count]);
        }
    }
    perFile.sort((a, b) => b[1] - a[1]);
    return { total, perFile };
}

/** 실패 메시지에 상위 offender 파일 목록을 붙인다. */
function formatOffenders(perFile, limit = 20) {
    if (perFile.length === 0) return '(no offending files found — check the regex)';
    return perFile
        .slice(0, limit)
        .map(([f, n]) => `  ${f}: ${n}`)
        .join('\n');
}

// ── (a) 명시적 `: any` ──────────────────────────────────────────────────────
// 2026-09 Wave 3 L 실측 기준 이 워크트리에서 재측정한 값. 계획서(§0/§7.1)의 근사치
// "~1,220"과 다를 수 있는 것은 정상 — 이 파일은 그 근사치가 아니라 아래 정확한 정규식으로
// *이 커밋에서* 실측한 값을 상한선으로 고정한다.
// 2026-09-17 재고정: codex/release-complete-core(41커밋)를 베이스로 병합하면서 Codex 쪽 신규 코드가
//   합류해 실측치가 올랐다(any 1466→1581, as any 71→99, systems 한글 144→260, reducers 24→26).
//   병합 직후 HEAD 실측을 새 기준선으로 삼는다 — 이후로는 다시 "하락만 허용".
// 2026-09-17 Wave 5(W2 Player any[] 3개 + W5 utils 8파일 슬라이스) 실측으로 재고정: 1581 → 1301.
const ANY_BASELINE = 1;

test(`debt-ratchet: 명시적 ": any" 개수는 ${ANY_BASELINE}건을 넘지 않는다 (하락만 허용)`, () => {
    const files = listFiles('src', ['.ts', '.tsx']);
    // Wave 9 A5: 주석(`[key: string]: any` 제거 이력 문구 등)은 코드가 아니므로 제외한다.
    const { total, perFile } = countMatches(files, /:\s*any\b/g, stripCommentLines);

    assert.ok(
        total <= ANY_BASELINE,
        `명시적 ": any" 가 ${total}건으로 기준선(${ANY_BASELINE}건)을 초과했다. ` +
        `상위 offender:\n${formatOffenders(perFile)}`,
    );
});

// ── (b) `as any` ────────────────────────────────────────────────────────────
// 2026-09-17 Wave 5 실측으로 재고정: 99 → 83 (stale 캐스트 제거분, 신규 as any 0).
const AS_ANY_BASELINE = 0;

test(`debt-ratchet: "as any" 캐스트 개수는 ${AS_ANY_BASELINE}건을 넘지 않는다 (하락만 허용)`, () => {
    const files = listFiles('src', ['.ts', '.tsx']);
    const { total, perFile } = countMatches(files, /\bas\s+any\b/g, stripCommentLines);

    assert.ok(
        total <= AS_ANY_BASELINE,
        `"as any" 캐스트가 ${total}건으로 기준선(${AS_ANY_BASELINE}건)을 초과했다. ` +
        `상위 offender:\n${formatOffenders(perFile)}`,
    );
});

// ── (c) src/types/*.ts 인덱스 시그니처 ───────────────────────────────────────
// L 트랙에서 Relic/Item/Monster/GameMap/Quest/Achievement/ClassDef까지 닫아 0건이 됐다.
// 이 값은 "상한"이 아니라 "고정값"이다 — 하나라도 다시 생기면 `relic.오타` 같은 필드
// 오타가 다시 컴파일을 통과하게 되므로 반드시 0이어야 한다.
const INDEX_SIGNATURE_BASELINE = 0;

test('debt-ratchet: src/types/*.ts 에 인덱스 시그니처가 다시 생기지 않는다 (0건 고정)', () => {
    const files = listFiles('src/types', ['.ts']);
    let total = 0;
    const offenders = [];
    for (const file of files) {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, idx) => {
            if (/^\s*\[key: string\]/.test(line)) {
                total += 1;
                offenders.push(`  ${rel(file)}:${idx + 1}: ${line.trim()}`);
            }
        });
    }

    assert.equal(
        total,
        INDEX_SIGNATURE_BASELINE,
        `src/types/*.ts 에 인덱스 시그니처 ${total}건 발견 — 0건이어야 한다:\n${offenders.join('\n')}`,
    );
});

// ── (d) src/systems/** · src/reducers/** 한국어 문자열 리터럴 ────────────────
// `tests/engine-msg-ownership.test.js` (Wave 3 H4)가 이미 특정 문구(실명/공포 미스,
// 귀환 보급, 탐험 이상기후·열쇠·유물 발견 등)를 MSG 소유로 못 박아 뒀다 — 여기서는
// 그 구체적 문구들을 다시 검사하지 않는다(중복 금지). 이 테스트는 그보다 넓게,
// "systems/reducers 안에 messages.ts 밖 한글 문자열 리터럴이 몇 개인가"를 총량으로
// 잡아서 새로운 하드코딩이 조용히 늘어나는 것만 막는 안전망이다. 개별 문자열이
// 데이터 키(예: 상태이상 이름 비교)인지 로그 문구인지는 구분하지 않는다.
// 2026-09 Wave 6 X2 재고정: 260 → 122 (CombatEngine.actions/enemyAI/status/relics/outcome.ts,
//   DifficultyManager.ts, endgameSettlement.ts 감사, combatActionTurn/combatItemTurn.ts,
//   FeedbackValidator.ts, TokenQuotaManager.ts, consumableEffect.ts를 MSG로 이관하고
//   상태이상 라벨 테이블을 MSG.STATUS_LABELS/DOT_LABELS로 단일화. 남은 값은 *Audit.ts
//   증빙 스크립트(SHA-bound, 미변경)와 데이터 식별자 리터럴(몬스터/맵/직업명 비교 등)뿐이다.
const SYSTEMS_KOREAN_STRING_BASELINE = 122;
const REDUCERS_KOREAN_STRING_BASELINE = 26;

test(`debt-ratchet: src/systems/** 한글 문자열 리터럴은 ${SYSTEMS_KOREAN_STRING_BASELINE}건을 넘지 않는다 (하락만 허용, engine-msg-ownership.test.js와 별개)`, () => {
    const files = listFiles('src/systems', ['.ts', '.tsx']);
    const { total, perFile } = countKoreanStringLiterals(files);

    assert.ok(
        total <= SYSTEMS_KOREAN_STRING_BASELINE,
        `src/systems/** 한글 문자열 리터럴이 ${total}건으로 기준선(${SYSTEMS_KOREAN_STRING_BASELINE}건)을 초과했다. ` +
        `MSG 객체로 옮겼는지 확인할 것. 상위 offender:\n${formatOffenders(perFile)}`,
    );
});

test(`debt-ratchet: src/reducers/** 한글 문자열 리터럴은 ${REDUCERS_KOREAN_STRING_BASELINE}건을 넘지 않는다 (하락만 허용, engine-msg-ownership.test.js와 별개)`, () => {
    const files = listFiles('src/reducers', ['.ts', '.tsx']);
    const { total, perFile } = countKoreanStringLiterals(files);

    assert.ok(
        total <= REDUCERS_KOREAN_STRING_BASELINE,
        `src/reducers/** 한글 문자열 리터럴이 ${total}건으로 기준선(${REDUCERS_KOREAN_STRING_BASELINE}건)을 초과했다. ` +
        `MSG 객체로 옮겼는지 확인할 것. 상위 offender:\n${formatOffenders(perFile)}`,
    );
});

// ── (e) src/systems/** 안의 Math.random( 직접 호출 ──────────────────────────
// CLAUDE.md §8 "전투 턴 authority": CombatEngine 등 systems/** 는 seeded RNG 스트림만
// 써야 한다 — `Math.random` 직접 호출은 결정론 테스트를 깨뜨린다. 현재 0건이며
// 상한이 아니라 고정값이다.
const SYSTEMS_MATH_RANDOM_BASELINE = 0;

test('debt-ratchet: src/systems/** 안에서 Math.random(을 직접 호출하지 않는다 (0건 고정, CombatEngine은 seeded)', () => {
    const files = listFiles('src/systems', ['.ts', '.tsx']);
    const { total, perFile } = countMatches(files, /Math\.random\(/g);

    assert.equal(
        total,
        SYSTEMS_MATH_RANDOM_BASELINE,
        `src/systems/** 에서 Math.random( 직접 호출 ${total}건 발견 — 0건이어야 한다. ` +
        `seed 스트림을 쓸 것. 상위 offender:\n${formatOffenders(perFile)}`,
    );
});

// ── (f) src/** (src/data 제외) 디렉터리별 AST 기준 한글 노드 개수 ────────────
// Wave 20 §24 실측 4: (d)의 정규식 카운터(`countKoreanStringLiterals`)는 따옴표로
// 감싸인 문자열/템플릿 리터럴만 본다 — JSX 태그 사이의 텍스트 노드(`JsxText`,
// 예: `<span>한국어</span>`)는 따옴표가 없으므로 **구조적으로 0으로 센다**.
// AST 스캔(TypeScript compiler API)으로 재보면 src/components/**에만 JsxText
// 한글 노드가 549개 있다 — 이것이 정확히 CLAUDE.md §5 DON'T "컴포넌트 JSX 안에
// 한국어 직접 입력 금지"가 가리키는 대상이고, (d)는 이 클래스의 회귀를 못 잡는다.
//
// (f)는 `ts.createSourceFile`로 파일마다 파싱만 하고(타입체크 없음 — 빠르게 유지)
// StringLiteral · NoSubstitutionTemplateLiteral · TemplateHead/Middle/Tail ·
// JsxText 중 한글(자모+음절)을 포함한 노드를 센다. 주석은 애초에 이 노드 종류가
// 아니므로 별도 처리 없이 제외된다.
//
// (d)는 손대지 않는다 — 카운팅 *방법*을 바꾸는 것은 래칫이 아니라 재고정이다.
// (f)는 src/systems·src/reducers도 다시 세지만 값이 (d)와 다르다(AST 120/29 vs
// 정규식 122/26) — 같은 디렉터리를 두 방법으로 재는 대조 자체가 "정규식이 JSX를
// 놓친다"는 근거를 계약 안에 남긴다(§24 결함 주입 표: 같은 주입에 (d)는 초록,
// (f)는 red).
//
// `typescript`는 이미 devDependency다(package.json) — 새 의존 추가 없음.

const KOREAN_RE = /[ㄱ-ㆎ가-힣]/;
const KOREAN_AST_NODE_KINDS = new Set([
    ts.SyntaxKind.StringLiteral,
    ts.SyntaxKind.NoSubstitutionTemplateLiteral,
    ts.SyntaxKind.TemplateHead,
    ts.SyntaxKind.TemplateMiddle,
    ts.SyntaxKind.TemplateTail,
    ts.SyntaxKind.JsxText,
]);

/** 파일 하나를 파싱해(타입체크 없음) 한글 포함 AST 노드 개수를 센다. */
function countKoreanAstNodesInFile(file) {
    const source = fs.readFileSync(file, 'utf8');
    const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, scriptKind);
    let count = 0;
    const visit = (node) => {
        if (KOREAN_AST_NODE_KINDS.has(node.kind) && KOREAN_RE.test(node.text ?? '')) {
            count += 1;
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return count;
}

/** `src/<dir>/**` 전체(.ts/.tsx)를 스캔해 {total, perFile} 로 반환한다. */
function countKoreanAstNodesInDir(dir) {
    const files = listFiles(dir, ['.ts', '.tsx']);
    let total = 0;
    const perFile = [];
    for (const file of files) {
        const count = countKoreanAstNodesInFile(file);
        if (count > 0) {
            total += count;
            perFile.push([rel(file), count]);
        }
    }
    perFile.sort((a, b) => b[1] - a[1]);
    return { total, perFile };
}

// 2026-09-21 Wave 20 L3 착수 시점(HEAD `49defbc9`, 이 워크트리) 실측값을 그대로
// 상한으로 고정한다 — src/ 바로 아래의 모든 디렉터리(src/data 제외) 전수. 새
// 디렉터리가 생기면 아래 테스트가 "상한 없음"으로 먼저 red가 되어 실측 없이
// 조용히 빠지는 것을 막는다(§7 부재/상한 가드).
const AST_KOREAN_CEILINGS = {
    assets: 0,
    components: 1319,
    hooks: 285,
    platform: 0,
    pwa: 0,
    reducers: 29,
    services: 32,
    systems: 120,
    types: 16,
    utils: 2001,
};

test('debt-ratchet: src/** (src/data 제외) 디렉터리별 AST 한글 노드 개수는 각 상한을 넘지 않는다 (하락만 허용, StringLiteral·템플릿 조각·JsxText 포함)', () => {
    const srcAbs = path.join(ROOT, 'src');
    const topDirs = fs.readdirSync(srcAbs, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== 'data')
        .map((entry) => entry.name)
        .sort();

    const missingBaseline = topDirs.filter((dir) => !(dir in AST_KOREAN_CEILINGS));
    assert.deepEqual(
        missingBaseline,
        [],
        `src/ 바로 아래에 상한이 없는 새 디렉터리가 있다: ${missingBaseline.join(', ')}. ` +
        `실측해서 AST_KOREAN_CEILINGS에 상한을 추가할 것 — 데이터 없이 통과시키지 말 것.`,
    );

    const failures = [];
    for (const dir of topDirs) {
        const ceiling = AST_KOREAN_CEILINGS[dir];
        const { total, perFile } = countKoreanAstNodesInDir(`src/${dir}`);
        if (total > ceiling) {
            failures.push(
                `src/${dir}: ${total}건으로 기준선(${ceiling}건)을 초과했다. 상위 offender:\n` +
                formatOffenders(perFile, 5),
            );
        }
    }

    assert.ok(
        failures.length === 0,
        `AST 기준 한글 노드(StringLiteral·템플릿 조각·JsxText)가 상한을 초과한 디렉터리가 있다:\n\n${failures.join('\n\n')}`,
    );
});
