// 2026-10 Wave 135(원장 §148) — src의 모든 파일은 앱(src/main.tsx)이나 저장소 도구(scripts)가 쓴다. 테스트만 붙드는 src 파일은 죽은 코드다.
//
// 렌더하는 곳이 없는 컴포넌트가 두 웨이브 연달아 나왔다 — DashboardMobileSummary(Wave 134에 지움)와 터미널 명령 자동 완성
// (CommandAutocomplete + getAvailableCommands, Wave 135에 지움 — 앱에 명령 입력창 자체가 없었다). 테스트가 그 파일을 import해서 살아 있는
// 것처럼 보였고, Wave 61 · 62 · 134는 아무도 보지 못하는 문구를 고쳤다.
//
// 앱에서 닿는 파일은 import 그래프(정적 import · export from · 동적 import())를 앱 진입점에서 따라간 것이다. 증빙 · 측정 도구(scripts)가 쓰는
// 모듈을 더한다 — 도구는 자식 프로세스에 경로 문자열로 넘기기도 하므로(`'./src/systems/….ts'`) 도구의 문자열 속 src 경로도 참조로 센다.
// 컴포넌트는 앱에서 닿아야 한다(도구가 그리는 화면은 없다).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_ENTRY = path.join(ROOT, 'src', 'main.tsx');
const SCRIPT_SKIP_DIRS = new Set(['art_sources', 'node_modules', '__pycache__']);
const SRC_PATH_IN_STRING = /(?:^|[^\w/.-])(?:\.\/)?(src\/[\w./-]+?\.tsx?)(?![\w.])/gu;

const listFiles = (dir, keep, skipDirs = new Set()) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return skipDirs.has(entry.name) ? [] : listFiles(full, keep, skipDirs);
    return keep(entry.name) ? [full] : [];
});
const listSrcFiles = () => listFiles(path.join(ROOT, 'src'), (name) => /\.tsx?$/u.test(name) && !name.endsWith('.d.ts'));
const listScriptFiles = () => listFiles(path.join(ROOT, 'scripts'), (name) => /\.(?:mjs|cjs|js|ts)$/u.test(name), SCRIPT_SKIP_DIRS);
const readReal = (file) => fs.readFileSync(file, 'utf8');

/** 앱 진입점과 도구에서 import 그래프로 닿는 src 파일. 읽기 함수를 주입하면 가상의 파일로 판별을 확인할 수 있다. */
export const analyzeReachability = ({ srcFiles = listSrcFiles(), scriptFiles = listScriptFiles(), readFile = readReal } = {}) => {
    const known = new Set([...srcFiles, ...scriptFiles]);
    const resolve = (from, spec) => {
        if (!spec.startsWith('.')) return null;
        const base = path.resolve(path.dirname(from), spec);
        const stem = base.replace(/\.(?:jsx?|tsx?|mjs|cjs)$/u, '');
        return [base, `${stem}.ts`, `${stem}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find((candidate) => known.has(candidate)) || null;
    };
    const referencesOf = (file) => {
        const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : (file.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
        const source = ts.createSourceFile(file, readFile(file), ts.ScriptTarget.Latest, true, kind);
        const isScript = !file.startsWith(path.join(ROOT, 'src') + path.sep);
        const targets = [];
        const visit = (node) => {
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
                targets.push(resolve(file, node.moduleSpecifier.text));
            } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
                && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
                targets.push(resolve(file, node.arguments[0].text));
            } else if (isScript && (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))) {
                for (const match of node.text.matchAll(SRC_PATH_IN_STRING)) {
                    const target = path.join(ROOT, match[1]);
                    if (known.has(target)) targets.push(target);
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
        return targets.filter(Boolean);
    };
    const walk = (roots) => {
        const seen = new Set(roots);
        const queue = [...roots];
        while (queue.length) {
            for (const target of referencesOf(queue.shift())) {
                if (!seen.has(target)) {
                    seen.add(target);
                    queue.push(target);
                }
            }
        }
        return seen;
    };
    const fromApp = walk([APP_ENTRY]);
    const fromAll = walk([APP_ENTRY, ...scriptFiles]);
    const rel = (file) => path.relative(ROOT, file).split(path.sep).join('/');
    return {
        fromApp,
        unreachable: srcFiles.filter((file) => !fromAll.has(file)).map(rel).sort(),
        componentsOutsideApp: srcFiles
            .filter((file) => file.startsWith(path.join(ROOT, 'src', 'components') + path.sep) && !fromApp.has(file))
            .map(rel).sort(),
    };
};

test('[도달] src의 모든 파일은 앱 진입점이나 저장소 도구(scripts)에서 닿는다 — 테스트만 붙드는 파일이 없다', () => {
    const { fromApp, unreachable } = analyzeReachability();
    assert.deepEqual(unreachable, []);
    // 공허참 방지: 앱 그래프가 실제로 화면 · 엔진 · 리듀서까지 따라갔다.
    for (const file of ['src/App.tsx', 'src/components/app/GameRoot.tsx', 'src/components/TerminalView.tsx', 'src/hooks/useGameEngine.ts',
        'src/reducers/gameReducer.ts', 'src/systems/CombatEngine.ts']) {
        assert.ok(fromApp.has(path.join(ROOT, file)), `앱에서 닿는다: ${file}`);
    }
});

test('[도달] 컴포넌트는 앱에서 닿는다 — 렌더하는 곳이 없는 컴포넌트가 없다', () => {
    assert.deepEqual(analyzeReachability().componentsOutsideApp, []);
});

test('[판별] 아무도 import하지 않는 컴포넌트 · 도구만 쓰는 모듈 · 경로 문자열 참조를 구분한다', () => {
    const srcFiles = listSrcFiles();
    const scriptFiles = listScriptFiles();
    const orphan = path.join(ROOT, 'src', 'components', 'ReachabilityProbe.tsx');
    const toolOnly = path.join(ROOT, 'src', 'utils', 'reachabilityProbeTool.ts');
    const probeScript = path.join(ROOT, 'scripts', 'reachability-probe.mjs');
    const overlay = (extra) => (file) => (file in extra ? extra[file] : readReal(file));
    const files = { srcFiles: [...srcFiles, orphan, toolOnly], scriptFiles: [...scriptFiles, probeScript] };
    // 판별은 가상의 탐침 파일만 본다 — 저장소의 실제 상태는 위 두 테스트의 몫이다.
    const probes = (result) => ({
        unreachable: result.unreachable.filter((file) => file.includes('eachabilityProbe')),
        componentsOutsideApp: result.componentsOutsideApp.filter((file) => file.includes('eachabilityProbe')),
    });

    // 1) 아무도 부르지 않으면 컴포넌트 · 모듈 모두 죽은 코드다.
    const none = probes(analyzeReachability({ ...files, readFile: overlay({ [orphan]: 'export default () => null;\n', [toolOnly]: 'export const x = 1;\n',
        [probeScript]: 'console.log(1);\n' }) }));
    assert.deepEqual(none.unreachable, ['src/components/ReachabilityProbe.tsx', 'src/utils/reachabilityProbeTool.ts']);
    assert.deepEqual(none.componentsOutsideApp, ['src/components/ReachabilityProbe.tsx']);

    // 2) 도구가 경로 문자열로 넘기는 모듈은 쓰이는 것이다. 컴포넌트를 도구만 부르면 여전히 앱 밖이다.
    const viaTool = probes(analyzeReachability({ ...files, readFile: overlay({ [orphan]: 'export default () => null;\n', [toolOnly]: 'export const x = 1;\n',
        [probeScript]: "run(\"import { x } from './src/utils/reachabilityProbeTool.ts'; import P from './src/components/ReachabilityProbe.tsx';\");\n" }) }));
    assert.deepEqual(viaTool.unreachable, []);
    assert.deepEqual(viaTool.componentsOutsideApp, ['src/components/ReachabilityProbe.tsx']);

    // 3) 앱이 import하면(.jsx 지정자도 .tsx로 푼다) 컴포넌트가 닿는다.
    const main = readReal(APP_ENTRY);
    const viaApp = probes(analyzeReachability({ ...files, readFile: overlay({ [orphan]: 'export default () => null;\n',
        [toolOnly]: 'export const x = 1;\n', [probeScript]: "run('./src/utils/reachabilityProbeTool.ts');\n",
        [APP_ENTRY]: `import Probe from './components/ReachabilityProbe.jsx';\n${main}` }) }));
    assert.deepEqual(viaApp.unreachable, []);
    assert.deepEqual(viaApp.componentsOutsideApp, []);
});
