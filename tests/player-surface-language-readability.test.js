import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createElement } from 'react';

import QuestBoardPanel from '../src/components/tabs/QuestBoardPanel.tsx';
import QuestTab from '../src/components/tabs/QuestTab.tsx';
import CraftingPanel from '../src/components/tabs/CraftingPanel.tsx';
import FocusPanelHeader from '../src/components/FocusPanelHeader.tsx';
import WeaponCodex from '../src/components/codex/WeaponCodex.tsx';
import MonsterCodex from '../src/components/codex/MonsterCodex.tsx';
import EquipmentCodexCard from '../src/components/codex/EquipmentCodexCard.tsx';
import RecipeCodex from '../src/components/codex/RecipeCodex.tsx';
import MaterialCodex from '../src/components/codex/MaterialCodex.tsx';
import LegendaryCodex from '../src/components/codex/LegendaryCodex.tsx';
import Codex from '../src/components/Codex.tsx';
import StatsPanel from '../src/components/StatsPanel.tsx';
import EquipmentPanel from '../src/components/EquipmentPanel.tsx';
import ShopPanel from '../src/components/ShopPanel.tsx';
import { getQuestBoardRecommendations } from '../src/utils/questOperations.ts';
import { DB } from '../src/data/db.ts';
import { MSG } from '../src/data/messages.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');
const NOOP_ACTIONS = new Proxy({}, { get: () => () => undefined });

/**
 * 원래 계약 (각 assert가 지키던 것, 모두 "소스 문자열에 이 한국어가 있다"는
 * 정규식이었다):
 *   1. QuestBoardPanel/questOperations/QuestTab/CraftingPanel은 하나의 플레이어向
 *      한국어 임무·제작 어휘(마을 임무 게시판/임무 선택/추천 임무/목적지/위험/보상/
 *      귀환 기준, 임무 안내/게시판에서 임무 수락/휴식으로 회복 우선/성장 방향 확인,
 *      오늘의 임무/발견 여정/주간 임무/임무 게시판 열기, 장비 제작소/제작/합성/가방/
 *      재료 확인/합성 시작)를 쓰고 MISSION GRID 같은 영문 잔재가 없다.
 *   2. StatsPanel/Codex/각 코덱스 카드는 상세 정보를 총 처치/사망/보스 처치/제작
 *      횟수/합성 횟수/최대 연속 처치/완료한 발견 여정, 모험 도감/장비/몬스터/제작법/
 *      소재/전설, 무기·방어구·방패/생명·공격력·방어력/공격력·방어력·생명·기력/
 *      비용: 골드/획득처:/전설 수집 같은 한국어로 노출하고 TOTAL KILLS 같은 레거시
 *      약어가 없다.
 *   3. FocusPanelHeader는 자연스러운 대소문자(font-readable)를 쓰고 uppercase/
 *      tracking을 쓰지 않는다.
 *   4. Shop/Equipment/Inventory는 하나의 읽기 쉬운 상거래 어휘(마을 상점/판매 등급/
 *      가방/오늘의 할인/이번 주 특별 상품/골드, 공격력/방어력/강화 재료/보조 장비/
 *      세트 목록/생명/기력/양손 무기(2피스), 강화 비용: 골드)를 쓰고 ATK/DEF/HP/MP/
 *      Broker Ledger 같은 잔재가 없다.
 *
 * 실제로 렌더 가능한 부분은 모두 renderStatic + 실제 데이터/픽스처로 옮겼다. 클릭 등
 * 내부 상태(useState)로만 열리는 서브트리(예: RecipeCodex의 레시피 상세, EquipmentPanel의
 * 세트 카탈로그 펼침 목록)와 SmartInventory의 "아이템 비교 diff/강화 재료 카운트"처럼
 * 픽스처 비용이 계약이 보호하는 가치에 비해 과도하게 큰 표면은 구조 불변식(소스
 * 텍스트)으로 남기고 그 이유를 각 테스트에 남긴다.
 */

test('QuestBoardPanel: 마을 임무 게시판 한국어 어휘가 실제로 렌더링된다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(QuestBoardPanel, {
        player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));

    for (const label of ['마을 임무 게시판', '임무 선택', '추천 임무', '목적지', '위험', '보상', '귀환 기준']) {
        assert.ok(html.includes(label), `"${label}" 노출`);
    }
    assert.ok(!/MISSION GRID|MISSION TERMINAL|추천 오퍼레이션|RUN COMPOSITION|SCOUT BRIEF/.test(html));
});

test('questOperations.getQuestBoardRecommendations: 실제 반환값이 임무 안내/수락/정비 문구를 쓴다', () => {
    const player = makePlayerFixture();
    const result = getQuestBoardRecommendations(player);
    const serialized = JSON.stringify(result);

    assert.ok(result.featured.length > 0, '전제: 신규 플레이어에게도 추천 임무가 있어야 함');
    assert.ok(serialized.includes('임무 안내'), 'getOperationBrief().label === "임무 안내"');
    assert.ok(serialized.includes('게시판에서 임무 수락'), 'planSteps의 수락 단계 문구');
    assert.ok(!/Scout Brief|BOARD 계약|REST 회복|파워 스파이크|보스 챌린지|파밍|빌드 점검/.test(serialized));

    const lowHpPlayer = makePlayerFixture({ hp: 1, maxHp: 100 });
    const lowHpResult = getQuestBoardRecommendations(lowHpPlayer);
    assert.ok(
        JSON.stringify(lowHpResult).includes('휴식으로 회복 우선'),
        '생명이 낮으면 정비 단계가 "휴식으로 회복 우선"으로 바뀜',
    );
});

test('QuestTab: 오늘의 임무/발견 여정/주간 임무/임무 게시판 열기 한국어 어휘가 실제로 렌더링된다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(QuestTab, { player, actions: NOOP_ACTIONS, isInSafeZone: true }));

    for (const label of ['오늘의 임무', '발견 여정', '주간 임무', '임무 게시판 열기']) {
        assert.ok(html.includes(label), `"${label}" 노출`);
    }
    assert.ok(!/Daily Protocol|Discovery Chains|Weekly Mission|NO ACTIVE MISSIONS/.test(html));
});

test('CraftingPanel: 장비 제작소 한국어 어휘가 실제로 렌더링된다', () => {
    const player = makePlayerFixture({ inv: [], gold: 0 });
    const html = renderStatic(createElement(CraftingPanel, {
        player, actions: NOOP_ACTIONS, setGameState: () => {}, onOpenArchiveConsole: () => {},
    }));

    assert.ok(html.includes('장비 제작소'));
    assert.ok(html.includes('제작'));
    assert.ok(html.includes('합성'), '합성 탭 버튼 라벨');
    assert.ok(html.includes('가방'));
    assert.ok(html.includes('재료 확인'), '재료가 없는 레시피는 "재료 확인" 버튼 문구');
    assert.ok(!/FORGE CIRCUIT|FORGE MATRIX|>INV<|>CRAFT<|>SYNTH</.test(html));
});

test('FocusPanelHeader: 자연스러운 대소문자(font-readable)를 쓰고 uppercase/tracking을 쓰지 않는다', () => {
    const html = renderStatic(createElement(FocusPanelHeader, { eyebrow: '테스트', title: '제목' }));
    assert.match(html, /font-readable/);
    assert.ok(!/uppercase/.test(html));
    assert.ok(!/tracking-\[/.test(html));
});

test('StatsPanel: 상세 통계는 한국어 라벨을 쓰고 TOTAL KILLS 같은 레거시 약어가 없다', () => {
    const player = makePlayerFixture();
    const stats = calculateFullStats(player);
    const html = renderStatic(createElement(StatsPanel, { player, stats }));

    for (const label of ['모험 기록', '총 처치', '사망', '보스 처치', '제작 횟수', '합성 횟수', '최대 연속 처치', '완료한 발견 여정']) {
        assert.ok(html.includes(label), `"${label}" 노출`);
    }
    assert.ok(!/label:\s*['"](?:TOTAL KILLS|DEATHS|BOSS KILLS|CRAFTS|SYNTHESES|MAX STREAK|CHAINS)['"]/.test(html));
});

test('Codex: 모험 도감과 5개 하위 탭 라벨이 실제로 렌더링된다', () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(Codex, { player, dispatch: () => {} }));

    assert.ok(html.includes('모험 도감'));
    for (const label of ['장비', '몬스터', '제작법', '소재', '전설']) {
        assert.ok(html.includes(label));
    }
    assert.ok(!/label:\s*['"](?:EQUIP|MONSTER|RECIPE|MATERIAL|LEGEND)['"]/.test(html));
});

test('코덱스 카드: 무기/방어구/방패, 생명/공격력/방어력, 비용·획득처, 전설 수집 문구가 실제로 렌더링된다', () => {
    const player = makePlayerFixture();

    const weaponHtml = renderStatic(createElement(WeaponCodex, {}));
    assert.match(weaponHtml, /무기[\s\S]*방어구[\s\S]*방패/);

    const monsterHtml = renderStatic(createElement(MonsterCodex, { player }));
    assert.match(monsterHtml, /생명[\s\S]*공격력[\s\S]*방어력/);

    // W9-A1: 이전 픽스처의 atk / def는 items.ts 카탈로그에도 Player.equip에도 없는 필드라
    //   EquipmentCodexCard의 해당 StatRow는 실제 플레이에서 한 번도 렌더된 적이 없었다
    //   (장비 ATK/DEF는 `val`이고, 목록 행 WeaponCodex가 getItemStatText로 이미 보여준다).
    //   dead read를 제거했으므로 카드가 실제로 읽는 hp / mp만 픽스처와 단언에 남긴다.
    //   공격력·방어력 라벨 렌더는 바로 위 MonsterCodex 단언이 계속 덮는다.
    const equipmentCard = { name: '테스트 갑옷', type: 'armor', hp: 20, mp: 5, desc: '테스트' };
    const equipmentCardHtml = renderStatic(createElement(EquipmentCodexCard, { item: equipmentCard, player }));
    assert.match(equipmentCardHtml, /생명[\s\S]*기력/);
    assert.ok(!/>\s*(?:ATK|DEF|HP|MP)\s*<\/|\}G/.test(equipmentCardHtml));

    const materialName = DB.ITEMS.materials[0].name;
    const materialHtml = renderStatic(createElement(MaterialCodex, { codex: { materials: { [materialName]: true } } }));
    assert.ok(materialHtml.includes('획득처:'));
    assert.ok(!/>\s*(?:ATK|DEF|HP|MP)\s*<\/|\}G/.test(materialHtml));

    const legendaryHtml = renderStatic(createElement(LegendaryCodex, { player }));
    assert.ok(legendaryHtml.includes('전설 수집'));
});

// 구조 불변식(소스 텍스트) — "비용: 골드"는 레시피 상세(recipe.id === selected)가
// 열렸을 때만 렌더되는데, selected는 클릭으로만 바뀌는 내부 useState라 정적 렌더로는
// 재현할 수 없다.
test('RecipeCodex: 레시피 상세의 "비용: 골드" 문구는 클릭으로만 열리므로 소스 텍스트로 검증한다', async () => {
    const source = await readSrc('src/components/codex/RecipeCodex.tsx');
    assert.match(source, /비용: 골드 \{recipe\.gold\} · 보유 골드 \{player\?\.gold \|\| 0\}/);
});

test('EquipmentPanel: 공격력/방어력/강화 재료/보조 장비/세트 목록/생명/기력, 양손 무기 라벨이 실제로 렌더링된다', () => {
    // showDetails=true가 되려면 레벨>=5 또는 직업≠모험가여야 한다(getEquipmentDisclosure).
    const player = makePlayerFixture({ job: '전사', level: 10 });
    const stats = calculateFullStats(player);
    stats.jobAffinity = {
        tier: 'full', matchCount: 3, label: '전사 세트', twoHandCounted: true,
        bonus: { atkMult: 1.3, defMult: 1.2, hpBonus: 0.1, mpBonus: 0.15 },
        slots: { weapon: true, armor: true, offhand: true },
    };
    const html = renderStatic(createElement(EquipmentPanel, { player, stats, actions: NOOP_ACTIONS }));

    for (const label of ['공격력', '방어력', '강화 재료', '보조 장비', '세트 목록', '생명', '기력']) {
        assert.ok(html.includes(label), `"${label}" 노출`);
    }
    // twoHandCounted=true이면 보조 슬롯 라벨이 MSG.OUTFIT_SET_TWO_HAND_SLOT 실제 값으로 바뀐다.
    assert.ok(html.includes(MSG.OUTFIT_SET_TWO_HAND_SLOT));
    assert.ok(html.includes('data-testid="job-outfit-two-hand-hint"'));
    assert.ok(html.includes(MSG.OUTFIT_SET_TWO_HAND_HINT));
});

// 구조 불변식(소스 텍스트) — "양손 무기(2피스)"는 세트 카탈로그 펼침 목록
// (job-set-catalog-toggle을 클릭해야 열리는 내부 useState) 안의 안내 문구로만
// 존재해 정적 렌더로는 재현할 수 없다.
test('EquipmentPanel: "양손 무기(2피스)" 안내는 세트 카탈로그를 펼쳐야 보이므로 소스 텍스트로 검증한다', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    assert.match(source, /양손 무기\(2피스\)/);
});

test('ShopPanel: 마을 상점 한국어 상거래 어휘가 실제로 렌더링된다', () => {
    const player = makePlayerFixture({ level: 40, gold: 100000, job: '전사' });
    const html = renderStatic(createElement(ShopPanel, {
        player, actions: NOOP_ACTIONS, shopItems: [], setGameState: () => {}, stats: null, onOpenArchiveConsole: () => {},
    }));

    for (const label of ['마을 상점', '판매 등급', '가방', '오늘의 할인', '이번 주 특별 상품', '골드']) {
        assert.ok(html.includes(label), `"${label}" 노출`);
    }
    assert.ok(!/Broker Ledger|MARKET|Daily Deals|Weekly Special|\d+\s*CR/.test(html));
    assert.ok(!/['"`]ATK['"`]|['"`]DEF['"`]|['"`]CRIT%?['"`]|['"`]HP['"`]|['"`]MP['"`]/.test(html));
});

// 구조 불변식(소스 텍스트) — SmartInventory의 스탯 비교(diff)/강화 비용 표시는
// 장착 중인 아이템과 다른 무기/방어구가 인벤토리에 있어야 하고(같은 슬롯, 서로 다른
// atk/def/crit/mp), 강화 재료 보유 수량까지 갖춰야 재현된다. 이 계약이 지키는 가치
// (라벨 문구)에 비해 인벤토리/장비 픽스처 구성 비용이 크므로 이번 사이클은 구조
// 불변식으로 남긴다.
test('SmartInventory: 공격력/방어력/치명타/기력, 강화 비용 문구는 소스 텍스트로 검증한다', async () => {
    const source = await readSrc('src/components/SmartInventory.tsx');
    for (const label of ['공격력', '방어력', '치명타', '기력']) {
        assert.match(source, new RegExp(label));
    }
    assert.match(source, /강화 비용: 골드/);
});
