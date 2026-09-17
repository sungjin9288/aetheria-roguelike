import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { useGameEngine } from '../src/hooks/useGameEngine.ts';

/**
 * Wave 4 N2 — useGameEngine의 `actions` 조립 가드. Wave 5 W3-B 재작성.
 *
 * 원본 계약(소스 텍스트 grep):
 *
 *   `actions`는 player가 바뀔 때마다 통째로 다시 만들어졌다. 그중 절반은 dispatch만
 *   쓰는 순수 래퍼라 player와 아무 상관이 없다. 이제 안정 그룹(`stableActions`)과
 *   player 의존 그룹으로 나뉘어 있고, 이 파일은 그 분리가 조용히 되돌아가는 것을 막는다.
 *   반환 셰이프는 그대로여야 한다 — 안정 그룹은 기존과 같은 자리(팩토리 spread 다음)에
 *   펼쳐지므로 키 집합과 우선순위가 보존된다.
 *
 * 이 계약의 핵심은 "player가 바뀌어도 stableActions가 담당하는 함수들의 object
 * identity(===)가 재생성되지 않는다"는 **재렌더 사이의 메모이제이션**이다. 이걸
 * 실제로 관찰하려면 같은 컴포넌트 인스턴스를 두 번 이상 렌더해(예: player를 바꿔
 * 다시 렌더) 그 사이 object identity를 비교해야 하는데, 이 프로젝트의 테스트
 * 러너가 가진 `react-dom/server`의 `renderToStaticMarkup`은 매 호출마다 완전히
 * 새로운 Fiber 트리를 1회성으로 mount만 할 뿐 재렌더(reconciliation)를 지원하지
 * 않는다 — 즉 "다시 렌더링해도 같은 함수 참조인가"를 애초에 관찰할 수 없다.
 * jsdom/react-test-renderer/testing-library도 devDependency에 없다.
 *
 * 그래서 "어떤 useMemo가 어떤 의존성 배열을 쓰는가"(메모이제이션의 실제 메커니즘)는
 * 구조 불변식으로 유지한다. 다만 실제 훅을 1회 렌더해 병합된 `actions` 객체의
 * 최종 공개 shape(안정 그룹 소유 이름들이 실제로 함수로 존재하는지, player 의존
 * 액션도 함께 존재하는지)는 진짜로 렌더해 검증한다 — "훅이 실제로 이 이름들을
 * 노출하는가"는 재렌더 없이도 단일 렌더로 확인 가능한 진짜 행동이다.
 */

const SOURCE = readFileSync(new URL('../src/hooks/useGameEngine.ts', import.meta.url), 'utf8');

const STABLE_OWNED = [
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

test('실제 렌더: useGameEngine().actions는 안정 그룹 소유 함수와 player 의존 액션을 모두 함수로 노출한다', () => {
    let captured = null;
    const Harness = () => {
        const engine = useGameEngine();
        captured = engine.actions;
        return null;
    };

    assert.doesNotThrow(() => renderToStaticMarkup(createElement(Harness)), 'useGameEngine()은 단독으로 렌더 가능하다');
    assert.ok(captured, 'actions 객체가 캡처된다');

    for (const name of STABLE_OWNED) {
        assert.equal(typeof captured[name], 'function', `안정 그룹 소유 액션 "${name}"이 실제로 함수로 노출된다`);
    }
    assert.equal(typeof captured.closeExpeditionDebrief, 'function', 'player 의존 액션도 함께 노출된다(closeExpeditionDebrief)');
    // player 의존 그룹의 대표 액션들도 실제 훅 결과에 있어야 한다.
    for (const name of ['move', 'explore', 'rest', 'jobChange']) {
        assert.equal(typeof captured[name], 'function', `player 의존 액션 "${name}"도 함수로 노출된다`);
    }
});

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

test('구조 불변식: 안정 액션 그룹의 의존성 배열에 player가 들어가지 않는다', () => {
    const deps = readMemoDependencyArray(SOURCE, 'stableActions')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

    assert.ok(!deps.includes('player'), `stableActions 의존성에 player가 있으면 분리 의미가 없다: [${deps.join(', ')}]`);
    assert.ok(!deps.some((entry) => entry.startsWith('player.')), 'player의 하위 필드도 의존성이 될 수 없다');
    assert.deepEqual(deps, ['uid'], '안정 그룹은 uid에만 의존한다 (dispatch는 useReducer가 보장하는 안정 참조)');
});

test('구조 불변식: player 의존 그룹은 안정 그룹을 그대로 펼쳐 반환 셰이프를 유지한다', () => {
    assert.match(SOURCE, /\.\.\.inventoryActions,\s*\n\s*\.\.\.stableActions,/,
        '안정 그룹은 팩토리 spread 다음에 펼쳐져 기존 키 우선순위를 유지한다');

    const deps = readMemoDependencyArray(SOURCE, 'actions')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    assert.ok(deps.includes('player'), 'player 의존 그룹은 여전히 player를 의존성으로 갖는다');
    assert.ok(deps.includes('stableActions'), '안정 그룹을 의존성으로 명시한다');
});

test('구조 불변식: 안정 그룹이 소유한 액션은 player 의존 그룹에서 다시 정의되지 않는다', () => {
    const stableStart = SOURCE.indexOf('const stableActions = useMemo(');
    const actionsStart = SOURCE.indexOf('const actions = useMemo(');
    assert.ok(stableStart > -1 && actionsStart > stableStart);
    const stableBlock = SOURCE.slice(stableStart, actionsStart);
    const actionsBlock = SOURCE.slice(actionsStart);

    for (const name of STABLE_OWNED) {
        assert.ok(stableBlock.includes(`${name}:`), `${name}은 안정 그룹이 소유한다`);
        assert.ok(!actionsBlock.includes(`${name}:`), `${name}이 player 의존 그룹에 중복 정의되면 안 된다`);
    }

    // player를 실제로 읽는 액션은 안정 그룹에 들어가면 안 된다.
    assert.ok(actionsBlock.includes('closeExpeditionDebrief:'), 'closeExpeditionDebrief는 player 의존 그룹에 남는다');
    assert.ok(!stableBlock.includes('closeExpeditionDebrief:'));
});
