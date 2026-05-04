import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 112: rest 시 player.status 정리 — cycle 106-110 status 복구 후속 UX.
 *
 * 발견:
 * - cycle 106-110에서 5종 status(bleed/freeze/stun/curse/blind/fear)가 player에
 *   영향을 주도록 복구. 그러나 rest 액션은 HP/MP만 회복하고 player.status는
 *   그대로 유지.
 * - 결과: 보스 phase 부여한 curse/blind 등이 안전지대 휴식 후에도 남아있어
 *   일반 탐험에서도 페널티 적용. 회피 옵션은 cure item 4종(해독제/치료약/
 *   해빙제/저주해제 주문서)뿐 — bleed/blind/fear/stun cure는 없는 상태라
 *   rest로도 못 푸는 영구 디버프 상황 가능.
 *
 * 수정:
 * - rest 액션에서 player.status = [] 로 초기화 (HP/MP 회복과 함께).
 * - 안전지대에서 며칠간 회복하는 휴식의 자연스러운 의미 — 모든 상태이상
 *   해소.
 *
 * 영향:
 * - cure item이 없어도 안전지대 복귀 + rest로 디버프 해소 가능.
 * - rest 비용은 그대로 (BALANCE.REST_COST 기반 레벨 비례) — UX 안전망 추가.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('characterActions.rest: status 배열 초기화 코드 존재', async () => {
    const source = await readSrc('src/hooks/gameActions/characterActions.ts');
    // rest 액션 안에서 status: [] 또는 status: [] 패턴
    const idx = source.indexOf('rest: () =>');
    assert.ok(idx > -1, 'rest action should exist');
    // rest 함수 끝(다음 액션 시작)까지 추출
    const restBlock = source.slice(idx, source.indexOf('swapSkillChoice', idx));
    assert.match(restBlock, /status:\s*\[\s*\]/, 'rest should reset status array');
});

test('characterActions.rest: HP/MP 회복 + rests 증분 회귀 보존', async () => {
    const source = await readSrc('src/hooks/gameActions/characterActions.ts');
    const idx = source.indexOf('rest: () =>');
    const restBlock = source.slice(idx, source.indexOf('swapSkillChoice', idx));
    assert.match(restBlock, /hp:\s*stats\.maxHp/);
    assert.match(restBlock, /mp:\s*stats\.maxMp/);
    assert.match(restBlock, /rests:.*\+\s*1/);
});

test('characterActions.rest: REST_SAFE_ONLY 가드 회귀 보존', async () => {
    const source = await readSrc('src/hooks/gameActions/characterActions.ts');
    const idx = source.indexOf('rest: () =>');
    const restBlock = source.slice(idx, source.indexOf('swapSkillChoice', idx));
    assert.match(restBlock, /REST_SAFE_ONLY/);
});
