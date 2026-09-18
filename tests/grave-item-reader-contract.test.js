import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * W11(C2 판단 d): 묘비 아이템은 언제나 `getGraveItems()` 경유로 읽는다.
 *
 * 구형 save는 `grave.item`(단수), 신형은 `grave.items[]`(복수)다(CLAUDE.md §8-2).
 * `migrateData`는 이 모양을 정규화하지 않는다 — 정규화는 `DATA_VERSION` bump를 동반하는
 * save 구조 변경인데, 지금 깨진 reader가 하나도 없어서 그 위험을 살 이유가 없다는 판단이다.
 * 대신 "읽기는 항상 getGraveItems" 를 코드 수준 불변식으로 만들어, 단수 save에 대해 빈 목록을
 * 보게 되는 함정 자체를 없앤다. 이 가드는 그 불변식이 되살아나 깨지는 것을 막는다.
 *
 * 분류: 부재 불변식(§7 정책 (a)) — 실행으로 증명할 수 없는 "직접 인덱싱이 없다"를 지킨다.
 */
const READER_FILES = [
    'src/utils/graveUtils.ts',
    'src/hooks/useInventoryActions.ts',
    'src/components/GravePanel.tsx',
];

/**
 * `getGraveItems` 본체(단수/복수 흡수의 유일한 소유자)는 예외다 — 선언부터 닫는 `);`까지를 잘라낸다.
 */
const stripOwnerBody = (source) => {
    const start = source.indexOf('export const getGraveItems');
    if (start === -1) return source;
    const end = source.indexOf('\n);', start);
    return end === -1 ? source : source.slice(0, start) + source.slice(end);
};

test('묘비 아이템 reader는 getGraveItems를 거친다 (구형 단수 save 흡수)', async () => {
    for (const rel of READER_FILES) {
        const source = stripOwnerBody(await readFile(path.join(ROOT, rel), 'utf8'));
        const offenders = source
            .split('\n')
            .map((line, i) => [i + 1, line])
            .filter(([, line]) => /(?:targetGrave|grave|entry)\??\.items\b/.test(line))
            .filter(([, line]) => !line.trim().startsWith('*') && !line.trim().startsWith('//'));
        assert.deepEqual(
            offenders,
            [],
            `${rel}: 묘비 .items 직접 인덱싱은 getGraveItems로 대체할 것 — ${offenders.map(([n, l]) => `${n}: ${l.trim()}`).join(' / ')}`,
        );
    }
});

test('getGraveItems는 단수 item save와 복수 items save를 같은 목록으로 읽는다', async () => {
    const { getGraveItems } = await import('../src/utils/graveUtils.js');
    const item = { id: 'a', name: '녹슨 검' };
    assert.deepEqual(getGraveItems({ item }), [item], '구형 단수 save');
    assert.deepEqual(getGraveItems({ items: [item] }), [item], '신형 복수 save');
    assert.deepEqual(getGraveItems({ items: [], item }), [], 'items가 빈 배열이면 빈 목록(단수로 되돌아가지 않는다)');
    assert.deepEqual(getGraveItems(null), [], 'null 묘비');
    assert.deepEqual(getGraveItems(undefined), [], 'undefined 묘비');
});
