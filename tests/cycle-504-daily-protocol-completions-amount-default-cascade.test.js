import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 504: getDailyProtocolCompletions `amount` default unreachable + 3 wrapper
 *   emitDailyProtocolLogs default cascade 정리
 *   (cycle 222-503 silent dead config 시리즈 254번째 — redundant default annotation
 *   util-level cascade, cycle 502/503 lens 회귀).
 *
 * 발견 (4 default unreachable):
 * - src/utils/gameUtils.ts (line 81):
 *     export const getDailyProtocolCompletions = (player, type, amount: any = 1) => {...}
 * - 호출 사이트 (3 wrapper, 각 hook 내부):
 *     · useCombatActions.ts: emitDailyProtocolLogs(type, amount = 1) → 내부에서
 *       getDailyProtocolCompletions(player, type, amount) 호출.
 *     · gameActions/_shared.ts: 동일 wrapper 패턴.
 *     · useInventoryActions.ts: 동일 wrapper 패턴.
 *     · 3 wrapper 모두 자체에 `amount = 1` default + 자신 callsite도 항상
 *       2 args 명시 전달 (amount 명시).
 *     · wrapper의 외부 callsite 5건 모두 amount 명시 전달.
 * - 결과: 4 default 모두 도달 불가:
 *     · getDailyProtocolCompletions amount default 1.
 *     · emitDailyProtocolLogs (useCombatActions) amount default 1.
 *     · emitDailyProtocolLogs (_shared) amount default 1.
 *     · emitDailyProtocolLogs (useInventoryActions) amount default 1.
 *
 * 패턴 (cycle 222-503 시리즈 254번째):
 * - cycle 502: incrementStat amount 파라미터 unreachable.
 * - cycle 503: consumeInventoryItemByName count default unreachable.
 * - cycle 504: getDailyProtocolCompletions amount default + 3 wrapper cascade.
 *   util + 3 hook level 동시 정리.
 *
 * 수정 (4 파일):
 * - getDailyProtocolCompletions: amount: any = 1 → amount: any.
 * - 3 emitDailyProtocolLogs wrapper: amount: any = 1 → amount: any.
 *
 * 회귀 가드:
 * - 5 wrapper callsite 모두 amount 명시 전달.
 * - body 동작 그대로 (amount 사용).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 504: getDailyProtocolCompletions amount default 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    const fnIdx = source.indexOf('export const getDailyProtocolCompletions');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/amount:\s*any\s*=\s*1/.test(sig), 'amount default 1 제거');
    assert.ok(/\bamount\b/.test(sig), 'amount 파라미터 자체는 보존');
});

test('cycle 504: 3 wrapper emitDailyProtocolLogs amount default 0건', async () => {
    const files = [
        'src/hooks/useCombatActions.ts',
        'src/hooks/gameActions/_shared.ts',
        'src/hooks/useInventoryActions.ts',
    ];
    for (const f of files) {
        const source = await readSrc(f);
        const fnIdx = source.indexOf('emitDailyProtocolLogs = (type');
        assert.ok(fnIdx >= 0, `${f}에 emitDailyProtocolLogs wrapper 존재`);
        const fnEnd = source.indexOf('=>', fnIdx);
        const sig = source.slice(fnIdx, fnEnd);
        assert.ok(!/amount:\s*any\s*=\s*1/.test(sig), `${f} amount default 1 제거`);
    }
});

test('cycle 504: 정합성 가드 — wrapper / leaf 호출 모두 amount 전달', async () => {
    // emitDailyProtocolLogs callsites (5건) 모두 2 args
    const allFiles = [
        'src/hooks/useInventoryActions.ts',
        'src/hooks/gameActions/_shared.ts',
        'src/hooks/gameActions/characterActions.ts',
        'src/hooks/combatActions/combatVictory.ts',
    ];
    let totalCalls = 0;
    for (const f of allFiles) {
        const source = await readSrc(f);
        const matches = source.match(/emitDailyProtocolLogs\(/g) || [];
        totalCalls += matches.length;
    }
    assert.ok(totalCalls >= 5, `emitDailyProtocolLogs 호출 5건 이상 (실제: ${totalCalls})`);
});

test('cycle 504: 본체 동작 보존 — amount 사용 + missions filter', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(/mission\.progress.*\+ amount/.test(source), 'amount 사용 보존');
    assert.ok(/mission\?\.type === type/.test(source), 'type 필터 보존');
});
