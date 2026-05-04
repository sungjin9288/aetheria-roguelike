import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 135: 이벤트 체인 보상 사운드 큐 — cycle 122-123/133 quest_complete 재사용.
 *
 * 발견:
 * - eventActions.handleEventChoice는 chain 이벤트 처리 시 보상(gold/item/relic/
 *   combat_bonus/stat_bonus)을 grant하면서 addLog 'success'로 reflection만 출력.
 * - cycle 117에서 발견 체인(checkDiscoveryChains)에 discovery_chain 사운드를,
 *   cycle 122-123/133에서 quest/achievement/codex claim에 quest_complete 사운드를
 *   추가했지만 narrative event chain 보상은 audio cue 없었음.
 *
 * 수정:
 * eventActions의 chain 이벤트 보상 처리 직후 soundManager.play('quest_complete')
 * 호출. cycle 122/123/133 패턴 — 4번째 "달성/회수" 액션이 동일 음악적 정체성
 * (E major) 공유.
 *
 * 차별화:
 * - discovery_chain (G major): 지역 방문 체인 완료 (cycle 117)
 * - quest_complete (E major): quest claim / achievement claim / codex claim /
 *   chain event 보상 (cycle 122/123/133/135)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('eventActions: chain 이벤트 보상 후 quest_complete 사운드 재생', async () => {
    const source = await readSrc('src/hooks/gameActions/eventActions.ts');
    assert.match(
        source,
        /soundManager.*\(['"]quest_complete['"]\)|play\(['"]quest_complete['"]\)/,
        'eventActions should play quest_complete on chain reward'
    );
});

test('eventActions: soundManager import 추가됨', async () => {
    const source = await readSrc('src/hooks/gameActions/eventActions.ts');
    assert.match(source, /import\s*\{[^}]*soundManager[^}]*\}\s*from/);
});

test('회귀 보존: cycle 122/123/133 quest_complete 호출 그대로', async () => {
    const ic = await readSrc('src/hooks/useInventoryActions.ts');
    const cdx = await readSrc('src/components/Codex.tsx');
    assert.match(ic, /play\(['"]quest_complete['"]\)/);
    assert.match(cdx, /play\(['"]quest_complete['"]\)/);
});
