import test from 'node:test';
import assert from 'node:assert/strict';

import { GS, isGameMode } from '../src/reducers/gameStates.js';
import { resolvePlatformBackAction } from '../src/platform/platformBack.js';
import { parseCommand } from '../src/utils/commandParser.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { MSG } from '../src/data/messages.js';

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09 Wave 20 L1 — `gameState`는 **`GS` 리터럴 유니온**(`GameMode`)이다.
//
// 오늘까지 `gameState`는 src 17곳에서 `string`으로 선언돼 있었다. 값은 전부 `GS`
// 멤버였지만(실측: 오타 0) 컴파일러는 그걸 **보장하지 못했다** — `'evnt'` 비교나
// `dispatch({SET_GAME_STATE, payload: 'formation'})`이 조용히 통과했다.
//
// 이 파일이 고정하는 것은 넷이다:
//  ① `isGameMode` — 봉투 경계에서 쓰는 유일한 술어. `GS` 멤버만 통과한다.
//  ③ `resolvePlatformBackAction` — 모드 → 뒤로가기 동작 **전수 표**. K1이 손으로
//     채운 표라 새 `GS` 멤버가 들어오면 `Record<GameMode, …>`가 TS2741로 잡는다.
//     이 테스트는 그 표의 **값**이 안 바뀌었음을 지킨다.
//  ④ `parseCommand`의 `blockedStateMessages` — 같은 모양의 두 번째 표.
//     문자열 엔트리 모드는 안내만 돌려주고 액션을 **부르지 않는다**.
//  ⑤ 부재 불변식(§7 허용 범주) — `gameState: string` 선언이 경계 3곳에만 남는다.
//     컴파일러가 못 잡는 회귀(새 `string` prop을 만들고 거기서 오타 비교)를 막는다.
// ─────────────────────────────────────────────────────────────────────────────

const ALL_MODES = Object.values(GS);

// ── ① 경계 술어 ──────────────────────────────────────────────────────────────

test('isGameMode는 GS 멤버 전부를 통과시킨다', () => {
    for (const mode of ALL_MODES) {
        assert.equal(isGameMode(mode), true, `${mode}는 GameMode다`);
    }
    assert.equal(ALL_MODES.length, 12, 'GS는 12모드다 — 늘리면 아래 표 셋이 함께 움직여야 한다');
});

test('isGameMode는 GS 밖 문자열을 거부한다 — 봉투는 JSON.parse 결과라 신뢰 밖이다', () => {
    // `'IDLE'`은 대소문자만 다른 오타(테스트 픽스처에 실재한다),
    // `'intro'`/`'formation'`은 과거에 존재했거나 상상된 모드,
    // `''`은 손상된 세이브.
    for (const bogus of ['IDLE', 'intro', 'formation', '']) {
        assert.equal(isGameMode(bogus), false, `${JSON.stringify(bogus)}는 GameMode가 아니다`);
    }
});

// ── ③ platformBack 전수 표 ───────────────────────────────────────────────────

test('모드 → 뒤로가기 동작 전수 표 (오버레이 플래그 전부 false)', () => {
    const EXPECTED = {
        [GS.EVENT]: 'dismiss-event',
        [GS.EVENT_PENDING]: 'dismiss-event',
        [GS.SHOP]: 'close-focus-panel',
        [GS.JOB_CHANGE]: 'close-focus-panel',
        [GS.QUEST_BOARD]: 'close-focus-panel',
        [GS.CRAFTING]: 'close-focus-panel',
        [GS.IDLE]: 'close-app',
        [GS.COMBAT]: 'close-app',
        [GS.MOVING]: 'close-app',
        [GS.DEAD]: 'close-app',
        [GS.ASCENSION]: 'close-app',
        [GS.TRUE_ENDING]: 'close-app',
    };
    assert.deepEqual(
        Object.keys(EXPECTED).sort(), [...ALL_MODES].sort(),
        '표가 GS 전수여야 한다 — 새 모드가 들어오면 여기부터 red가 된다',
    );
    for (const mode of ALL_MODES) {
        assert.equal(
            resolvePlatformBackAction({ gameState: mode }), EXPECTED[mode],
            `${mode} → ${EXPECTED[mode]}`,
        );
    }
});

test('오버레이 플래그는 모드보다 먼저 소비된다 (기존 우선순위 보존)', () => {
    assert.equal(resolvePlatformBackAction({ gameState: GS.SHOP, premiumShopOpen: true }), 'close-premium');
    assert.equal(resolvePlatformBackAction({ gameState: GS.EVENT, mirrorPanelOpen: true }), 'close-mirror');
    assert.equal(resolvePlatformBackAction({ gameState: GS.COMBAT, expeditionDebriefOpen: true }), 'close-debrief');
    assert.equal(resolvePlatformBackAction({ gameState: GS.IDLE, postCombatOpen: true }), 'close-post-combat');
    // 모드가 아예 없는 호출(부트 전)도 기존대로 앱을 닫는다.
    assert.equal(resolvePlatformBackAction({}), 'close-app');
});

// ── ④ commandParser 차단 표 ──────────────────────────────────────────────────

const clone = (value) => JSON.parse(JSON.stringify(value));

/** 액션 호출을 **세기만** 한다 — throw로 관측하면 파서의 제어 흐름이 바뀐다(Wave 19 K3). */
const countingActions = () => {
    const calls = [];
    return {
        calls,
        actions: new Proxy({}, {
            get: (_t, prop) => (...args) => {
                calls.push(String(prop));
                if (prop === 'getFullStats') return { maxHp: 100, maxMp: 50 };
                return undefined;
            },
        }),
    };
};

const BLOCKED = {
    [GS.EVENT]: MSG.CMD_BLOCKED_EVENT,
    [GS.EVENT_PENDING]: MSG.AI_EVENT_PREPARING_BLOCKED,
    [GS.SHOP]: MSG.CMD_BLOCKED_SHOP,
    [GS.JOB_CHANGE]: MSG.CMD_BLOCKED_JOB_CHANGE,
    [GS.QUEST_BOARD]: MSG.CMD_BLOCKED_QUEST_BOARD,
    [GS.CRAFTING]: MSG.CMD_BLOCKED_CRAFTING,
    [GS.ASCENSION]: MSG.CMD_BLOCKED_ASCENSION,
    [GS.DEAD]: MSG.CMD_BLOCKED_DEAD,
};
const PASSTHROUGH = [GS.IDLE, GS.COMBAT, GS.MOVING, GS.TRUE_ENDING];

test('차단 표는 GS 전수다 — 차단 8 + 통과 4', () => {
    assert.deepEqual(
        [...Object.keys(BLOCKED), ...PASSTHROUGH].sort(), [...ALL_MODES].sort(),
        '새 모드는 차단/통과 둘 중 하나로 명시돼야 한다',
    );
});

test('차단 모드에서는 안내만 돌아오고 explore가 호출되지 않는다', () => {
    for (const [mode, message] of Object.entries(BLOCKED)) {
        const { calls, actions } = countingActions();
        const player = { ...clone(INITIAL_STATE.player), loc: '시작의 마을', level: 5 };
        const result = parseCommand('explore', mode, player, actions);
        // 호출 카운터가 먼저다 — 안내 문구보다 "액션이 나갔는가"가 이 계약의 본체다.
        assert.equal(
            calls.filter((name) => name === 'explore').length, 0,
            `${mode}에서 explore가 호출되면 안 된다 (호출: ${calls.join(', ') || '없음'})`,
        );
        assert.equal(result, message, `${mode}는 자기 안내 문구를 돌려준다`);
        assert.ok(typeof message === 'string' && message.length > 0, `${mode} 안내 문구가 MSG에 있다`);
    }
});

test('통과 모드에서는 파서가 막지 않고 explore가 호출된다', () => {
    for (const mode of PASSTHROUGH) {
        const { calls, actions } = countingActions();
        const player = { ...clone(INITIAL_STATE.player), loc: '시작의 마을', level: 5 };
        const result = parseCommand('explore', mode, player, actions);
        assert.equal(result, undefined, `${mode}는 차단 안내를 돌려주지 않는다`);
        assert.equal(
            calls.filter((name) => name === 'explore').length, 1,
            `${mode}에서 explore가 정확히 한 번 호출된다 (호출: ${calls.join(', ') || '없음'})`,
        );
    }
});

test('읽기 전용 명령은 차단 모드에서도 통과한다 (기존 계약 보존)', () => {
    const { calls, actions } = countingActions();
    const player = { ...clone(INITIAL_STATE.player), loc: '시작의 마을', level: 5 };
    const result = parseCommand('inventory', GS.SHOP, player, actions);
    assert.ok(String(result).includes('인벤토리'), '상점 중에도 인벤토리 조회는 된다');
    assert.ok(calls.includes('setSideTab'), 'setSideTab이 호출된다');
});

// ── ⑤ 부재 불변식 (§7 허용 범주) ─────────────────────────────────────────────
//
// 포맷이 아니라 **식별자**를 매칭한다 — `gameState` 선언이 `string`으로 남아 있는
// 자리는 봉투/와이어 경계 셋뿐이다.

test('src/** 에서 gameState를 string으로 선언하는 곳은 경계 3파일뿐이다', async () => {
    const { readdir, readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const root = path.join(import.meta.dirname, '..', 'src');

    const walk = async (dir) => {
        const out = [];
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) out.push(...await walk(full));
            else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
        }
        return out;
    };

    const ALLOWED = [
        // `LoadDataPayload` — 세이브 봉투. `JSON.parse` 결과라 신뢰 밖이고,
        //   `isGameMode`로 좁히는 것이 `LOAD_DATA` 핸들러의 일이다.
        'reducers/actionTypes.ts',
        // `MigratedSave` — 같은 봉투의 상류(`migrateData`).
        'utils/dataMigration.ts',
        // 아웃바운드 텔레메트리 스냅샷 — `String(...)`으로 **의도적으로** 문자열이다.
        'hooks/useProductTelemetry.ts',
    ];

    const offenders = [];
    for (const file of await walk(root)) {
        const source = await readFile(file, 'utf8');
        if (!/\bgameState\??:\s*string\b/.test(source)) continue;
        const rel = path.relative(root, file).split(path.sep).join('/');
        if (!ALLOWED.includes(rel)) offenders.push(rel);
    }
    assert.deepEqual(
        offenders, [],
        `gameState가 string으로 선언된 자리가 남아 있다 — GameMode로 좁힐 것:\n  ${offenders.join('\n  ')}`,
    );
});
