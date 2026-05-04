import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { BALANCE } from '../src/data/constants.js';

/**
 * cycle 136: killStreak 시간 기반 감쇠 구현 (KILL_STREAK_DECAY_MS dead constant fix).
 *
 * 발견:
 * - constants.ts: `KILL_STREAK_DECAY_MS: 30000, // 30초 비전투 시 스트릭 초기화`
 *   주석으로 의도 명시.
 * - 그러나 이 상수를 read하는 코드가 src/ 전체에서 0건 — 시간 감쇠 미구현.
 * - 결과: 플레이어가 새벽 1시에 마지막 킬 후 다음 날 아침에 다른 적 처치하면
 *   killStreak가 그대로 +1 누적. 의도(전투 사이 30초 휴지면 reset)와 다름.
 * - 실질적으로 killStreak는 사망 외엔 절대 reset되지 않는 카운터로 동작 중.
 *
 * 수정:
 * 1. combatVictory.ts: killStreak 증분 직전에 lastKillAt timestamp 비교.
 *    Date.now() - lastKillAt > KILL_STREAK_DECAY_MS이면 prevStreak = 0으로
 *    초기화 (실질적으로 새 streak 시작).
 * 2. lastKillAt을 같은 SET_PLAYER에 묶어 새 timestamp 저장.
 * 3. lastKillAt가 undefined인 첫 킬에선 비교 skip — 정상 누적.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('BALANCE.KILL_STREAK_DECAY_MS 등록됨 (회귀 가드)', () => {
    assert.equal(typeof BALANCE.KILL_STREAK_DECAY_MS, 'number');
    assert.ok(BALANCE.KILL_STREAK_DECAY_MS > 0);
});

test('combatVictory: KILL_STREAK_DECAY_MS 참조 코드 존재', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.match(
        source,
        /KILL_STREAK_DECAY_MS/,
        'combatVictory should reference KILL_STREAK_DECAY_MS'
    );
});

test('combatVictory: lastKillAt 갱신 코드 존재', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    assert.match(
        source,
        /lastKillAt/,
        'combatVictory should track lastKillAt timestamp'
    );
});

test('combatVictory: Date.now() 기반 시간 비교 패턴 존재', async () => {
    const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
    // lastKillAt 변수 근처에 Date.now() 비교
    const idx = source.indexOf('lastKillAt');
    assert.ok(idx > -1);
    const window = source.slice(idx, idx + 600);
    assert.match(window, /Date\.now\(\)/);
});
