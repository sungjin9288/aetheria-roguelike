import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { MSG } from '../src/data/messages.js';

/**
 * H4 (Wave 3 감사): 엔진 / 리듀서 / 탐험 계층의 하드코딩 한국어 → MSG.
 *
 * CLAUDE.md §5 "한국어 문자열 하드코딩 금지" 회귀 가드. 문구는 한 글자도 바뀌지 않았고
 * 소유만 MSG로 옮겼으므로, 이 테스트는 (1) MSG가 정확히 같은 문구를 들고 있고
 * (2) 해당 소스에 문구가 다시 박히지 않는 것을 함께 고정한다.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

const OWNED = [
    ['COMBAT_BLIND_MISS', '[실명] 공격이 빗나갔습니다!'],
    ['COMBAT_FEAR_FLINCH', '[공포] 두려움에 움츠립니다!'],
    ['RETURN_SUPPLY_DELIVERED', '귀환 보급 지급 · 하급 체력 물약 1개'],
    ['EXPLORE_KEY_EVENT', '💎 [잊혀진 열쇠]가 빛나며 숨겨진 <고대 보물고> 입구가 열립니다!'],
    ['EXPLORE_RELIC_DISCOVERED', '✨ [유물 발견] 고대의 기운이 느껴집니다! 유물을 선택하세요.'],
    ['EXPLORE_ANOMALY_POISON', '자욱한 독안개가 밀려옵니다! (중독)'],
    ['EXPLORE_ANOMALY_MANA_REGEN', '강력한 마력의 폭풍이 붑니다. (MP 30% 회복)'],
    ['EXPLORE_ANOMALY_BURN', '피부를 찌르는 산성비가 내립니다. (화상)'],
];

/** 소스에서 주석 줄을 제거한다 — 설계 근거 주석에 남은 문구는 하드코딩이 아니다. */
const stripComments = (source) => source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n');

test('H4: 회수한 문구를 MSG가 그대로 소유한다', () => {
    OWNED.forEach(([key, text]) => {
        assert.equal(MSG[key], text, `MSG.${key} 문구가 바뀌었다`);
    });
    assert.equal(MSG.EXPLORE_ANOMALY('테스트'), '[기상 이변] 테스트');
    assert.equal(MSG.EXPLORE_CHAIN_EVENT('사라진 대상', '문이 열린다'), '📜 [사라진 대상] 문이 열린다');
    // 같은 접두사를 쓰는 기존 키와 충돌하지 않는다(전투 직전 유물 발견은 별도 문구).
    assert.notEqual(MSG.EXPLORE_RELIC_FOUND, MSG.EXPLORE_RELIC_DISCOVERED);
});

test('H4: 엔진 전투 행동에 실명/공포 문구가 inline으로 남지 않는다', async () => {
    const source = stripComments(await readSrc('src/systems/CombatEngine.actions.ts'));

    assert.doesNotMatch(source, /'\[실명\] 공격이 빗나갔습니다!'/);
    assert.doesNotMatch(source, /'\[공포\] 두려움에 움츠립니다!'/);
    assert.match(source, /MSG\.COMBAT_BLIND_MISS/);
    assert.match(source, /MSG\.COMBAT_FEAR_FLINCH/);
});

test('H4: 리듀서 귀환 보급 로그가 MSG를 참조한다', async () => {
    const source = stripComments(await readSrc('src/reducers/gameReducer.ts'));

    assert.doesNotMatch(source, /'귀환 보급 지급 · 하급 체력 물약 1개'/);
    assert.match(source, /text: MSG\.RETURN_SUPPLY_DELIVERED/);
});

test('H4: 탐험 이상기후 / 열쇠 / 유물 문구가 MSG를 참조한다', async () => {
    // Wave 4 N1: dispatch 소비 함수가 hooks/gameActions/exploreFlow.ts로 이동 — 경로만 갱신.
    const source = stripComments(await readSrc('src/hooks/gameActions/exploreFlow.ts'));

    assert.doesNotMatch(source, /'자욱한 독안개가 밀려옵니다!/);
    assert.doesNotMatch(source, /'강력한 마력의 폭풍이 붑니다\./);
    assert.doesNotMatch(source, /'피부를 찌르는 산성비가 내립니다\./);
    assert.doesNotMatch(source, /`\[기상 이변\] \$\{/);
    assert.doesNotMatch(source, /'💎 \[잊혀진 열쇠\]/);
    assert.doesNotMatch(source, /'✨ \[유물 발견\] 고대의 기운/);

    assert.match(source, /MSG\.EXPLORE_ANOMALY_POISON/);
    assert.match(source, /MSG\.EXPLORE_ANOMALY_MANA_REGEN/);
    assert.match(source, /MSG\.EXPLORE_ANOMALY_BURN/);
    assert.match(source, /MSG\.EXPLORE_ANOMALY\(/);
    assert.match(source, /MSG\.EXPLORE_KEY_EVENT/);
    assert.match(source, /MSG\.EXPLORE_RELIC_DISCOVERED/);
});

test('H4: 내러티브 체인 로그 서식이 MSG를 참조한다', async () => {
    const source = stripComments(await readSrc('src/hooks/gameActions/exploreActions.ts'));

    assert.doesNotMatch(source, /`📜 \[\$\{chain\.label\}\]/);
    assert.match(source, /MSG\.EXPLORE_CHAIN_EVENT\(/);
});
