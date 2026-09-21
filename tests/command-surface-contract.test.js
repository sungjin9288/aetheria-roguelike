import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCommand } from '../src/utils/commandParser.js';
import { createCharacterActions } from '../src/hooks/gameActions/characterActions.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { MAPS } from '../src/data/maps.js';
import { MSG } from '../src/data/messages.js';
import { AT } from '../src/reducers/actionTypes.js';
import { GS } from '../src/reducers/gameStates.js';

// ─────────────────────────────────────────────────────────────────────────────
// 2026-09 Wave 17 — 터미널은 UI와 **평행한 두 번째 입력 표면**이다.
//
// Wave 16이 그 표면에서 한 건 찾았다(안전지대 탐험). 이 파일은 같은 종류의 누수를
// 구조로 막는다: `commandParser`의 모든 명령은 **액션을 경유**해야 하고, 게이트는
// 액션이 소유해야 한다. 파서가 상태를 직접 바꾸면 UI에만 있는 가드를 우회한다.
//
// 실측(수정 전): `shop`만이 액션을 거치지 않고 `setShopItems` + `setGameState('shop')`을
//   직접 호출했고, 검사는 `type === 'safe'` 하나였다. 전투가 가능한 안전지대
//   (`황금 왕국` — `monsters`를 가진 유일한 safe 지역)에서 전투 중 `shop`을 치면
//   상태가 'shop'으로 넘어가고, `ShopPanel`의 뒤로가기가 'idle'로 돌려놔
//   **도주 판정(BALANCE.ESCAPE_CHANCE) 없이 전투를 버릴 수** 있었다.
// ─────────────────────────────────────────────────────────────────────────────

const clone = (value) => JSON.parse(JSON.stringify(value));

/** 파서가 부른 액션 이름만 관측한다 — 어떤 액션도 실제로 실행하지 않는다. */
const spyActions = (fired) => new Proxy({}, {
    get: (_target, prop) => (...args) => {
        fired.push({ action: String(prop), args });
        if (prop === 'getFullStats') return { maxHp: 100, maxMp: 50 };
        return undefined;
    },
});

const runParse = (input, gameState, playerOverrides = {}) => {
    const fired = [];
    const player = { ...clone(INITIAL_STATE.player), loc: '시작의 마을', level: 5, ...playerOverrides };
    const message = parseCommand(input, gameState, player, spyActions(fired));
    return { fired: fired.filter((entry) => entry.action !== 'getFullStats'), message };
};

const SAFE_MAPS_WITH_MONSTERS = Object.entries(MAPS)
    .filter(([, map]) => map.type === 'safe' && (map.monsters || []).length > 0)
    .map(([name]) => name);

// ── 구조 계약: 파서는 상태를 직접 바꾸지 않는다 ───────────────────────────────

test('파서는 어떤 명령에서도 setGameState/setShopItems를 직접 부르지 않는다', () => {
    const COMMANDS = [
        'explore', 'look', '탐색', 'rest', '휴식', 'move 어둠의 동굴', '이동 고요한 숲',
        'attack', 'skill', 'sn', 'r', 'shop', '상점', 'status', 'inv', 'quest', 'map', 'help',
    ];
    // Wave 19 K1: 하드코딩 9종이었다 — `GS`는 그때도 11종이었고(`moving`·`true_ending`이
    //   빠져 있었다) 새 상태가 들어와도 행렬 밖이었다. 이제 `GS`에서 전수로 읽는다.
    const STATES = Object.values(GS);
    const leaks = [];
    for (const command of COMMANDS) {
        for (const gameState of STATES) {
            for (const { action } of runParse(command, gameState).fired) {
                // 상태 전이는 액션이 소유한다 — 파서가 직접 바꾸면 UI에만 있는 가드를 우회한다.
                if (action === 'setGameState' || action === 'setShopItems') {
                    leaks.push(`${command} @ ${gameState} → ${action}`);
                }
            }
        }
    }
    assert.deepEqual(leaks, [], `파서가 상태를 직접 전이한다:\n  ${leaks.join('\n  ')}`);
});

test('shop 명령은 openShop 액션 하나로만 나간다', () => {
    for (const gameState of ['idle', 'combat']) {
        const { fired } = runParse('shop', gameState, { loc: '황금 왕국', level: 62 });
        assert.deepEqual(fired.map((entry) => entry.action), ['openShop'], `${gameState}에서 openShop 단일 호출`);
    }
});

// ── 구조 계약 2: 상점 진입 표면은 **전부** openShop을 경유한다 ────────────────
//
// Wave 17의 첫 통합은 파서와 GameRoot만 고쳤고, 위 구조 계약도 **파서만** 검사했다.
// 머지 전 감사가 `ControlPanel`의 상점 버튼이 여전히 시퀀스를 복제하고 있음을 찾았다 —
// 즉 "입력 표면을 전수했다"는 주장이 거짓이었고, 그걸 놓친 이유는 **계약이 한 표면만
// 보고 있었기 때문**이다. 그래서 여기서는 표면을 열거하지 않고 `src/**`에서 상점 진입
// 시퀀스를 복제하는 곳이 **0곳**임을 확인한다(부재 불변식 — CLAUDE.md §7이 소스 정규식
// 가드를 허용하는 바로 그 범주다).

test('src/** 어디에도 상점 진입 시퀀스를 복제하는 곳이 없다 (openShop이 유일 소유자)', async () => {
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

    const OWNER = path.join(root, 'hooks', 'gameActions', 'characterActions.ts');
    const offenders = [];
    for (const file of await walk(root)) {
        if (file === OWNER) continue;
        const source = await readFile(file, 'utf8');
        // 식별자를 매칭한다 — 포맷(줄바꿈/공백/인자 순서)이 아니라.
        const setsShopItems = /\bSET_SHOP_ITEMS\b|\bsetShopItems\s*[(?]/.test(source);
        const entersShopState = /setGameState\??\.?\(\s*GS\.SHOP|SET_GAME_STATE[\s\S]{0,80}GS\.SHOP|setGameState\s*\(\s*['"`]shop['"`]/.test(source);
        if (setsShopItems && entersShopState) {
            offenders.push(path.relative(root, file));
        }
    }
    assert.deepEqual(
        offenders, [],
        `상점 진입 시퀀스를 복제하는 표면이 남아 있다 — openShop을 부를 것:\n  ${offenders.join('\n  ')}`,
    );
});

// ── 게이트 계약: 상점 진입의 가드는 액션이 소유한다 ──────────────────────────

const runOpenShop = (loc, gameState) => {
    const dispatched = [];
    const logs = [];
    const player = { ...clone(INITIAL_STATE.player), loc, level: 62 };
    const actions = createCharacterActions({
        player,
        gameState,
        dispatch: (action) => dispatched.push(action),
        addLog: (type, text) => logs.push({ type, text: String(text) }),
        addStoryLog: () => {},
        getFullStats: () => ({ maxHp: player.maxHp, maxMp: player.maxMp }),
    }, { emitUnlockedTitles: () => {} });
    actions.openShop();
    return { dispatched, logs };
};

test('전투가 가능한 안전지대는 황금 왕국 하나다 — 이 계약의 전제', () => {
    assert.deepEqual(SAFE_MAPS_WITH_MONSTERS, ['황금 왕국']);
});

test('안전지대에서 idle이면 상점에 들어간다', () => {
    const { dispatched, logs } = runOpenShop('황금 왕국', 'idle');
    const types = dispatched.map((action) => action.type);
    assert.ok(types.includes(AT.SET_SHOP_ITEMS), '상점 목록이 실려야 한다');
    const stateAction = dispatched.find((action) => action.type === AT.SET_GAME_STATE);
    assert.equal(stateAction?.payload, GS.SHOP);
    assert.deepEqual(logs.map((entry) => entry.text), [MSG.SHOP_ENTERED]);
});

test('전투 중에는 상점에 들어갈 수 없다 — 도주 판정을 우회하는 무료 이탈을 막는다', () => {
    const { dispatched, logs } = runOpenShop('황금 왕국', 'combat');
    assert.deepEqual(dispatched, [], '전투 중에는 어떤 상태 전이도 없어야 한다');
    assert.deepEqual(logs.map((entry) => entry.text), [MSG.SHOP_BLOCKED]);
});

test('던전에서는 idle이어도 상점이 열리지 않는다', () => {
    const { dispatched, logs } = runOpenShop('어둠의 동굴', 'idle');
    assert.deepEqual(dispatched, []);
    assert.deepEqual(logs.map((entry) => entry.text), [MSG.SHOP_SAFE_ONLY]);
});

test('전투 중 던전에서도 마찬가지다 — 두 가드가 겹쳐도 상태 전이는 0건', () => {
    const { dispatched } = runOpenShop('어둠의 동굴', 'combat');
    assert.deepEqual(dispatched, []);
});

// ── 나머지 행동 명령의 상태 게이트는 각자 액션이 이미 소유한다 ────────────────

test('준비 중(event_pending)은 선택지를 말하지 않는 자기 안내를 돌려준다', () => {
    // Wave 19 K1: 키가 없으면 명령이 각 액션 가드로 흘러가 문구가 제각각이 되고
    //   (explore/move/rest/shop이 서로 다른 에러), `1/2/3`은 아직 고를 것이 없다.
    const { fired, message } = runParse('explore', GS.EVENT_PENDING);
    assert.deepEqual(fired, []);
    assert.equal(message, MSG.AI_EVENT_PREPARING_BLOCKED);
    assert.deepEqual(runParse('1', GS.EVENT_PENDING).fired, [], '준비 중에는 선택 자체가 없다');
});

test('읽기 전용 명령은 차단 상태에서도 통과한다 (기존 계약 보존)', () => {
    for (const gameState of [GS.EVENT, GS.EVENT_PENDING, 'shop', 'dead', 'crafting']) {
        const { message } = runParse('status', gameState);
        assert.ok(String(message).startsWith('[상태]'), `${gameState}에서 status는 읽혀야 한다`);
    }
});

test('차단 상태에서는 행동 명령이 액션을 부르지 않는다', () => {
    for (const gameState of [GS.EVENT, GS.EVENT_PENDING, 'shop', 'dead', 'ascension', 'quest_board', 'crafting', 'job_change']) {
        for (const command of ['explore', 'rest', 'shop', 'move 어둠의 동굴']) {
            const { fired, message } = runParse(command, gameState);
            assert.deepEqual(fired, [], `${command} @ ${gameState}`);
            assert.ok(typeof message === 'string' && message.length > 0, `${command} @ ${gameState}: 사유가 있어야 한다`);
        }
    }
});
