import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * cycle 210: actionTypes.ts에 잔존하던 dead GS / GameStateValue export 제거
 *   (cycle 195/206/207 dead cleanup 패턴 follow-up).
 *
 * 발견 (duplicate 잔해):
 * - src/reducers/actionTypes.ts:84-96에 GS 객체 export 존재.
 * - src/reducers/gameStates.ts에도 GS export 존재 (12 keys, cycle 207에서 FORMATION 제거 후 11).
 * - src/ 전체에서 GS는 항상 './reducers/gameStates' 또는 '../reducers/gameStates'에서 import.
 * - actionTypes.ts의 GS / GameStateValue export는 0건 import.
 *
 * 추정 origin:
 * - 초기 actionTypes.ts에 함께 정의되어 있다가 cycle 어느 시점에 gameStates.ts로 분리.
 * - 분리 후 actionTypes.ts의 GS 잔해가 정리 안 된 채 dead duplicate로 남음.
 * - 두 GS의 키 셋도 어긋남: gameStates.ts는 FORMATION을 가지다가 cycle 207에서 제거,
 *   actionTypes.ts는 처음부터 FORMATION 없음 → silent inconsistency가 cycle 207 시점에 정렬.
 *
 * 패턴 (dead cleanup 시리즈):
 * - cycle 120: dead 'discoveries' migrate 제거.
 * - cycle 124: dead 'comboCount' migrate 제거.
 * - cycle 195: dead constants 6종 제거.
 * - cycle 206: dead meta.trueEndingFragments init 제거.
 * - cycle 207: dead GS.FORMATION 제거.
 *
 * 수정 (src/reducers/actionTypes.ts):
 * - GS export 객체 제거 (lines 80-96).
 * - GameStateValue type export 제거 (line 98).
 * - 관련 주석 제거.
 * - AT export는 그대로 유지.
 */

test('cycle 210: actionTypes.ts에 GS export 없음', () => {
    const file = path.join(ROOT, 'src/reducers/actionTypes.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.equal(
        /^export const GS\b/m.test(content),
        false,
        'actionTypes.ts에 dead GS export가 잔존하면 안 됨 (gameStates.ts의 GS 사용)',
    );
});

test('cycle 210: actionTypes.ts에 GameStateValue export 없음', () => {
    const file = path.join(ROOT, 'src/reducers/actionTypes.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.equal(
        /export type GameStateValue\b/.test(content),
        false,
        'actionTypes.ts에 dead GameStateValue type이 잔존하면 안 됨',
    );
});

test('cycle 210: gameStates.ts의 GS는 그대로 export (회귀 가드)', async () => {
    const { GS } = await import('../src/reducers/gameStates.js');
    assert.ok(GS, 'gameStates.ts의 GS는 보존되어야 함');
    assert.equal(GS.IDLE, 'idle');
    assert.equal(GS.COMBAT, 'combat');
    assert.equal(GS.DEAD, 'dead');
    assert.equal(GS.TRUE_ENDING, 'true_ending');
});

test('cycle 210: actionTypes.ts의 AT export는 보존 (회귀 가드)', async () => {
    const { AT } = await import('../src/reducers/actionTypes.js');
    assert.ok(AT, 'AT export 보존되어야 함');
    assert.equal(AT.RESET_GAME, 'RESET_GAME');
    assert.equal(AT.ASCEND, 'ASCEND');
    assert.equal(AT.SET_PLAYER, 'SET_PLAYER');
});

test('cycle 210: actionTypes 모듈에 GS 또는 GameStateValue가 import 안 됨 (regression guard)', () => {
    const SRC_DIR = path.join(ROOT, 'src');
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
        }
    };
    walk(SRC_DIR);

    // import { GS, ... } from '...actionTypes' 패턴 검사
    const offenders = [];
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const importLines = content.match(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*actionTypes[^'"]*['"]/g) || [];
        for (const line of importLines) {
            if (/\bGS\b/.test(line) || /\bGameStateValue\b/.test(line)) {
                offenders.push(`${path.relative(ROOT, file)}: ${line.trim()}`);
            }
        }
    }
    assert.deepEqual(offenders, [],
        `actionTypes에서 GS/GameStateValue import는 0건이어야 함:\n  ${offenders.join('\n  ')}`);
});

test('cycle 207 회귀 가드: GS.FORMATION 제거 상태 유지', async () => {
    const { GS } = await import('../src/reducers/gameStates.js');
    assert.equal(
        Object.prototype.hasOwnProperty.call(GS, 'FORMATION'),
        false,
        'GS.FORMATION 회귀 가드 — cycle 207에서 제거됨',
    );
});
