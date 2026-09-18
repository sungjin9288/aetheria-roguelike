import test from 'node:test';
import assert from 'node:assert/strict';

import { isSaveEnvelope, createGameStorage, resolveCloudBootstrapAuthority } from '../src/platform/gameStorage.ts';
import { readLocalGameSnapshot, writeLocalGameSnapshot } from '../src/utils/localGameSnapshot.ts';

/**
 * W10-B2 — 세이브 봉투 검증기 통일.
 *
 * 통일 전, "이 값이 player 슬롯을 가진 세이브 봉투인가"를 판정하던 4곳은 문구만
 * 달랐을 뿐 실제로는 완전히 동일한 진리표를 가졌다(아래 재구현 3종 vs 현재
 * `isSaveEnvelope`가 이를 실측한다):
 *   1. `gameStorage.ts`의 (구)`isGameSnapshot` — `value!==null && typeof==='object'
 *      && 'player' in value && Boolean(value.player)`.
 *   2. `resolveCloudBootstrapAuthority`의 `!remote?.player` (2곳).
 *   3. `localGameSnapshot.ts`의 `readSnapshot`(`!parsed || typeof!=='object' || !parsed.player`)과
 *      `writeSnapshot`(`!snapshot?.player`).
 *
 * `'player' in value`는 뒤따르는 `Boolean(value.player)`보다 더 좁지 않다(없는 키를
 * 읽으면 어차피 undefined → false이므로 `in` 검사는 지금까지도 순수하게 redundant였다) —
 * 그래서 새 `isSaveEnvelope`는 그 checks를 생략했다. 아래 표가 그 무변경을 실측한다:
 * 재구현 3종(REIMPL_*)과 현재 `isSaveEnvelope`가 26개 대표값 전부에서 일치해야 한다.
 */

// ── "이전" 판정 3종의 재구현 — gameStorage.ts를 고치기 전의 실제 코드를 그대로 옮긴 것이다. ──
const REIMPL_isGameSnapshot = (value) => (
    value !== null
    && typeof value === 'object'
    && 'player' in value
    && Boolean(value.player)
);
const REIMPL_remoteOptionalChain = (value) => Boolean(value?.player);
const REIMPL_readSnapshotGuard = (value) => !(!value || typeof value !== 'object' || !value.player);
const REIMPL_writeSnapshotGuard = (value) => !(!value?.player);

/** 26개 대표값 — 카테고리: null/undefined, 빈/유효 player, falsy player, 배열, 원시값, null-프로토타입 객체. */
const CASES = [
    ['null', null, false],
    ['undefined', undefined, false],
    ['{} (player 없음)', {}, false],
    ['{player:null}', { player: null }, false],
    ['{player:undefined}', { player: undefined }, false],
    ['{player:false}', { player: false }, false],
    ['{player:0}', { player: 0 }, false],
    ["{player:''}", { player: '' }, false],
    ['{player:{}} (빈 객체도 truthy)', { player: {} }, true],
    ["{player:{name:'x'}}", { player: { name: 'x' } }, true],
    ['{player:[]} (빈 배열도 truthy)', { player: [] }, true],
    ['{player:[1]}', { player: [1] }, true],
    ['[] (배열 자체)', [], false],
    ['[1,2,3]', [1, 2, 3], false],
    ["'string'", 'string', false],
    ["'' (빈 문자열)", '', false],
    ['5', 5, false],
    ['0', 0, false],
    ['false', false, false],
    ['true', true, false],
    ['NaN', NaN, false],
    ['new Date()', new Date(), false],
    ['function(){}', function example() {}, false],
    ["{other:'x'} (player 아닌 키만)", { other: 'x' }, false],
    ['Object.create(null) (프로토타입 없는 빈 객체)', Object.create(null), false],
    [
        'Object.create(null)에 player 채움',
        Object.assign(Object.create(null), { player: { a: 1 } }),
        true,
    ],
];

test('통일 전 판정 3종(재구현)이 26개 대표값에서 서로 완전히 일치한다 — 통일 가능성의 전제', () => {
    for (const [label, value] of CASES) {
        const a = REIMPL_isGameSnapshot(value);
        const b = REIMPL_remoteOptionalChain(value);
        const c = REIMPL_readSnapshotGuard(value);
        const d = REIMPL_writeSnapshotGuard(value);
        assert.equal(b, a, `${label}: remote?.player 판정이 isGameSnapshot과 다름`);
        assert.equal(c, a, `${label}: readSnapshot 가드가 isGameSnapshot과 다름`);
        assert.equal(d, a, `${label}: writeSnapshot 가드가 isGameSnapshot과 다름`);
    }
});

test('accepted-shape table: isSaveEnvelope가 통일 전 4곳의 판정과 정확히 같은 결과를 낸다', () => {
    for (const [label, value, expected] of CASES) {
        assert.equal(REIMPL_isGameSnapshot(value), expected, `${label}: 표의 기대값 자체가 잘못됨(수정 필요)`);
        assert.equal(isSaveEnvelope(value), expected, `${label}: isSaveEnvelope != 이전 동작`);
    }
});

test('accepted-shape table: 통일된 실제 호출부(localGameSnapshot 왕복)도 같은 표를 따른다', () => {
    const storage = (() => {
        const values = new Map();
        return {
            getItem: (key) => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
            removeItem: (key) => values.delete(key),
        };
    })();
    for (const [label, value, expected] of CASES) {
        if (typeof value === 'function') continue; // JSON.stringify(function) === undefined — 별도 처리 불필요(항상 거부).
        const wrote = writeLocalGameSnapshot(value, storage);
        assert.equal(wrote, expected, `${label}: writeLocalGameSnapshot`);
        if (expected) {
            assert.deepEqual(readLocalGameSnapshot(storage), JSON.parse(JSON.stringify(value)), `${label}: 왕복 값 불일치`);
        }
    }
});

test('accepted-shape table: resolveCloudBootstrapAuthority의 remote 판정도 같은 표를 따른다', () => {
    const local = { saveVersion: 1, revision: 1, savedAt: 1 };
    for (const [label, value, expected] of CASES) {
        const authority = resolveCloudBootstrapAuthority(local, value);
        // remote가 세이브 봉투가 아니면(expected=false) local이 있으니 'local', 아니면
        // saveSchemaVersion 등이 없는 legacy 문서로 취급돼 'remote'가 된다(레거시 보존 분기).
        assert.equal(authority, expected ? 'remote' : 'local', `${label}: resolveCloudBootstrapAuthority`);
    }
});

test('createGameStorage.save는 isSaveEnvelope가 거부하는 payload를 거부한다(행동 보존)', async () => {
    const values = new Map();
    const backend = {
        getItem: async (key) => values.get(key) ?? null,
        setItem: async (key, value) => values.set(key, value),
        removeItem: async (key) => values.delete(key),
    };
    const storage = createGameStorage({ backend, now: () => 1 });
    for (const [label, value, expected] of CASES) {
        if (expected) continue; // 통과 사례는 다른 game-storage.test.js가 이미 충분히 덮는다.
        if (value === null || typeof value !== 'object' || Array.isArray(value)) continue; // save()는 Record 타입을 요구 — 같은 경계를 primitives에 대해 또 확인할 필요 없음.
        await assert.rejects(() => storage.save(value), /A game snapshot requires player data/, `${label}: save가 거부하지 않음`);
    }
});
