import { createHash } from 'node:crypto';

import { MONSTERS, BOSS_MONSTERS } from '../../src/data/monsters';
import { MAPS } from '../../src/data/maps';
import { TITLES } from '../../src/data/titles';

/**
 * Wave 10 B5 — 아트 채택 가드가 `src/data/monsters.ts` 등을 "파일 바이트"가 아니라
 * "게임플레이 데이터 값"으로 고정하기 위한 헬퍼.
 *
 * 이전에는 `tests/*-adoption*.test.js`/`tests/*-source.test.js`가 데이터 파일의
 * SHA-256(raw bytes)을 핀으로 박아 뒀다 — 그래서 타입 주석 추가처럼 "값은 전혀
 * 안 바뀌었지만 텍스트는 바뀐" 편집(Wave 9 A1의 `BOSS_BRIEFS` 타입 도출 등)마다
 * 핀을 재고정해야 했다. 이 헬퍼는 파일을 파싱한 뒤 **실제 export 값**을
 * 정규화(canonicalize)해서 해시하므로, 값이 그대로면 소스 텍스트가 어떻게
 * 바뀌든(주석 추가, 키 순서 변경, 공백, 타입 어노테이션…) 해시가 그대로다.
 *
 * 정규화 규칙:
 *   - 객체 키는 재귀적으로 정렬한다 — 같은 키/값 집합이면 소스의 선언 순서와
 *     무관하게 같은 해시가 나온다.
 *   - 배열 원소는 선언 순서를 그대로 유지한다 — 배열은 순서 자체가 의미(예:
 *     `TITLES`의 칭호 목록 순서, `pattern` 확률 등)이므로 정렬하지 않는다.
 *   - `undefined`는 드롭한다 — 객체 키든 배열 원소든, 값이 `undefined`면
 *     결과에서 사라진다(JSON.stringify와 동일하게 "없는 것"으로 취급).
 *   - 숫자/문자열/불리언/`null`은 있는 그대로 직렬화한다(추가 반올림·형변환 없음).
 *     다만 `NaN`/`Infinity`/`-Infinity`는 JSON에 없는 값이라 `JSON.stringify`가
 *     조용히 `null`로 뭉개버리므로, 정보 손실을 막기 위해 각각 구분되는 문자열
 *     태그로 치환한다(현재 몬스터/맵/칭호 데이터에는 등장하지 않지만, 정규화 규칙이
 *     "숫자는 있는 그대로"를 실제로 지키게 하기 위한 안전장치다).
 *   - 함수는 소스코드를 해시하지 않는다 — `` `[fn]${length}` `` (파라미터 개수)로만
 *     치환한다. 그래서 "몬스터 AI 콜백을 바꿨다"는 사실은(길이가 바뀌면) 여전히
 *     감지되지만, 콜백 내부 구현 텍스트 차이로 매번 재고정할 필요가 없다.
 *   - 순환 참조는 `'[circular]'`로 치환해 무한 재귀를 막는다(현재 데이터에는
 *     순환이 없지만 방어적으로 둔다).
 */

const FUNCTION_MARKER = '[fn]';
const CIRCULAR_MARKER = '[circular]';
const NAN_MARKER = '[nan]';
const POSITIVE_INFINITY_MARKER = '[+infinity]';
const NEGATIVE_INFINITY_MARKER = '[-infinity]';

type Canonical = string | number | boolean | null | Canonical[] | { [key: string]: Canonical };

const canonicalizeNumber = (value: number): Canonical => {
    if (Number.isNaN(value)) return NAN_MARKER;
    if (value === Number.POSITIVE_INFINITY) return POSITIVE_INFINITY_MARKER;
    if (value === Number.NEGATIVE_INFINITY) return NEGATIVE_INFINITY_MARKER;
    return value;
};

const canonicalizeArray = (value: unknown[], seen: Set<object>): Canonical[] => {
    const out: Canonical[] = [];
    for (const item of value) {
        const canonical = canonicalize(item, seen);
        // 배열도 undefined는 드롭한다 — 객체 키 드롭과 동일 규칙.
        if (canonical !== undefined) out.push(canonical);
    }
    return out;
};

const canonicalizeObject = (value: object, seen: Set<object>): { [key: string]: Canonical } => {
    const record = value as Record<string, unknown>;
    const out: { [key: string]: Canonical } = {};
    for (const key of Object.keys(record).sort()) {
        const canonical = canonicalize(record[key], seen);
        if (canonical !== undefined) out[key] = canonical;
    }
    return out;
};

function canonicalize(value: unknown, seen: Set<object>): Canonical | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;

    if (typeof value === 'function') {
        // 함수 본문(소스 텍스트)은 절대 해시하지 않는다 — 파라미터 개수만 신호로 쓴다.
        return `${FUNCTION_MARKER}${value.length}`;
    }
    if (typeof value === 'number') return canonicalizeNumber(value);
    if (typeof value === 'string' || typeof value === 'boolean') return value;

    if (typeof value === 'object') {
        if (seen.has(value)) return CIRCULAR_MARKER;
        seen.add(value);
        try {
            return Array.isArray(value) ? canonicalizeArray(value, seen) : canonicalizeObject(value, seen);
        } finally {
            seen.delete(value);
        }
    }

    // symbol/bigint 등 게임 데이터에는 등장하지 않는 타입 — 타입 태그만 남긴다.
    return `[unsupported:${typeof value}]`;
}

/** 임의의 값을 정규화해 SHA-256 해시로 고정한다 — 순수 함수, `node:crypto` 외 의존성 없음. */
export function hashGameplayData(value: unknown): string {
    const canonical = canonicalize(value, new Set());
    const serialized = canonical === undefined ? 'undefined' : JSON.stringify(canonical);
    return createHash('sha256').update(serialized, 'utf8').digest('hex');
}

/** `src/data/monsters.ts`의 게임플레이 데이터(`MONSTERS`+`BOSS_MONSTERS`) 값 해시. */
export function hashMonsters(): string {
    return hashGameplayData({ MONSTERS, BOSS_MONSTERS });
}

/** `src/data/maps.ts`의 게임플레이 데이터(`MAPS`) 값 해시. */
export function hashMaps(): string {
    return hashGameplayData({ MAPS });
}

/** `src/data/titles.ts`의 게임플레이 데이터(`TITLES`) 값 해시. */
export function hashTitles(): string {
    return hashGameplayData({ TITLES });
}
