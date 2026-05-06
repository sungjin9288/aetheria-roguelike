import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GS } from '../src/reducers/gameStates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * cycle 207: dead `GS.FORMATION` 게임 상태 제거 (cycle 120/124/195/206 패턴 follow-up).
 *
 * 발견 (dead 상수):
 * - src/reducers/gameStates.ts:16: `FORMATION: 'formation'` 정의.
 * - 그러나 src/ + tests/ 어디에서도 GS.FORMATION 참조 0건.
 * - 'formation' 문자열 리터럴 사용 0건 (gameStates.ts 자체 선언 제외).
 * - 어떤 핸들러도 GS.FORMATION을 dispatch / 비교하지 않음.
 *
 * 추정 origin:
 * - 기획 단계에서 '진형/포메이션' UI 시스템을 위해 미리 등록한 placeholder.
 * - 미구현 상태로 남아 dead state로 잔존.
 *
 * 패턴:
 * - cycle 120: dead 'discoveries' migrate 제거.
 * - cycle 124: dead 'comboCount' migrate 제거.
 * - cycle 195: dead constants 6종 제거 (MILESTONE_KILLS 등).
 * - cycle 206: dead meta.trueEndingFragments init 제거.
 *
 * 수정 (src/reducers/gameStates.ts):
 * - FORMATION: 'formation' 라인 제거.
 * - GameState union type narrowing 자동 적용 (literal 'formation' 제거).
 *
 * 영향: 0 (어떤 코드도 이 상태를 참조하지 않음).
 */

test('cycle 207: GS에 FORMATION 키가 더 이상 없음', () => {
    assert.equal(
        Object.prototype.hasOwnProperty.call(GS, 'FORMATION'),
        false,
        'GS.FORMATION은 dead 상태이므로 GS object에 존재하면 안 됨',
    );
});

test('cycle 207: src/ 어디에서도 GS.FORMATION 참조 안 함 (regression guard)', () => {
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

    const offenders = [];
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        if (/GS\.FORMATION\b/.test(content)) {
            offenders.push(path.relative(ROOT, file));
        }
    }
    assert.deepEqual(offenders, [], `GS.FORMATION 참조 0건이어야 함. offender: ${JSON.stringify(offenders)}`);
});

test('cycle 207: gameStates.ts에 FORMATION 선언 없음', () => {
    const file = path.join(ROOT, 'src/reducers/gameStates.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.equal(
        /FORMATION/.test(content),
        false,
        'gameStates.ts에 FORMATION 키 선언 라인이 남아있으면 안 됨',
    );
});

test('cycle 207: 다른 GS 상수는 그대로 유지 (회귀 가드)', () => {
    const expected = ['IDLE', 'COMBAT', 'EVENT', 'MOVING', 'SHOP', 'JOB_CHANGE', 'QUEST_BOARD', 'CRAFTING', 'DEAD', 'ASCENSION', 'TRUE_ENDING'];
    for (const key of expected) {
        assert.ok(
            Object.prototype.hasOwnProperty.call(GS, key),
            `GS.${key}는 활성 상태 — 보존 필요`,
        );
    }
});
