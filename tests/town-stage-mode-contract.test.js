import test from 'node:test';
import assert from 'node:assert/strict';

import { DB } from '../src/data/db.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { isTownStageMode, READ_FIRST_LOG_TYPES } from '../src/utils/fieldStage.ts';

/**
 * 마을 무대(2026-11)의 비켜서기 — 통합 수용 9차가 찾은 빈 계약. 안전지대의 대기 화면은 무대(마을 그림 · 주인공) + 아래 띠지만,
 * 마지막 기록 줄이 이야기 · 사건이면 무대가 비켜서 기록 창이 열 전체를 쓴다(임무 수령의 단서 + 장 본문 약 260px가 띠에서 잘렸다).
 * 다음 행동의 줄이 오면 무대가 돌아온다. 표시 판정이라 마을 규칙 · 시설 동작은 바꾸지 않는다.
 */

const SAFE_LOCS = Object.entries(DB.MAPS).filter(([, map]) => map.type === 'safe').map(([loc]) => loc);
const FIELD_LOC = Object.entries(DB.MAPS).find(([, map]) => map.type !== 'safe')?.[0];
const log = (type, text = '기록') => ({ id: `${type}-${text}`, type, text });

test('안전지대 대기 화면은 무대를 세운다 — 기록이 없거나 마지막 줄이 이야기 · 사건이 아니면', () => {
    assert.ok(SAFE_LOCS.length > 1, '안전지대가 여럿이다');
    for (const loc of SAFE_LOCS) {
        assert.equal(isTownStageMode({ loc }, GS.IDLE, []), true, `${loc}: 기록 없음`);
        assert.equal(isTownStageMode({ loc }, GS.IDLE, [log('story'), log('system')]), true, `${loc}: 이야기 뒤 다음 행동의 줄`);
    }
});

test('마지막 기록 줄이 이야기 · 사건이면 무대가 비켜선다 — 기록 창 묶음 맞춤과 같은 종류 목록', () => {
    assert.deepEqual([...READ_FIRST_LOG_TYPES].sort(), ['event', 'story']);
    for (const loc of SAFE_LOCS) {
        for (const type of READ_FIRST_LOG_TYPES) {
            assert.equal(isTownStageMode({ loc }, GS.IDLE, [log('system'), log(type)]), false, `${loc}: 마지막 줄 ${type}`);
        }
    }
});

test('대기가 아니거나 안전지대가 아니면 마을 무대가 아니다', () => {
    const loc = SAFE_LOCS[0];
    for (const mode of Object.values(GS)) {
        if (mode === GS.IDLE) continue;
        assert.equal(isTownStageMode({ loc }, mode, []), false, `${loc}: ${mode}`);
    }
    assert.ok(FIELD_LOC);
    assert.equal(isTownStageMode({ loc: FIELD_LOC }, GS.IDLE, []), false, '사냥 지역');
    assert.equal(isTownStageMode(null, GS.IDLE, []), false, '플레이어 없음');
});
