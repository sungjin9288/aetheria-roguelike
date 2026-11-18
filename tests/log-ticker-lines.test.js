// 2026-11 화면 B안: 한 줄 소식이 보이는 줄 — 전투 차례는 앞에서부터(내 행동이 첫 줄), 그 밖의 묶음은 뒤에서부터(단서 · 본문이 끝에 온다).
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTickerLines } from '../src/utils/logTicker.js';

const line = (id, type = 'info') => ({ id, type, text: id });

test('selectTickerLines: 묶음 첫 줄부터 마지막까지, 넘치면 끝 줄들을 남긴다', () => {
    const logs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => line(id));
    assert.deepEqual(selectTickerLines(logs, { batchFirstId: 'e', maxLines: 3 }).map((l) => l.id), ['e', 'f']);
    assert.deepEqual(selectTickerLines(logs, { batchFirstId: 'b', maxLines: 3 }).map((l) => l.id), ['d', 'e', 'f']);
});

test('selectTickerLines: 묶음 첫 줄을 모르거나 사라졌으면 마지막 줄 하나', () => {
    const logs = ['a', 'b', 'c'].map((id) => line(id));
    assert.deepEqual(selectTickerLines(logs, { batchFirstId: null, maxLines: 3 }).map((l) => l.id), ['c']);
    assert.deepEqual(selectTickerLines(logs, { batchFirstId: 'gone', maxLines: 3 }).map((l) => l.id), ['c']);
});

test('selectTickerLines: 전투 차례가 있으면 차례의 앞 줄들(내 행동 먼저)', () => {
    const logs = ['a', 'b', 'c', 'd', 'e'].map((id) => line(id, 'combat'));
    const turn = [line('b', 'combat'), line('c', 'enemy'), line('d', 'combat'), line('e', 'success')];
    assert.deepEqual(selectTickerLines(logs, { batchFirstId: 'e', combatTurn: turn, maxLines: 3 }).map((l) => l.id), ['b', 'c', 'd']);
});

test('selectTickerLines: 불러오는 중 줄은 보이지 않고, 빈 기록 · 빈 차례도 안전하다', () => {
    const logs = [line('a'), line('wait', 'loading')];
    assert.deepEqual(selectTickerLines(logs, { batchFirstId: 'wait', maxLines: 3 }).map((l) => l.id), ['a']);
    assert.deepEqual(selectTickerLines([], { batchFirstId: null, maxLines: 3 }), []);
    assert.deepEqual(
        selectTickerLines(logs, { batchFirstId: null, combatTurn: [line('w', 'loading')], maxLines: 3 }).map((l) => l.id),
        ['a'],
    );
    assert.equal(selectTickerLines(logs, { batchFirstId: null, maxLines: 0 }).length, 1, '최소 한 줄');
});
