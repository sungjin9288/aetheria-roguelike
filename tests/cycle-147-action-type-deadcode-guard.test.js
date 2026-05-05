import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 147: AT(action type) dead-code 가드.
 *
 * cycle 134(SoundManager 키) / 138(CONSTANTS·BALANCE namespace) 흐름의 연장.
 * actionTypes.ts에 선언만 되고 실제 dispatch 호출이 0건인 AT 키가 누적되면
 * (a) 죽은 reducer 핸들러가 늘어 인지 부담 ↑, (b) 진짜 호출이 끊긴 회귀를
 * detect 못함. 양방향 가드:
 *
 * 1. 모든 `AT.X` 키가 src/ 내부 어딘가(actionTypes.ts 제외)에서 1번 이상
 *    `AT.X` 형태로 참조됨.
 * 2. ACTION_MAP에 등록된 모든 핸들러 키도 AT.X에 정의됨 (string typo 가드).
 *
 * cycle 147은 아래 6개 dead AT 키 + 핸들러를 일괄 제거한 후 baseline 0 lock:
 * RESET_RUNTIME_UI, CLEAR_LOGS, SYNTHESIZE_ITEMS, SET_PREMIUM_CURRENCY,
 * SET_CHALLENGE_MODIFIERS, SET_PUBLIC_GRAVES.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SRC = path.join(ROOT, 'src');
const ACTION_TYPES_PATH = path.join(SRC, 'reducers/actionTypes.ts');

const walk = async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true });
    let out = '';
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            out += await walk(full);
        } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
            if (full === ACTION_TYPES_PATH) continue;
            out += await readFile(full, 'utf8');
            out += '\n';
        }
    }
    return out;
};

const collectATKeys = (src) => {
    const keys = new Set();
    // export const AT = Object.freeze({ ... }) 블록 내부의 ^    KEY: 'KEY', 라인만 추출.
    const m = src.match(/export const AT[\s\S]*?Object\.freeze\(\{([\s\S]*?)\}\s*as const\s*\)/);
    if (!m) return keys;
    const body = m[1];
    const re = /^\s+([A-Z_][A-Z0-9_]*)\s*:/gm;
    let k;
    while ((k = re.exec(body)) !== null) keys.add(k[1]);
    return keys;
};

test('AT 키 dead-code 가드: 모든 AT.X가 src/ 내부 어딘가에서 dispatch 됨', async () => {
    const atSrc = await readFile(ACTION_TYPES_PATH, 'utf8');
    const keys = collectATKeys(atSrc);
    assert.ok(keys.size > 0, 'AT 키 추출 실패');

    const corpus = await walk(SRC);
    const dead = [];
    for (const key of keys) {
        const re = new RegExp(`AT\\.${key}\\b`);
        if (!re.test(corpus)) dead.push(key);
    }
    assert.deepEqual(dead, [],
        `dead AT keys (declared but never dispatched — remove or use):\n  ${dead.join('\n  ')}`);
});

test('AT 키 dead-code 가드: 핸들러 등록 키가 모두 AT 정의에 존재 (string typo)', async () => {
    const atSrc = await readFile(ACTION_TYPES_PATH, 'utf8');
    const keys = collectATKeys(atSrc);

    // 핸들러 파일들에서 ^    KEY: ( 또는 ^    KEY: ( pattern 추출.
    const handlerFiles = [
        'reducers/handlers/uiHandlers.ts',
        'reducers/handlers/bootstrapHandlers.ts',
        'reducers/handlers/progressionHandlers.ts',
        'reducers/handlers/featureHandlers.ts',
        'reducers/handlers/multiplayerHandlers.ts',
        'reducers/handlers/rewardHandlers.ts',
    ];
    const handlerKeys = new Set();
    for (const rel of handlerFiles) {
        const full = path.join(SRC, rel);
        let src;
        try {
            src = await readFile(full, 'utf8');
        } catch { continue; }
        const re = /^\s+([A-Z_][A-Z0-9_]*)\s*:\s*\(/gm;
        let m;
        while ((m = re.exec(src)) !== null) handlerKeys.add(m[1]);
    }

    const orphan = [...handlerKeys].filter((k) => !keys.has(k));
    assert.deepEqual(orphan, [],
        `핸들러 등록 키가 AT 정의에 없음 (string typo or stale handler):\n  ${orphan.join('\n  ')}`);
});
