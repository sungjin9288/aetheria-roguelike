import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Wave 4 N2 — useGameEngine의 `actions` 조립 가드.
 *
 * `actions`는 player가 바뀔 때마다 통째로 다시 만들어졌다. 그중 절반은 dispatch만
 * 쓰는 순수 래퍼라 player와 아무 상관이 없다. 이제 안정 그룹(`stableActions`)과
 * player 의존 그룹으로 나뉘어 있고, 이 파일은 그 분리가 조용히 되돌아가는 것을 막는다.
 *
 * 반환 셰이프는 그대로여야 한다 — 안정 그룹은 기존과 같은 자리(팩토리 spread 다음)에
 * 펼쳐지므로 키 집합과 우선순위가 보존된다.
 */

const SOURCE = readFileSync(new URL('../src/hooks/useGameEngine.ts', import.meta.url), 'utf8');

/** `const <name> = useMemo(` 이후의 마지막 인자(의존성 배열) 원문을 잘라 낸다. */
const readMemoDependencyArray = (source, name) => {
    const start = source.indexOf(`const ${name} = useMemo(`);
    assert.ok(start > -1, `${name} useMemo 선언을 찾지 못했다`);
    const openIndex = source.indexOf('(', start + `const ${name} = useMemo`.length);
    let depth = 0;
    let end = -1;
    for (let index = openIndex; index < source.length; index += 1) {
        const char = source[index];
        if (char === '(') depth += 1;
        else if (char === ')') {
            depth -= 1;
            if (depth === 0) { end = index; break; }
        }
    }
    assert.ok(end > -1, `${name} useMemo 호출이 닫히지 않았다`);
    const call = source.slice(openIndex + 1, end);
    const arrayStart = call.lastIndexOf('[');
    const arrayEnd = call.lastIndexOf(']');
    assert.ok(arrayStart > -1 && arrayEnd > arrayStart, `${name} 의존성 배열을 찾지 못했다`);
    return call.slice(arrayStart + 1, arrayEnd);
};

test('N2: 안정 액션 그룹의 의존성 배열에 player가 들어가지 않는다', () => {
    const deps = readMemoDependencyArray(SOURCE, 'stableActions')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

    assert.ok(!deps.includes('player'), `stableActions 의존성에 player가 있으면 분리 의미가 없다: [${deps.join(', ')}]`);
    assert.ok(!deps.some((entry) => entry.startsWith('player.')), 'player의 하위 필드도 의존성이 될 수 없다');
    assert.deepEqual(deps, ['uid'], '안정 그룹은 uid에만 의존한다 (dispatch는 useReducer가 보장하는 안정 참조)');
});

test('N2: player 의존 그룹은 안정 그룹을 그대로 펼쳐 반환 셰이프를 유지한다', () => {
    assert.match(SOURCE, /\.\.\.inventoryActions,\s*\n\s*\.\.\.stableActions,/,
        '안정 그룹은 팩토리 spread 다음에 펼쳐져 기존 키 우선순위를 유지한다');

    const deps = readMemoDependencyArray(SOURCE, 'actions')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    assert.ok(deps.includes('player'), 'player 의존 그룹은 여전히 player를 의존성으로 갖는다');
    assert.ok(deps.includes('stableActions'), '안정 그룹을 의존성으로 명시한다');
});

test('N2: 안정 그룹이 소유한 액션은 player 의존 그룹에서 다시 정의되지 않는다', () => {
    const stableStart = SOURCE.indexOf('const stableActions = useMemo(');
    const actionsStart = SOURCE.indexOf('const actions = useMemo(');
    assert.ok(stableStart > -1 && actionsStart > stableStart);
    const stableBlock = SOURCE.slice(stableStart, actionsStart);
    const actionsBlock = SOURCE.slice(actionsStart);

    const stableOwned = [
        'setSideTab',
        'setGameState',
        'setShopItems',
        'acknowledgeMilestoneStoryBeat',
        'openExpeditionDebrief',
        'setActiveTitle',
        'setReadabilityMode',
        'setEquipmentDetailMode',
        'dismissEvent',
        'setQuickSlot',
        'clearPostCombat',
        'clearEconomyReceipt',
        'getUid',
        'isAdmin',
    ];

    for (const name of stableOwned) {
        assert.ok(stableBlock.includes(`${name}:`), `${name}은 안정 그룹이 소유한다`);
        assert.ok(!actionsBlock.includes(`${name}:`), `${name}이 player 의존 그룹에 중복 정의되면 안 된다`);
    }

    // player를 실제로 읽는 액션은 안정 그룹에 들어가면 안 된다.
    assert.ok(actionsBlock.includes('closeExpeditionDebrief:'), 'closeExpeditionDebrief는 player 의존 그룹에 남는다');
    assert.ok(!stableBlock.includes('closeExpeditionDebrief:'));
});
