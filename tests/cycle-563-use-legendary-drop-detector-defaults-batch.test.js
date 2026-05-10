import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 563: useLegendaryDropDetector `dispatch = null` + `codex = null`
 *   2 defaults batch unreachable (cycle 222-562 silent dead config 시리즈
 *   303번째 — redundant default annotation 청소 메가 시리즈 56번째).
 *
 * 발견 (2 defaults batch):
 * - src/hooks/useLegendaryDropDetector.ts (line 34):
 *     export const useLegendaryDropDetector = (inv: any, dispatch: any = null,
 *         codex: any = null) => {...};
 * - 호출 사이트 (1 caller):
 *     · GameRoot.tsx:32 — useLegendaryDropDetector(engine.player?.inv,
 *       engine.dispatch, engine.player?.stats?.codex) — 3 args 명시.
 *     · 다른 caller 0건 (test caller 0건).
 * - 결과: dispatch / codex 항상 명시 전달. 두 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-562 시리즈 303번째):
 * - cycle 502-562: default 청소 메가 시리즈 61사이클.
 * - cycle 563: hooks/ 추가 cleanup — cycle 532/534/535/543에 이은 hooks/.
 *
 * 수정 (src/hooks/useLegendaryDropDetector.ts):
 * - signature에서 dispatch: any = null → dispatch: any.
 * - signature에서 codex: any = null → codex: any.
 * - body의 codexRef 처리 + dispatch 호출 보존.
 *
 * 회귀 가드:
 * - 1 production callsite 동작 그대로.
 * - body codexRef / queueRef / dispatch 처리 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 563: useLegendaryDropDetector signature에서 2 defaults 0건', async () => {
    const source = await readSrc('src/hooks/useLegendaryDropDetector.ts');
    const fnIdx = source.indexOf('export const useLegendaryDropDetector');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/dispatch:\s*any\s*=\s*null/.test(sig),
        'useLegendaryDropDetector dispatch default null 제거');
    assert.ok(!/codex:\s*any\s*=\s*null/.test(sig),
        'useLegendaryDropDetector codex default null 제거');
});

test('cycle 563: 정합성 가드 — 1 production callsite 보존', async () => {
    const source = await readSrc('src/components/app/GameRoot.tsx');
    assert.ok(/useLegendaryDropDetector\(engine\.player\?\.inv,\s*engine\.dispatch,\s*engine\.player\?\.stats\?\.codex\)/.test(source),
        'GameRoot useLegendaryDropDetector 3 args callsite 보존');
});

test('cycle 563: body codexRef / queueRef / dispatch 처리 보존', async () => {
    const source = await readSrc('src/hooks/useLegendaryDropDetector.ts');
    assert.ok(/const codexRef = useRef<any>\(codex\)/.test(source),
        'codexRef useRef(codex) 보존');
    assert.ok(/const queueRef = useRef<any\[\]>\(\[\]\)/.test(source),
        'queueRef useRef<any[]>([]) 보존');
});

test('cycle 563: cycle 502-562 회귀 가드 — default 청소 시리즈 보존', async () => {
    const helpers = await readSrc('src/reducers/handlers/helpers.ts');
    assert.ok(!/sanitizeQuickSlots[^=]*slots:\s*any\s*=\s*\[\]/.test(helpers),
        'cycle 562 sanitizeQuickSlots slots default 0건');

    const aiu = await readSrc('src/utils/aiEventUtils.ts');
    assert.ok(!/export const buildEventPackage[^=]*context:\s*any\s*=\s*\{\}/.test(aiu),
        'cycle 561 buildEventPackage context default 0건');
});
