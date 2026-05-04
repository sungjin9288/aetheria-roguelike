import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 122: 퀘스트 완료 사운드 큐 — cycle 117(discovery_chain) / 118(new_area)
 * sound 시리즈 연장.
 *
 * 발견:
 * - useInventoryActions.completeQuest는 'success' 로그만 출력 ("퀘스트 완료: ...").
 * - 'success'는 useGameEngine 사운드 매핑에 없어 audio cue 없음.
 * - 퀘스트 완료는 보상 (exp/gold/item) + 가능하면 칭호 해금까지 발생하는 의미
 *   있는 모먼트인데 audio 차원이 비어있음.
 *
 * 추가:
 * - SoundManager case 'quest_complete' — E5/G#5/B5/E6 E major arpeggio.
 *   victory(C major) / discovery_chain(G major) / new_area(D major)와 구분되는
 *   E major 색채. 음악적 다양성으로 surface 정체성.
 * - useInventoryActions.completeQuest: SET_PLAYER dispatch 후 soundManager.play
 *   ('quest_complete') 직접 호출. cycle 88(escape) / 117(discovery_chain) /
 *   118(new_area) 패턴.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('SoundManager: case "quest_complete" 분기 존재', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.match(source, /case\s+['"]quest_complete['"]\s*:/);
});

test('useInventoryActions: completeQuest에서 quest_complete 사운드 재생', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    const idx = source.indexOf('completeQuest:');
    assert.ok(idx > -1, 'completeQuest action should exist');
    // completeQuest 함수 끝(다음 액션 시작)까지 추출
    const blockEnd = source.indexOf('claimAchievement:', idx);
    const block = source.slice(idx, blockEnd);
    assert.match(
        block,
        /soundManager.*\(['"]quest_complete['"]\)|play\(['"]quest_complete['"]\)/,
        'completeQuest should call soundManager.play("quest_complete")'
    );
});

test('useInventoryActions: soundManager import 추가됨', async () => {
    const source = await readSrc('src/hooks/useInventoryActions.ts');
    assert.match(source, /import\s*\{[^}]*soundManager[^}]*\}\s*from/);
});

test('SoundManager: cycle 117/118 사운드 회귀 보존', async () => {
    const source = await readSrc('src/systems/SoundManager.ts');
    assert.match(source, /case\s+['"]discovery_chain['"]\s*:/);
    assert.match(source, /case\s+['"]new_area['"]\s*:/);
    assert.match(source, /case\s+['"]escape['"]\s*:/);
});
