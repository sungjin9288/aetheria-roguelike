import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 139: 이벤트 체인 'legendary_item' 보상 핸들러 누락 fix.
 *
 * 발견:
 * - eventChains.ts의 lost_wizard chain step에 reward type 'legendary_item'이
 *   존재 ({ type: 'legendary_item', name: '전설의 마법서', itemType: 'weapon' }).
 * - eventActions.handleEventChoice는 gold/item/relic/combat_bonus/stat_bonus
 *   5개 reward type을 처리하지만 legendary_item은 분기 없음.
 * - 결과: 플레이어가 lost_wizard 챕터의 "전투를 받아들인다 (전설 보상)"을
 *   선택해 outcome을 발동시켜도 아이템이 인벤토리에 추가되지 않음.
 *
 * 수정:
 * eventActions에 `rwd.type === 'legendary_item'` 분기 추가. 'item'과 동일하게
 * addItemByName 호출 + addLog 'success' MSG.LOOT_GET 출력. cycle 122/135
 * quest_complete sound는 외곽 if (rwd) 블록에서 자동 트리거.
 *
 * 별도 콘텐츠 갭: 'legendary_item' name인 '전설의 마법서'가 items.ts에 정의
 * 안 돼 있음. addItemByName은 itemDef 없으면 player 그대로 반환 (silent
 * no-op). 이는 별도 사이클로 콘텐츠 정합 정리 필요. 이번 사이클은 핸들러 인프라
 * 만 추가.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('eventActions: rwd.type === "legendary_item" 분기 추가됨', async () => {
    const source = await readSrc('src/hooks/gameActions/eventActions.ts');
    assert.match(source, /rwd\.type\s*===\s*['"]legendary_item['"]/);
});

test('eventActions: legendary_item 분기가 addItemByName 호출', async () => {
    const source = await readSrc('src/hooks/gameActions/eventActions.ts');
    const idx = source.indexOf("'legendary_item'");
    assert.ok(idx > -1);
    const window = source.slice(idx, idx + 400);
    assert.match(window, /addItemByName/);
});

test('회귀 보존: 기존 5개 reward 타입 분기 유지 (gold/item/relic/combat_bonus/stat_bonus)', async () => {
    const source = await readSrc('src/hooks/gameActions/eventActions.ts');
    for (const t of ['gold', 'item', 'relic', 'combat_bonus', 'stat_bonus']) {
        assert.match(source, new RegExp(`rwd\\.type\\s*===\\s*['"]${t}['"]`));
    }
});
