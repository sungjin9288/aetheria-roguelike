import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { AT } from '../src/reducers/actionTypes.js';
import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { MSG } from '../src/data/messages.js';
import { DB } from '../src/data/db.js';
import { isSignatureItem } from '../src/data/signatureItems.js';

/**
 * Signature 아이템 획득 시 Terminal에 전용 legendary 로그가 출력되는
 * 전체 흐름을 고정한다(기록 줄 생산은 실제 리듀서 전이로 — tsx 로더가 확장자 없는 import를 푼다).
 *
 * 체크 포인트:
 *   1. MSG.SIGNATURE_DISCOVERED 포매터 정의
 *   2. 리듀서 획득 전이(D33)가 legendary 로그 type + MSG formatter로 기록 줄을 남긴다
 *   3. TerminalView가 legendary 스타일/뱃지/COMBAT_LOG_TYPES 등록
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('MSG.SIGNATURE_DISCOVERED formatter exists in messages.js', async () => {
    const source = await readSrc('src/data/messages.ts');
    assert.ok(
        /SIGNATURE_DISCOVERED:\s*\(.*?\)\s*=>/.test(source),
        'messages.js should define SIGNATURE_DISCOVERED arrow formatter'
    );
});

// 2026-10-26 소유자 결정 D33: 전설 기록 줄은 표시 훅이 아니라 리듀서의 획득 전이가 남긴다 — 실제 전이로 확인한다.
test('전설 각인이 가방에 들어온 전이는 legendary 기록 줄을 MSG.SIGNATURE_DISCOVERED로 남긴다', () => {
    const signature = DB.ITEMS.weapons.find((item) => isSignatureItem(item));
    const next = gameReducer(structuredClone(INITIAL_STATE), {
        type: AT.SET_PLAYER,
        payload: (player) => ({ ...player, inv: [...player.inv, { ...signature, id: 'sig-log-1' }] }),
    });
    const line = next.logs.at(-1);
    assert.equal(line.type, 'legendary');
    assert.equal(line.text, MSG.SIGNATURE_DISCOVERED(signature.name));
});

test('TerminalView registers legendary log style + badge + combat visibility', async () => {
    const source = await readSrc('src/components/TerminalView.tsx');
    assert.ok(/legendary:\s*\{/.test(source), 'LOG_STYLES should define legendary style');
    assert.ok(source.includes("label: '전설'"), 'MOBILE_LOG_BADGES should label legendary in player-facing Korean');
    assert.ok(
        /COMBAT_LOG_TYPES[\s\S]*?'legendary'/.test(source),
        'legendary should be in COMBAT_LOG_TYPES so summary mode shows it'
    );
});
