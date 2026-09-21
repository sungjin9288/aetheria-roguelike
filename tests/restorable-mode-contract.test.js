import test from 'node:test';
import assert from 'node:assert/strict';

import { gameReducer, INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09 Wave 18 — **세이브 봉투에 없는 동반 상태를 요구하는 모드는 복원될 수 없다.**
//
// 봉투는 여섯 필드다: {player, gameState, enemy, grave, currentEvent, quickSlots}
// (`useFirebaseSync.flushLocalSave`). 그 밖의 런타임 상태를 화면 조건으로 쓰는 모드를
// 그대로 복원하면 **그 화면을 띄울 조건이 영원히 거짓**이 된다.
//
// 기존에 `combat && !enemy → idle` 한 줄이 그 첫 사례였고, 같은 모양이 둘 더 있었다:
//
//  1. `event` + `currentEvent: null` — `exploreActions`가 AI 호출(9.5s) **전에**
//     `GS.EVENT`를 세우고 저장 디바운스는 `BALANCE.DEBOUNCE_SAVE_MS`(500ms)다.
//     그 창에서 찍힌 세이브를 복원하면 `isAiThinking`이 비영속이라 false로 돌아오고
//     `ControlPanel`이 `<EventPanel currentEvent={null}>`을 그리는데 `EventPanel`은
//     `if (!currentEvent) return null`이다. TerminalView도 `FOCUS_PANEL_STATES` 때문에
//     마운트되지 않고(`MobileGameLayout`), explore/move/rest는 각자 액션 가드로 막힌다.
//     → 웹/iOS에서 **영구 벽돌**(안드로이드는 platformBack이 있으나 Wave 18 실측상
//       Capacitor 빌드에서는 그 배선조차 없다).
//  2. `dead` — `runSummary`는 전투 패배 순간에만 만들어지고 저장되지 않는다.
//     `App.tsx`의 사망 화면 조건이 `GS.DEAD && runSummary`라 복원 후 영원히 거짓이고,
//     `characterActions.start`는 `gameState`를 건드리지 않아 새 캐릭터를 만들어도
//     `dead`로 남는다.
//
// 이 파일은 **모드 단위 불변식**을 고정한다: 복원 결과 `gameState`는 그 화면을 띄울
// 동반 상태가 봉투에 함께 있을 때만 그 모드로 남는다.
// ─────────────────────────────────────────────────────────────────────────────

const clone = (value) => JSON.parse(JSON.stringify(value));

const restore = (payload) => gameReducer(
    { ...clone(INITIAL_STATE), bootStage: 'loading' },
    { type: AT.LOAD_DATA, payload: { player: clone(INITIAL_STATE.player), quickSlots: [], ...payload } },
);

const ENEMY = { name: '숲 늑대', hp: 80, maxHp: 80, atk: 20, def: 2, level: 8 };
const EVENT = { title: '갈림길', desc: '길이 둘로 갈린다.', choices: ['왼쪽', '오른쪽'] };

test('동반 상태가 함께 오면 그 모드로 복원된다', () => {
    assert.equal(restore({ gameState: GS.COMBAT, enemy: ENEMY }).gameState, GS.COMBAT);
    assert.equal(restore({ gameState: GS.EVENT, currentEvent: EVENT }).gameState, GS.EVENT);
    assert.equal(restore({ gameState: GS.IDLE }).gameState, GS.IDLE);
    assert.equal(restore({ gameState: GS.MOVING }).gameState, GS.MOVING);
});

test('combat은 enemy 없이 복원되지 않는다 (기존 계약 보존)', () => {
    const restored = restore({ gameState: GS.COMBAT, enemy: null });
    assert.equal(restored.gameState, GS.IDLE);
    assert.equal(restored.enemy, null);
});

test('event는 currentEvent 없이 복원되지 않는다 — AI 창 세이브가 영구 벽돌이 되던 자리', () => {
    const restored = restore({ gameState: GS.EVENT, currentEvent: null });
    assert.equal(restored.gameState, GS.IDLE, 'currentEvent가 없으면 event로 남으면 안 된다');
    assert.equal(restored.currentEvent, null);
});

test('event_pending은 동반 상태와 무관하게 복원되지 않는다 — 진행 중 promise는 리로드를 못 넘는다', () => {
    // Wave 19 K1: `event` 창을 별도 모드로 뺀 것이다. 동반 상태가 "없는" 것이 아니라
    // **진행 중인 AI 호출**이고, 그건 리로드 뒤에 존재하지 않는다. 복원하면
    // `ControlPanel`이 영원히 "준비 중" 패널을 그린다 — 스피너가 달린 같은 벽돌이다.
    const bare = restore({ gameState: GS.EVENT_PENDING });
    assert.equal(bare.gameState, GS.IDLE);
    assert.equal(bare.currentEvent, null);

    // 카드가 우연히 함께 와도 접는다 — 그 카드를 만든 호출은 이미 없다.
    const withCard = restore({ gameState: GS.EVENT_PENDING, currentEvent: EVENT });
    assert.equal(withCard.gameState, GS.IDLE, 'currentEvent가 있어도 준비 중으로는 복원되지 않는다');
});

test('dead는 복원되지 않는다 — runSummary가 봉투에 없어 사망 화면 조건이 영원히 거짓이다', () => {
    const restored = restore({ gameState: GS.DEAD });
    assert.equal(restored.gameState, GS.IDLE);
    assert.equal(restored.runSummary, null, '전제: runSummary는 복원되지 않는다(봉투에 없다)');
});

test('복원 가능한 모드 집합이 봉투의 동반 필드와 일치한다 (표로 고정)', () => {
    const MATRIX = [
        // [요청 모드, 동반 상태, 기대 결과]
        [GS.COMBAT, { enemy: ENEMY }, GS.COMBAT],
        [GS.COMBAT, { enemy: null }, GS.IDLE],
        [GS.EVENT, { currentEvent: EVENT }, GS.EVENT],
        [GS.EVENT, { currentEvent: null }, GS.IDLE],
        [GS.EVENT_PENDING, {}, GS.IDLE],
        [GS.EVENT_PENDING, { currentEvent: EVENT }, GS.IDLE],
        [GS.DEAD, {}, GS.IDLE],
        [GS.IDLE, {}, GS.IDLE],
    ];
    for (const [mode, companion, expected] of MATRIX) {
        assert.equal(
            restore({ gameState: mode, ...companion }).gameState, expected,
            `${mode} + ${JSON.stringify(companion)} → ${expected}`,
        );
    }
});

test('폴드는 렌더 가능성만 바꾼다 — 세이브가 찍힌 상황에 따른 정리는 그대로다', () => {
    // 두 조건이 서로 다른 값을 읽는 이유를 고정한다.
    //   첫 조건(모험 유물 정리)은 **요청된 모드**를 읽어야 한다 — `dead` 폴드 뒤에
    //   `gameState`로 읽으면 사망 세이브의 정리가 조용히 건너뛰어진다.
    //   `else if`(포식 보너스 종료)는 **폴드된 값**을 읽어야 한다 — `combat && !enemy`로
    //   접힌 불완전 전투는 보너스를 끝내야 하기 때문이다
    //   (`adventure-relic-lifetime.test.js`가 그 칸을 고정한다).
    //
    // 판별 가능한 관측값은 `adventureRelicBonuses`다(`killStackAtk`는 `endDevourBonus`가
    // 보존하고 `clearAdventureRelicBonuses`만 지운다 — 실측으로 확인했다).
    const player = {
        ...clone(INITIAL_STATE.player),
        loc: '고요한 숲', // safe가 아니다 — 그래야 `dead` 조건 하나로만 갈린다
        adventureRelicBonuses: { killStackAtk: 5 },
    };
    const restored = gameReducer(
        { ...clone(INITIAL_STATE), bootStage: 'loading' },
        { type: AT.LOAD_DATA, payload: { player, gameState: GS.DEAD, quickSlots: [] } },
    );
    assert.equal(restored.gameState, GS.IDLE, '폴드는 일어난다');
    assert.equal(
        restored.player.adventureRelicBonuses, undefined,
        'dead 세이브의 모험 유물 보너스는 폴드와 무관하게 정리된다 '
        + '(첫 조건이 폴드된 gameState를 읽으면 {killStackAtk: …}가 남는다 — 실측)',
    );
});
