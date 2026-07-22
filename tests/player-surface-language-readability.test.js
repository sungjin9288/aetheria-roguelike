import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('quest board and crafting use one player-facing Korean vocabulary', async () => {
    const [questBoard, questOperations, questTab, crafting] = await Promise.all([
        readSrc('src/components/tabs/QuestBoardPanel.tsx'),
        readSrc('src/utils/questOperations.ts'),
        readSrc('src/components/tabs/QuestTab.tsx'),
        readSrc('src/components/tabs/CraftingPanel.tsx'),
    ]);

    for (const label of ['마을 임무 게시판', '임무 선택', '추천 임무', '목적지', '위험', '보상', '귀환 기준']) {
        assert.match(questBoard, new RegExp(label));
    }
    for (const label of ['임무 안내', '게시판에서 임무 수락', '휴식으로 회복 우선', '성장 방향 확인']) {
        assert.match(questOperations, new RegExp(label));
    }
    assert.doesNotMatch(questBoard, /MISSION GRID|MISSION TERMINAL|추천 오퍼레이션|RUN COMPOSITION|SCOUT BRIEF|Lv\./);
    assert.doesNotMatch(questOperations, /Scout Brief|BOARD 계약|REST 회복|파워 스파이크|보스 챌린지|파밍|빌드 점검/);

    for (const label of ['오늘의 임무', '발견 여정', '주간 임무', '임무 게시판 열기']) {
        assert.match(questTab, new RegExp(label));
    }
    assert.doesNotMatch(questTab, /Daily Protocol|Discovery Chains|Weekly Mission|NO ACTIVE MISSIONS/);

    for (const label of ['장비 제작소', '제작', '합성', '가방', '재료 확인', '합성 시작']) {
        assert.match(crafting, new RegExp(label));
    }
    assert.doesNotMatch(crafting, /FORGE CIRCUIT|FORGE MATRIX|LOCKED|>INV<|>CRAFT<|>SYNTH</);
});

test('stats and codex keep detailed information readable without legacy abbreviations', async () => {
    const [stats, codex, weaponCodex, monsterCodex, equipmentCard, recipeCodex, materialCodex, legendaryCodex] = await Promise.all([
        readSrc('src/components/StatsPanel.tsx'),
        readSrc('src/components/Codex.tsx'),
        readSrc('src/components/codex/WeaponCodex.tsx'),
        readSrc('src/components/codex/MonsterCodex.tsx'),
        readSrc('src/components/codex/EquipmentCodexCard.tsx'),
        readSrc('src/components/codex/RecipeCodex.tsx'),
        readSrc('src/components/codex/MaterialCodex.tsx'),
        readSrc('src/components/codex/LegendaryCodex.tsx'),
    ]);

    for (const label of ['모험 기록', '총 처치', '사망', '보스 처치', '제작 횟수', '합성 횟수', '최대 연속 처치', '완료한 발견 여정']) {
        assert.match(stats, new RegExp(label));
    }
    assert.doesNotMatch(stats, /label:\s*['"](?:TOTAL KILLS|DEATHS|BOSS KILLS|CRAFTS|SYNTHESES|MAX STREAK|CHAINS)['"]/);

    for (const label of ['모험 도감', "label: '장비'", "label: '몬스터'", "label: '제작법'", "label: '소재'", "label: '전설'"]) {
        assert.match(codex, new RegExp(label));
    }
    assert.doesNotMatch(codex, /label:\s*['"](?:EQUIP|MONSTER|RECIPE|MATERIAL|LEGEND)['"]/);
    assert.match(weaponCodex, /무기.*방어구.*방패/s);
    assert.match(monsterCodex, /생명.*공격력.*방어력/s);
    assert.match(equipmentCard, /공격력.*방어력.*생명.*기력/s);
    assert.match(recipeCodex, /비용: 골드/);
    assert.match(materialCodex, /획득처:/);
    assert.match(legendaryCodex, /전설 수집/);
    assert.doesNotMatch(`${equipmentCard}\n${recipeCodex}\n${materialCodex}`, />\s*(?:ATK|DEF|HP|MP)\s*<\/|\}G/);
});

test('focus panel headers preserve natural casing and readable typography', async () => {
    const focusPanelHeader = await readSrc('src/components/FocusPanelHeader.tsx');

    assert.match(focusPanelHeader, /font-readable/);
    assert.doesNotMatch(focusPanelHeader, /uppercase|tracking-\[/);
});

test('shop, equipment, and inventory use one readable commerce vocabulary', async () => {
    const [shop, equipment, inventory] = await Promise.all([
        readSrc('src/components/ShopPanel.tsx'),
        readSrc('src/components/EquipmentPanel.tsx'),
        readSrc('src/components/SmartInventory.tsx'),
    ]);

    for (const label of ['마을 상점', '판매 등급', '가방', '오늘의 할인', '이번 주 특별 상품', '골드']) {
        assert.match(shop, new RegExp(label));
    }
    for (const label of ['공격력', '방어력', '강화 재료', '보조 장비', '세트 목록', '생명', '기력']) {
        assert.match(equipment, new RegExp(label));
    }
    assert.match(equipment, /양손 무기\(2피스\)/);
    assert.match(equipment, /MSG\.OUTFIT_SET_TWO_HAND_SLOT/);
    assert.match(equipment, /MSG\.OUTFIT_SET_TWO_HAND_HINT/);
    for (const label of ['공격력', '방어력', '치명타', '기력', '강화 비용: 골드']) {
        assert.match(inventory, new RegExp(label));
    }

    const playerSurfaces = `${shop}\n${equipment}\n${inventory}`;
    assert.doesNotMatch(playerSurfaces, /Broker Ledger|MARKET|Daily Deals|Weekly Special|\d+\s*CR|['"`]ATK['"`]|['"`]DEF['"`]|['"`]CRIT%?['"`]|['"`]HP['"`]|['"`]MP['"`]|\}G/);
});
