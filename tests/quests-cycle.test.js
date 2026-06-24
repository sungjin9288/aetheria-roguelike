import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ACHIEVEMENTS, QUESTS } from '../src/data/quests.js';
import { BALANCE } from '../src/data/constants.js';
import { DB } from '../src/data/db.js';
import { EVENT_CHAINS } from '../src/data/eventChains.js';
import { MAPS } from '../src/data/maps.js';
import { MONSTERS } from '../src/data/monsters.js';
import { TITLES } from '../src/data/titles.js';
import { fileURLToPath } from 'node:url';
import { getTitleDefinition } from '../src/utils/gameUtils.js';
import { readFile } from 'node:fs/promises';
import { syncQuestProgress } from '../src/utils/questProgress.js';

/**
 * 퀴스트(Quest) 관련 cycle 테스트 — 통합본.
 * 기존 22개 cycle-*.test.js 통합 (audit #1). 각 원본 본문을 블록 { } 으로 격리 — 행동/커버리지 동일.
 */

// ─── 원본: tests/cycle-122-quest-complete-sound.test.js ───
{
  /**
   * cycle 122: 퀘스트 완료 사운드 큐 — cycle 117(discovery_chain) / 118(new_area)
   * sound 시리즈 연장.
   *
   * 발견:
   * - useInventoryActions.completeQuest는 'success' 로그만 출력 ("퀘스트 완료: ...").
   * - 'success'는 useGameEngine 사운드 매핑에 없어 audio cue 없음.
   * - 퀘스트 완료는 보상 (exp/gold/item) + 가능하면 칭호 해금까지 발생하는 의미
   *   있는 모먼트인데 audio 차원이 비어있음.
   *
   * 추가:
   * - SoundManager case 'quest_complete' — E5/G#5/B5/E6 E major arpeggio.
   *   victory(C major) / discovery_chain(G major) / new_area(D major)와 구분되는
   *   E major 색채. 음악적 다양성으로 surface 정체성.
   * - useInventoryActions.completeQuest: SET_PLAYER dispatch 후 soundManager.play
   *   ('quest_complete') 직접 호출. cycle 88(escape) / 117(discovery_chain) /
   *   118(new_area) 패턴.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('SoundManager: case "quest_complete" 분기 존재', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.match(source, /case\s+['"]quest_complete['"]\s*:/);
  });

  test('useInventoryActions: completeQuest에서 quest_complete 사운드 재생', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      const idx = source.indexOf('completeQuest:');
      assert.ok(idx > -1, 'completeQuest action should exist');
      // completeQuest 함수 끝(다음 액션 시작)까지 추출
      const blockEnd = source.indexOf('claimAchievement:', idx);
      const block = source.slice(idx, blockEnd);
      assert.match(
          block,
          /soundManager.*\(['"]quest_complete['"]\)|play\(['"]quest_complete['"]\)/,
          'completeQuest should call soundManager.play("quest_complete")'
      );
  });

  test('useInventoryActions: soundManager import 추가됨', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      assert.match(source, /import\s*\{[^}]*soundManager[^}]*\}\s*from/);
  });

  test('SoundManager: cycle 117/118 사운드 회귀 보존', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.match(source, /case\s+['"]discovery_chain['"]\s*:/);
      assert.match(source, /case\s+['"]new_area['"]\s*:/);
      assert.match(source, /case\s+['"]escape['"]\s*:/);
  });
}

// ─── 원본: tests/cycle-141-quest-reward-content-check.test.js ───
{
  /**
   * cycle 141: quest / achievement reward.item baseline 가드 — known content gap.
   *
   * cycle 140이 이벤트 체인의 7건 missing item을 발견·수정한 후 같은 패턴을
   * QUESTS / ACHIEVEMENTS에서도 검증해 보니 75종의 unique missing item 발견
   * (40 quests + 40 achievements references). 모든 reward가 silent no-op.
   *
   * 이 컨텐츠 갭은 큰 데이터 정리(75개 신규 items.ts 등록 또는 이름 매핑) 사이클이
   * 필요해 단일 cycle 범위 초과. 대신 이번 사이클은:
   *
   * 1. 현재 missing 75종을 baseline으로 기록 — 명시 인정.
   * 2. NEW missing item(이 baseline 외 추가)이 생기면 즉시 실패 — 회귀 가드.
   * 3. baseline 줄어들면 (콘텐츠 정리 진행됐다면) 즉시 실패 — 점진 좁히기.
   *
   * 결국 baseline이 0이 될 때까지 이 테스트가 진행도를 lock한다.
   */

  const allItemNames = new Set();
  for (const bucket of Object.values(DB.ITEMS || {})) {
      if (Array.isArray(bucket)) {
          for (const item of bucket) {
              if (item?.name) allItemNames.add(item.name);
          }
      }
  }

  // cycle 141 baseline 75 → 142 (-7) → 143 (-7) → 144 (-15) → 145 (-46) = 0.
  // 모든 quest/achievement reward.item이 실재 items.ts 항목으로 매핑됨!
  // NEW missing 가드와 baseline 좁히기 가드 둘 다 빈 set 기준으로 lock.
  const KNOWN_MISSING_REWARD_ITEMS = new Set([]);

  const collectMissing = (entries) => {
      const missing = [];
      for (const e of entries) {
          if (typeof e?.reward?.item === 'string' && !allItemNames.has(e.reward.item)) {
              missing.push(e.reward.item);
          }
      }
      return missing;
  };

  test('quest/achievement reward.item: NEW missing item 0건 (회귀 가드)', () => {
      const missingNames = new Set([...collectMissing(QUESTS), ...collectMissing(ACHIEVEMENTS)]);
      const newMissing = [...missingNames].filter((n) => !KNOWN_MISSING_REWARD_ITEMS.has(n));
      assert.deepEqual(newMissing, [],
          `NEW missing items detected (need to add to items.ts or to baseline):\n  ${newMissing.join('\n  ')}`);
  });

  test('quest/achievement reward.item: baseline 좁히기 — 등록된 known missing이 실제 missing에서 사라지면 baseline에서도 제거 (점진 정리)', () => {
      const missingNames = new Set([...collectMissing(QUESTS), ...collectMissing(ACHIEVEMENTS)]);
      const staleBaseline = [...KNOWN_MISSING_REWARD_ITEMS].filter((n) => !missingNames.has(n));
      assert.deepEqual(staleBaseline, [],
          `stale baseline (these items are now defined — remove from KNOWN_MISSING_REWARD_ITEMS):\n  ${staleBaseline.join('\n  ')}`);
  });

  test('cycle 140 회귀 가드: EVENT_CHAINS 보상은 모두 실재 item (cycle 140 fix 보존)', () => {
      // cycle 140 baseline (이벤트 체인은 실제로 모두 fix 됨) — 0이어야 함.
      const missing = [];
      for (const chain of (EVENT_CHAINS || [])) {
          for (const step of (chain.steps || [])) {
              for (const outcome of (step.event?.outcomes || [])) {
                  const rwd = outcome.reward;
                  if (rwd && (rwd.type === 'item' || rwd.type === 'legendary_item') && rwd.name) {
                      if (!allItemNames.has(rwd.name)) missing.push(rwd.name);
                  }
              }
          }
      }
      assert.deepEqual(missing, [], 'EVENT_CHAINS rewards should all reference existing items');
  });
}

// ─── 원본: tests/cycle-164-quest-target-monster-existence.test.js ───
{
  /**
   * cycle 164: 퀘스트/업적 target → MONSTERS keys 정합성 가드.
   *
   * 발견:
   * - quests.ts의 target에 monsters.ts MONSTERS 객체에 없는 이름 10건 사용 중
   *   (가고일 / 고대 골렘 / 그림자 암살자 / 보물고 수호자 / 빙결 정령 /
   *    사막 도적 / 심해 대사 / 에테르 골렘 / 죽음의 기사 / 차원 보행자).
   * - 해당 퀘스트는 처치 진행도가 영원히 0 — target 이름이 실제 spawn enemy
   *   name과 매칭되지 않아 quest.progress 카운터 미증가.
   * - 사막 도적 vs 사막도적(공백 차이) 같은 텍스트 정합 누락 포함.
   *
   * 수정 (cycle 164 batch):
   * | 기존 missing target | → 교체 (실재 monsters.ts 키)        |
   * |---------------------|--------------------------------------|
   * | 사막 도적           | 사막도적                            |
   * | 가고일              | 유령 기사                           |
   * | 고대 골렘           | 황금 골렘                           |
   * | 그림자 암살자       | 다크 엘프                           |
   * | 보물고 수호자       | 황금 골렘                           |
   * | 빙결 정령           | 서리 정령                           |
   * | 심해 대사           | 심연의 파수꾼                        |
   * | 에테르 골렘         | 에테르 거인                          |
   * | 죽음의 기사         | 타락 기사                           |
   * | 차원 보행자         | 차원 보병                           |
   *
   * 가드 (cycle 141 reward.item / cycle 148 relic.effect baseline pattern 재사용):
   * 1. 비-system target(Korean monster name)이 모두 MONSTERS keys에 존재.
   * 2. baseline 0 lock — 새 quest 추가 시 target typo 즉시 detect.
   */

  // 시스템 stats (몬스터가 아닌 진행도 키)
  const SYSTEM_TARGETS = new Set([
      'Level', 'level',
      'abyssRecord', 'bossKills', 'bountiesCompleted', 'crafts',
      'deaths', 'demonKingSlain', 'discoveries', 'discoveryChains',
      'escapes', 'explores', 'kills', 'lowHpWins', 'maxKillStreak',
      'prestige', 'relicCount', 'rests', 'signatureSetsCompleted',
      'signaturesDiscovered', 'synths', 'total_gold',
      // 빌드 프로파일 / 직업 태그
      'arcane', 'crusher', 'dual', 'fortress',
  ]);

  const collectMissingTargets = (entries, monsterKeys) => {
      const missing = [];
      for (const e of entries) {
          const t = e?.target;
          if (typeof t !== 'string') continue;
          if (SYSTEM_TARGETS.has(t)) continue;
          if (!monsterKeys.has(t)) missing.push({ id: e.id, target: t });
      }
      return missing;
  };

  test('quest/achievement target → MONSTERS keys 정합성: missing 0건 lock', () => {
      const monsterKeys = new Set(Object.keys(MONSTERS));
      const missing = [
          ...collectMissingTargets(QUESTS, monsterKeys),
          ...collectMissingTargets(ACHIEVEMENTS, monsterKeys),
      ];
      assert.deepEqual(missing, [],
          `dead targets (no matching monster name in MONSTERS):\n  ${missing.map(m => `id=${m.id} target='${m.target}'`).join('\n  ')}`);
  });

  test('SYSTEM_TARGETS 정합: 시스템 키가 quest target에서 실제로 사용됨 (whitelist 회귀 가드)', () => {
      const allTargets = new Set();
      for (const q of QUESTS) if (typeof q.target === 'string') allTargets.add(q.target);
      for (const a of ACHIEVEMENTS) if (typeof a.target === 'string') allTargets.add(a.target);

      const unusedSystemTargets = [...SYSTEM_TARGETS].filter((t) => !allTargets.has(t));
      // unused system target이 있을 수 있음 (코드 외부 사용) — 가드는 너무 엄격하지 않게
      // 다만 "예상치 못한 unused"가 너무 많으면 의심해야 함. 절반 미만 허용.
      assert.ok(unusedSystemTargets.length < SYSTEM_TARGETS.size / 2,
          `너무 많은 SYSTEM_TARGETS가 미사용 — whitelist 정리 필요? unused=${unusedSystemTargets.length}/${SYSTEM_TARGETS.size}`);
  });
}

// ─── 원본: tests/cycle-174-quest-id-uniqueness.test.js ───
{
  /**
   * cycle 174: QUESTS / ACHIEVEMENTS id 유일성 회귀 가드.
   *
   * 발견:
   * - QUESTS에 id 99(마왕 토벌 / [심연] 혼돈 속의 생존자) / id 95([심연] 심연의 절반 /
   *   세계 탐험가) 각각 2건씩 중복 사용.
   * - quest lookup은 typically `find(q => q.id === target)` 패턴 — 첫 매치만 반환.
   *   두 번째 중복 quest는 ID로 접근 불가 → 사실상 dead content (자동 reward 청구
   *   불가 등 부수 문제).
   *
   * 수정:
   * 1. 회귀 가드 테스트 (RED 상태 — 중복 발견되면 실패).
   * 2. 중복 id 재할당 — 두 번째 항목을 max+1 신규 id로:
   *    - id 99 (혼돈 속의 생존자) → id 205.
   *    - id 95 (세계 탐험가) → id 206.
   * 3. ACHIEVEMENTS도 동일 가드 — 현재 0 dup.
   */

  test('QUESTS: id 유일성 (no duplicates)', () => {
      const idCounts = new Map();
      for (const q of QUESTS) {
          idCounts.set(q.id, (idCounts.get(q.id) || 0) + 1);
      }
      const dupes = [...idCounts.entries()].filter(([_, c]) => c > 1);
      assert.deepEqual(dupes, [],
          `duplicate quest ids:\n  ${dupes.map(([id, c]) => `id=${id} count=${c}`).join('\n  ')}`);
  });

  test('ACHIEVEMENTS: id 유일성 (no duplicates)', () => {
      const idCounts = new Map();
      for (const a of ACHIEVEMENTS) {
          idCounts.set(a.id, (idCounts.get(a.id) || 0) + 1);
      }
      const dupes = [...idCounts.entries()].filter(([_, c]) => c > 1);
      assert.deepEqual(dupes, []);
  });

  test('quest 99 / 95 — 재할당 후 새 id 205 / 206 존재 확인', () => {
      const newIds = QUESTS.filter((q) => q.id === 205 || q.id === 206);
      assert.equal(newIds.length, 2, 'cycle 174 재할당 quest 2건이 존재해야 함');

      const titles = newIds.map((q) => q.title).sort();
      // 재할당 대상: '[심연] 혼돈 속의 생존자' / '세계 탐험가'
      assert.ok(titles.includes('[심연] 혼돈 속의 생존자'));
      assert.ok(titles.includes('세계 탐험가'));
  });
}

// ─── 원본: tests/cycle-184-quest-target-spawnable-guard.test.js ───
{
  /**
   * cycle 184: quest.target 도달 가능성 가드 + 6 unreachable 퀘스트 매핑 fix.
   *
   * 발견 (cycle 164 follow-up):
   * - cycle 164는 quest target이 MONSTERS keys에 존재하는지 검사 (정합성).
   * - 그러나 monster가 MONSTERS에 등록돼도 어떤 map의 monsters[] / bossMonsters[] /
   *   boss / ABYSS_BOSS_NAMES 어디에도 안 들어가면 spawn 안 됨 → 퀘스트 진행도
   *   영원히 0 (도달 불가).
   * - 6 quests 발견 — quest 105/106/107/108/109/150이 spawn pool 미참여 monster
   *   타겟. cycle 173 baseline 보강과 같은 카테고리의 잠복 회귀.
   *
   * 수정 (perl batch):
   *
   * | Quest ID | 기존 target          | → 교체 (map-reachable)             |
   * |----------|----------------------|------------------------------------|
   * | 105      | 에테르 방랑자        | 에테르 잔류체 (에테르 폐허 monsters) |
   * | 106      | 차원의 포식자        | 차원 포식자 (공허의 회랑 monsters/boss) |
   * | 107      | 공허의 감시자        | 공허 감시병 (에테르 폐허 monsters) |
   * | 108      | 허무의 기사          | 허무 집행관 (공허의 회랑 monsters) |
   * | 109      | 에테르 심판자        | 에테르 드래곤 (에테르 관문 boss)   |
   * | 150      | 공허의 대행자        | 공허 집행관 (에테르 관문 monsters) |
   *
   * cycle 164 quest target → MONSTERS 정합성 가드와 같이 lock — 두 단계:
   * 1. monster name이 MONSTERS keys에 존재 (cycle 164).
   * 2. monster가 어떤 map의 spawn pool에 포함됨 (cycle 184, 본 사이클).
   */

  const SYSTEM_TARGETS = new Set([
      'Level', 'level', 'kills', 'explores', 'deaths', 'rests', 'crafts', 'synths',
      'bossKills', 'bountiesCompleted', 'discoveries', 'discoveryChains',
      'maxKillStreak', 'prestige', 'relicCount', 'abyssRecord', 'demonKingSlain',
      'escapes', 'signaturesDiscovered', 'signatureSetsCompleted', 'total_gold',
      'arcane', 'crusher', 'dual', 'fortress', 'lowHpWins',
  ]);

  const collectReachableMonsters = () => {
      const reachable = new Set();
      // 일반 spawn pool
      for (const mapData of Object.values(MAPS)) {
          for (const m of (mapData.monsters || [])) reachable.add(m);
          for (const m of (mapData.bossMonsters || [])) reachable.add(m);
          if (typeof mapData.boss === 'string') reachable.add(mapData.boss);
      }
      // ABYSS_BOSS_NAMES — abyss 깊이별 spawn
      for (const name of Object.values(BALANCE.ABYSS_BOSS_NAMES || {})) {
          reachable.add(name);
      }
      // hidden bosses (exploreUtils.ts 하드코딩)
      ['시간의 파수꾼', '원한의 용사', '공허의 군주'].forEach((n) => reachable.add(n));
      return reachable;
  };

  test('quest.target 도달 가능성: 모든 monster target이 spawn pool에 포함됨', () => {
      const reachable = collectReachableMonsters();
      const unreachable = [];
      for (const q of QUESTS) {
          if (typeof q.target !== 'string') continue;
          if (SYSTEM_TARGETS.has(q.target)) continue;
          if (!reachable.has(q.target)) {
              unreachable.push(`quest ${q.id} '${q.title}': '${q.target}'`);
          }
      }
      assert.deepEqual(unreachable, [],
          `unreachable quest targets:\n  ${unreachable.join('\n  ')}`);
  });

  test('cycle 184: 6 quest 매핑 명시 가드', () => {
      const findQuest = (id) => QUESTS.find((q) => q.id === id);
      assert.equal(findQuest(105)?.target, '에테르 잔류체');
      assert.equal(findQuest(106)?.target, '차원 포식자');
      assert.equal(findQuest(107)?.target, '공허 감시병');
      assert.equal(findQuest(108)?.target, '허무 집행관');
      assert.equal(findQuest(109)?.target, '에테르 드래곤');
      assert.equal(findQuest(150)?.target, '공허 집행관');
  });
}

// ─── 원본: tests/cycle-192-quest-title-reward-registration.test.js ───
{
  /**
   * cycle 192: quest reward.title 정합성 가드 + 엔드게임 칭호 3종 정식 등록.
   *
   * 발견 (cycle 175 / 185와 같은 패턴):
   * - QUESTS의 reward.title 5건 중 3건이 TITLES 미등록:
   *   - quest 152 '에테르 폐허 완전 탐험' → '에테르 탐험가'
   *   - quest 153 '공허의 회랑 정복' → '공허의 방랑자'
   *   - quest 154 '종말을 넘어서' → '종말의 정복자'
   * - 결과: getTitleDefinition undefined → color/label fallback. SystemTab에서
   *   default 색상으로 표시되던 inconsistency.
   *
   * 수정 (src/data/titles.ts):
   * - 3 endgame title을 TITLES에 정식 등록 (cycle 175/185 컨벤션 — Korean name id,
   *   cond.type='questReward'와 cond.val=questId).
   * - 색상: 에테르(cyan-200) / 공허(purple-200) / 종말(orange-300).
   *
   * 가드: QUESTS / ACHIEVEMENTS reward.title이 모두 TITLES에 등록됐는지 정합성 lock.
   *   cycle 134/138/141/148/164/165/176/178/181/184 baseline pattern 시리즈 11번째 합류.
   */

  const ENDGAME_TITLES = ['에테르 탐험가', '공허의 방랑자', '종말의 정복자'];

  test('cycle 192: 3 엔드게임 칭호 모두 TITLES 등록됨', () => {
      const ids = new Set(TITLES.map((t) => t.id));
      for (const name of ENDGAME_TITLES) {
          assert.ok(ids.has(name), `'${name}' missing from TITLES`);
      }
  });

  test('QUESTS / ACHIEVEMENTS reward.title이 모두 TITLES 등록됨 (정합성 lock)', () => {
      const ids = new Set(TITLES.map((t) => t.id));
      const names = new Set(TITLES.map((t) => t.name));
      const missing = [];
      for (const q of [...QUESTS, ...ACHIEVEMENTS]) {
          if (q.reward?.title) {
              const t = q.reward.title;
              if (!ids.has(t) && !names.has(t)) {
                  missing.push(`${q.id} '${q.title}': '${t}'`);
              }
          }
      }
      assert.deepEqual(missing, [],
          `quest title reward not in TITLES:\n  ${missing.join('\n  ')}`);
  });

  test('cycle 192: getTitleDefinition으로 endgame 칭호 lookup 가능', () => {
      const def = getTitleDefinition('에테르 탐험가');
      assert.ok(def);
      assert.equal(def.name, '에테르 탐험가');
      assert.equal(def.cond?.type, 'questReward');
      assert.match(def.color, /text-/);
  });

  test('cycle 174 회귀 가드: TITLES id 유일성 (3 endgame 추가 후에도 0 dup)', () => {
      const counts = new Map();
      for (const t of TITLES) counts.set(t.id, (counts.get(t.id) || 0) + 1);
      const dupes = [...counts.entries()].filter(([_, c]) => c > 1);
      assert.deepEqual(dupes, []);
  });
}

// ─── 원본: tests/cycle-209-quest-reward-title-grant.test.js ───
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(__dirname, '..');

  /**
   * cycle 209: quest reward.title이 실제로 player.titles에 grant되도록 fix
   *   + 누락된 2 Korean-id TITLES 등록 (cycle 192 follow-up).
   *
   * 발견 (cycle 192 incomplete):
   * - cycle 192는 3 endgame 칭호('에테르 탐험가' / '공허의 방랑자' / '종말의 정복자')를
   *   Korean id로 TITLES에 정식 등록 — getTitleDefinition lookup 가능하도록.
   * - 그러나 claimQuestReward(useInventoryActions.ts:263+) 핸들러는 reward.gold / exp /
   *   item만 처리하고 reward.title 미처리. checkTitles에도 'questReward' cond.type
   *   handler 없음 → 모든 5 quest reward title이 player.titles에 grant 안 됨 (dead grant).
   * - cycle 192가 TITLES 등록만 하고 grant 경로는 미수리한 incomplete fix.
   *
   * 추가 발견:
   * - 5 quest reward titles 중 2건('지도 제작자' / '전설의 기록자')은 cycle 192 등록도 안 됨:
   *   · quest 201 '지도 완성가' → '지도 제작자' (cartographer 영문 id의 name과 동일)
   *   · quest 202 '전설 기록자' → '전설의 기록자' (legend_chronicler 영문 id의 name과 동일)
   * - cycle 192 baseline 가드는 'TITLES.id 또는 .name 매칭'으로 통과시켰으나, 실제 grant
   *   경로는 .id 기준이라 visual lookup fail.
   *
   * 수정:
   * 1. src/hooks/useInventoryActions.ts claimQuestReward:
   *    - qData.reward?.title 있을 때 player.titles에 push (이미 있으면 skip).
   *    - emitUnlockedTitles 호출 전에 적용 (TITLES 등록 entry 자동 인식 + visual lookup 통합).
   * 2. src/data/titles.ts:
   *    - '지도 제작자' / '전설의 기록자' Korean-id entry 추가 (cycle 192 패턴 동일,
   *      cond.type='questReward', cond.val=201/202).
   *    - 기존 cartographer / legend_chronicler 영문-id entry 유지 (checkTitles auto-grant
   *      파이프라인은 그대로).
   */

  test('cycle 209: TITLES에 지도 제작자 Korean-id entry 등록됨', () => {
      const ids = new Set(TITLES.map((t) => t.id));
      assert.ok(ids.has('지도 제작자'), `'지도 제작자' Korean id missing from TITLES`);
  });

  test('cycle 209: TITLES에 전설의 기록자 Korean-id entry 등록됨', () => {
      const ids = new Set(TITLES.map((t) => t.id));
      assert.ok(ids.has('전설의 기록자'), `'전설의 기록자' Korean id missing from TITLES`);
  });

  test('cycle 209: getTitleDefinition으로 2 신규 Korean 토큰 lookup 성공', () => {
      const def1 = getTitleDefinition('지도 제작자');
      assert.ok(def1, `'지도 제작자' lookup must succeed`);
      assert.equal(def1.cond?.type, 'questReward');
      assert.equal(def1.cond?.val, 201);

      const def2 = getTitleDefinition('전설의 기록자');
      assert.ok(def2, `'전설의 기록자' lookup must succeed`);
      assert.equal(def2.cond?.type, 'questReward');
      assert.equal(def2.cond?.val, 202);
  });

  test('cycle 209: 5 quest reward.title 모두 TITLES.id에 등록 (정합성 lock — id 기준)', () => {
      const ids = new Set(TITLES.map((t) => t.id));
      const missing = [];
      for (const q of QUESTS) {
          if (q.reward?.title) {
              if (!ids.has(q.reward.title)) {
                  missing.push(`${q.id} '${q.title}': '${q.reward.title}'`);
              }
          }
      }
      assert.deepEqual(missing, [], `quest reward.title이 모두 TITLES.id로 등록되어야 grant 후 visual lookup 정합:\n  ${missing.join('\n  ')}`);
  });

  test('cycle 209: claimQuestReward가 reward.title을 player.titles에 push (코드 패턴 가드)', () => {
      const file = path.join(ROOT, 'src/hooks/useInventoryActions.ts');
      const content = fs.readFileSync(file, 'utf-8');
      // claimQuestReward 함수 내에서 reward.title 처리 패턴 존재 확인
      assert.match(
          content,
          /qData\.reward[?\.]+title/,
          'claimQuestReward에 qData.reward?.title 처리 코드 필요',
      );
      // titles 배열에 push하는 패턴
      assert.match(
          content,
          /titles:\s*\[\s*\.\.\.new\s+Set\(\s*\[\s*\.\.\.[\s\S]+title/,
          'reward.title을 titles 배열에 push (Set으로 dedup)하는 패턴 필요',
      );
  });

  test('cycle 192/197 회귀 가드: 기존 등록 칭호 유지', () => {
      const ids = new Set(TITLES.map((t) => t.id));
      // cycle 192
      assert.ok(ids.has('에테르 탐험가'));
      assert.ok(ids.has('공허의 방랑자'));
      assert.ok(ids.has('종말의 정복자'));
      // cycle 197 PRESTIGE_TITLES 일부
      assert.ok(ids.has('각성자'));
      assert.ok(ids.has('초월자'));
  });

  test('cycle 174 회귀 가드: TITLES id 유일성 (2 신규 추가 후에도 0 dup)', () => {
      const counts = new Map();
      for (const t of TITLES) counts.set(t.id, (counts.get(t.id) || 0) + 1);
      const dupes = [...counts.entries()].filter(([_, c]) => c > 1);
      assert.deepEqual(dupes, []);
  });
}

// ─── 원본: tests/cycle-260-quest-reward-title-fallback.test.js ───
{
  /**
   * cycle 260: questReward title checkTitles fallback handler 누락 dead config
   *   (cycle 222-259 silent dead config 시리즈 31번째).
   *
   * 발견 (cycle 199 prestigeRank / cycle 201 seasonTier paired pattern):
   * - src/utils/gameUtils.ts checkTitles는 cycle 199에서 'prestigeRank', cycle 201에서
   *   'seasonTier' fallback handler 추가 — 저장 손실 / 마이그레이션 등 복구 케이스 보호.
   * - 그러나 cond.type='questReward' 5종 ('에테르 탐험가' 152, '공허의 방랑자' 153,
   *   '종말의 정복자' 154, '지도 제작자' 201, '전설의 기록자' 202) — claimQuestReward가 직접
   *   grant하지만 checkTitles에 fallback 없음.
   * - 결과: 저장 데이터에서 player.titles는 손실되지만 quest는 완료된 케이스 → 영원히
   *   해당 칭호 복구 불가. 동일 패턴 prestigeRank / seasonTier는 보호.
   *
   * 추가 인프라 필요:
   * - stats.claimedQuestIds: number[] — 완료된 quest id 영구 추적 (RUN-wide multi-run
   *   ledger). cycle 202 claimedAchievements 패턴 동일.
   *
   * 패턴 (cycle 222-259 silent dead config 시리즈 31번째):
   * - cycle 199: prestigeRank checkTitles fallback.
   * - cycle 201: seasonTier checkTitles fallback.
   * - cycle 260: questReward checkTitles fallback (paired completion).
   *
   * 수정:
   * 1) src/reducers/gameReducer.ts INITIAL_STATE.player.stats: claimedQuestIds: [] 추가.
   * 2) src/hooks/useInventoryActions.ts completeQuest: stats.claimedQuestIds에 qId push.
   * 3) src/utils/gameUtils.ts checkTitles: 'questReward' fallback 추가.
   * 4) src/utils/gameUtils.ts migrateData: target.stats.claimedQuestIds 정규화.
   * 5) src/reducers/handlers/progressionHandlers.ts ASCEND + RESET_GAME: claimedQuestIds 보존
   *    (cycle 202 claimedAchievements 패턴).
   *
   * 회귀 가드:
   * - 기존 prestigeRank / seasonTier fallback 동작 유지.
   * - claimedQuestIds 미정의 saved data → migrateData가 [] 정규화 (회귀 가드).
   * - completeQuest 기존 동작 (가드/보상 grant) 변화 없음.
   */

  test('cycle 260: INITIAL_STATE.player.stats.claimedQuestIds 정의 + 빈 배열', async () => {
      const { INITIAL_STATE } = await import('../src/reducers/gameReducer.js');
      assert.ok(Array.isArray(INITIAL_STATE.player.stats?.claimedQuestIds),
          'claimedQuestIds 배열 정의되어야 함');
      assert.equal(INITIAL_STATE.player.stats.claimedQuestIds.length, 0,
          '초기값 빈 배열');
  });

  test('cycle 260: checkTitles questReward fallback — claimedQuestIds 매칭', async () => {
      const { checkTitles } = await import('../src/utils/gameUtils.js');
      // questReward val=152 ('에테르 탐험가') — claimedQuestIds에 152 있으면 unlock 후보로 잡힘.
      const player = {
          titles: [],
          level: 30,
          meta: {},
          stats: {
              kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
              relicCount: 0, abyssFloor: 0, abyssRecord: 0,
              escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
              visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
              killRegistry: {}, codex: {}, codexClaimed: [], cosmeticTitles: [],
              synthProtects: 0, claimedAchievements: [], buildWins: {},
              codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
              signaturePity: 0, bountyIssued: false, dailyProtocol: null,
              dailyInvadeCount: 0, lastInvadeDate: null,
              // questReward val=152 trigger.
              claimedQuestIds: [152],
              bountiesCompleted: 0,
          },
      };
      const newTitles = checkTitles(player);
      // '에테르 탐험가' (id=에테르 탐험가, cond { type: 'questReward', val: 152 })가 unlock 가능.
      assert.ok(newTitles.includes('에테르 탐험가'),
          `'에테르 탐험가' fallback unlock (실제: ${newTitles.join(',')})`);
  });

  test('cycle 260: claimedQuestIds에 없는 quest는 fallback 미발동 (회귀 가드)', async () => {
      const { checkTitles } = await import('../src/utils/gameUtils.js');
      const player = {
          titles: [],
          level: 30,
          meta: {},
          stats: {
              kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
              relicCount: 0, abyssFloor: 0, abyssRecord: 0,
              escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
              visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
              killRegistry: {}, codex: {}, codexClaimed: [], cosmeticTitles: [],
              synthProtects: 0, claimedAchievements: [], buildWins: {},
              codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
              signaturePity: 0, bountyIssued: false, dailyProtocol: null,
              dailyInvadeCount: 0, lastInvadeDate: null,
              claimedQuestIds: [],
              bountiesCompleted: 0,
          },
      };
      const newTitles = checkTitles(player);
      assert.ok(!newTitles.includes('에테르 탐험가'),
          `claimedQuestIds 비어있으면 questReward fallback 미발동 (회귀 가드)`);
      assert.ok(!newTitles.includes('지도 제작자'),
          `'지도 제작자' (questReward 201) 미발동`);
  });

  test('cycle 260: cycle 199/201 fallback 회귀 가드 — prestigeRank / seasonTier 동작 유지', async () => {
      const { checkTitles } = await import('../src/utils/gameUtils.js');
      // prestigeRank 1 → '각성자' (val: 1) unlock.
      const player = {
          titles: [],
          level: 30,
          meta: { prestigeRank: 1 },
          stats: {
              kills: 0, bossKills: 0, deaths: 0, total_gold: 0, rests: 0,
              relicCount: 0, abyssFloor: 0, abyssRecord: 0,
              escapes: 0, syntheses: 0, maxKillStreak: 0, explores: 0, crafts: 0,
              visitedMaps: [], discoveryChains: [], demonKingSlain: 0,
              killRegistry: {}, codex: {}, codexClaimed: [], cosmeticTitles: [],
              synthProtects: 0, claimedAchievements: [], buildWins: {},
              codexBonusAtk: 0, codexBonusDef: 0, codexBonusHp: 0,
              signaturePity: 0, bountyIssued: false, dailyProtocol: null,
              dailyInvadeCount: 0, lastInvadeDate: null,
              claimedQuestIds: [],
              bountiesCompleted: 0,
          },
          seasonPass: { tier: 10 },
      };
      const newTitles = checkTitles(player);
      assert.ok(newTitles.includes('각성자'), 'cycle 199 prestigeRank 회귀 가드');
      assert.ok(newTitles.includes('시즌 선구자'), 'cycle 201 seasonTier 회귀 가드');
  });

  test('cycle 260: migrateData claimedQuestIds 정규화 (회귀 가드)', async () => {
      const { migrateData } = await import('../src/utils/gameUtils.js');
      // claimedQuestIds 미정의 saved data → 빈 배열로 정규화.
      const oldSave = {
          version: 1,
          player: {
              name: 'Test', job: '전사', level: 1, hp: 100, maxHp: 100, mp: 50, maxMp: 50,
              atk: 10, def: 5, gold: 100, exp: 0, inv: [], equip: {}, relics: [],
              titles: [], history: [], skillChoices: {}, combatFlags: {},
              stats: { kills: 0 },  // claimedQuestIds 없음.
              quests: [],
          },
      };
      const migrated = migrateData(oldSave);
      assert.ok(Array.isArray(migrated.player.stats?.claimedQuestIds),
          `migrateData가 claimedQuestIds 빈 배열 정규화`);
  });
}

// ─── 원본: tests/cycle-272-quest-complete-story-dispatch.test.js ───
{
  /**
   * cycle 272: aiService 'questComplete' 스토리 템플릿 dispatch 누락 dead config
   *   (cycle 222-271 silent dead config 시리즈 43번째).
   *
   * 발견 (story 템플릿 4 dead 중 1건 paired completion):
   * - src/services/aiService.ts getFallback 8 스토리 템플릿:
   *   encounter / victory / death / rest (활성) + levelUp / bossPhase2 / questComplete /
   *   ruinRecap (모두 dispatch 0건).
   * - addStoryLog 사용 4건 (encounter/victory/death/rest)만 매칭, 나머지 4 템플릿은 dead.
   * - completeQuest는 quest_complete 사운드는 재생하지만 addStoryLog 미호출 → AI narrative
   *   blurb 부재. quest 보상 모먼트가 sound만 있고 narrative 없음.
   *
   * 패턴 (cycle 222-271 silent dead config 시리즈 43번째):
   * - cycle 217-220: SoundManager 미사용 사운드 dispatch.
   * - cycle 261: claim 액션 sensory cue paired completion.
   * - cycle 272: addStoryLog 'questComplete' 템플릿 dispatch.
   *
   * 수정:
   * 1) src/hooks/useInventoryActions.ts createInventoryActions:
   *    - deps에서 addStoryLog 추가 추출.
   *    - completeQuest 마지막에 addStoryLog('questComplete', { questTitle: qData.title }) 호출.
   * 2) src/hooks/useGameEngine.ts: addStoryLog가 deps로 이미 전달되고 있으므로 변화 없음.
   *
   * 회귀 가드:
   * - 기존 quest_complete 사운드 dispatch 유지.
   * - quest 보상 grant / addLog 동작 변화 없음.
   * - aiService 다른 템플릿 dispatch 동작 유지 (encounter/victory/death/rest).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 272: createInventoryActions deps에서 addStoryLog 추출', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      // deps destructuring 패턴 — { ..., addStoryLog, ... }.
      assert.ok(/createInventoryActions = \(\{[^}]*addStoryLog/.test(source),
          'createInventoryActions가 addStoryLog deps 추출');
  });

  test('cycle 272: completeQuest가 addStoryLog("questComplete", ...) 호출', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      // completeQuest 함수 내에 addStoryLog('questComplete', ...) 패턴.
      // completeQuest 함수 본문 — 다음 함수 'claimAchievement' 직전까지.
      const fnMatch = source.match(/completeQuest:[\s\S]+?claimAchievement:/);
      assert.ok(fnMatch, 'completeQuest 정의 발견');
      assert.ok(/addStoryLog\(['"]questComplete['"]/.test(fnMatch[0]),
          "completeQuest 내부에 addStoryLog('questComplete', ...) 호출");
  });

  test('cycle 272: addStoryLog questComplete payload에 questTitle 포함', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      // completeQuest 함수 본문 — 다음 함수 'claimAchievement' 직전까지.
      const fnMatch = source.match(/completeQuest:[\s\S]+?claimAchievement:/);
      assert.ok(fnMatch);
      assert.ok(/addStoryLog\(['"]questComplete['"]\s*,\s*\{[\s\S]{0,100}?questTitle/.test(fnMatch[0]),
          'questTitle 포함된 payload (template "${data.questTitle}" 정합)');
  });

  test('cycle 272: aiService questComplete 템플릿 정의 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/services/aiService.ts');
      assert.ok(/questComplete:[\s\S]{0,200}questTitle/.test(source),
          'aiService questComplete 템플릿 유지');
  });

  test('cycle 272: 기존 quest_complete 사운드 dispatch 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/hooks/useInventoryActions.ts');
      // completeQuest 함수 본문 — 다음 함수 'claimAchievement' 직전까지.
      const fnMatch = source.match(/completeQuest:[\s\S]+?claimAchievement:/);
      assert.ok(fnMatch);
      assert.ok(/soundManager\.play\(['"]quest_complete['"]\)/.test(fnMatch[0]),
          'cycle 122 quest_complete 사운드 dispatch 유지');
  });
}

// ─── 원본: tests/cycle-313-quest-reward-chips-private.test.js ───
{
  /**
   * cycle 313: QuestRewardChips export → private downgrade
   *   (cycle 222-312 silent dead config 시리즈 83번째 — cleanup lens 연속).
   *
   * 발견 (private downgrade 후보):
   * - src/components/tabs/QuestTab.tsx:30 QuestRewardChips export.
   *   동일 파일 line 349에서 1회 JSX render. 외부 import 0건.
   *
   * 패턴 (cycle 222-312 silent dead config 시리즈 83번째):
   * - cycle 312: anchorPoints WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS private.
   * - cycle 313: QuestTab 내부 컴포넌트 private downgrade.
   *
   * 수정 (src/components/tabs/QuestTab.tsx):
   * - QuestRewardChips export 제거 (private const 유지).
   *
   * 회귀 가드:
   * - QuestTab default export 그대로.
   * - JSX render line 349 동작 동일 (같은 모듈 스코프).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 313: QuestRewardChips export 제거 (private)', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(!/export const QuestRewardChips\b/.test(source),
          'QuestRewardChips export 제거됨');
      assert.ok(/const QuestRewardChips\b/.test(source),
          'QuestRewardChips const 정의 유지 (private)');
  });

  test('cycle 313: QuestRewardChips JSX render 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(/<QuestRewardChips\b/.test(source),
          'QuestRewardChips JSX render 보존');
  });

  test('cycle 313: QuestTab default export 유지', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(/export default/.test(source),
          'QuestTab default export 유지');
  });

  test('cycle 312 회귀 가드: anchorPoints 2 placement private 유지', async () => {
      const source = await readSrc('src/utils/anchorPoints.ts');
      assert.ok(!/export const WEAPON_PLACEMENTS\b/.test(source),
          'cycle 312 WEAPON_PLACEMENTS private 유지');
      assert.ok(!/export const OFFHAND_PLACEMENTS\b/.test(source),
          'cycle 312 OFFHAND_PLACEMENTS private 유지');
  });
}

// ─── 원본: tests/cycle-334-quest-tracker-forecast-dead-fields.test.js ───
{
  /**
   * cycle 334: getQuestTracker.detail + getExplorationForecast.description dead 필드 제거
   *   (cycle 222-333 silent dead config 시리즈 103번째 — cleanup lens 연속).
   *
   * 발견 (dead output fields):
   * - getQuestTracker 반환에 `detail` 필드 (claimable: '보상을 수령할 수 있습니다.',
   *   active: focus.quest.desc) — src/, tests/ 어디에서도 read 0건.
   * - getExplorationForecast 반환에 `description` 필드 (6 분기별 설명 문자열) —
   *   src/, tests/ 어디에서도 read 0건. mood / chips만 사용.
   *
   * 패턴 (cycle 222-333 silent dead config 시리즈 103번째):
   * - cycle 333: getMoveRecommendations 4 dead 출력 필드 정리.
   * - cycle 334: getQuestTracker / getExplorationForecast dead description 제거.
   *
   * 수정 (src/utils/adventureGuide.ts):
   * - getQuestTracker: 두 return 분기에서 detail 필드 제거.
   * - getExplorationForecast: 4 return 분기에서 description 필드 제거 + 분기별
   *   description 변수 할당 라인 정리.
   *
   * 회귀 가드:
   * - getQuestTracker: kind / title / progressLabel / questId 필드 보존.
   * - getExplorationForecast: mood / chips 필드 보존.
   * - 기존 test (adventure-guide.test) 영향 없음 (mood / chips만 검증).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 334: getQuestTracker detail 필드 제거', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      // getQuestTracker 함수 블록 추출 후 detail 필드 0건.
      const fn = source.slice(source.indexOf('export const getQuestTracker'), source.indexOf('export const getExplorationForecast'));
      assert.ok(!/detail:/.test(fn),
          'getQuestTracker에서 detail 필드 제거됨');
  });

  test('cycle 334: getExplorationForecast description 필드 제거', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      const fn = source.slice(source.indexOf('export const getExplorationForecast'), source.indexOf('export const getMoveRecommendations'));
      assert.ok(!/description:/.test(fn),
          'getExplorationForecast에서 description 필드 제거됨');
      assert.ok(!/let description =/.test(fn),
          'description 변수 할당 라인 제거됨');
  });

  test('cycle 334: getQuestTracker 동작 보존 (kind/title/progressLabel/questId)', async () => {
      const { getQuestTracker } = await import('../src/utils/adventureGuide.js');
      const player = {
          quests: [{ id: 1, progress: 0, isBounty: false }],
      };
      const tracker = getQuestTracker(player);
      if (tracker) {
          assert.ok('kind' in tracker, 'kind 보존');
          assert.ok('title' in tracker, 'title 보존');
          assert.ok('progressLabel' in tracker, 'progressLabel 보존');
          assert.equal(tracker.detail, undefined, 'detail 필드 0건');
      }
  });

  test('cycle 334: getExplorationForecast 동작 보존 (mood/chips)', async () => {
      const { getExplorationForecast } = await import('../src/utils/adventureGuide.js');
      const forecast = getExplorationForecast({}, null);
      assert.ok('mood' in forecast, 'mood 보존');
      assert.ok(Array.isArray(forecast.chips), 'chips array 보존');
      assert.equal(forecast.description, undefined, 'description 필드 0건');
  });

  test('cycle 333 회귀 가드: getMoveRecommendations dead 필드 0건 유지', async () => {
      const source = await readSrc('src/utils/adventureGuide.ts');
      assert.ok(/_sortKey/.test(source), 'cycle 333 _sortKey 유지');
  });
}

// ─── 원본: tests/cycle-347-quest-board-score-dead.test.js ───
{
  /**
   * cycle 347: scoreQuest score 출력 dead 정리 (_sortKey internal로 변경)
   *   (cycle 222-346 silent dead config 시리즈 115번째 — cleanup lens 연속).
   *
   * 발견 (dead output field):
   * - scoreQuest 반환에 score 필드 — 정렬 (line 163) 외 외부 read 0건.
   * - QuestBoardPanel은 entry.lane / entry.meta / entry.reason / entry.resonance /
   *   entry.targetMaps만 read.
   *
   * 패턴 (cycle 222-346 silent dead config 시리즈 115번째):
   * - cycle 346: getJobOutfitAffinity totalSlots 출력 dead.
   * - cycle 347: scoreQuest score → _sortKey internal로 변경 (cycle 333 패턴 동일).
   *
   * 수정 (src/utils/questOperations.ts):
   * - scoreQuest 반환에서 score → _sortKey internal-only.
   * - getQuestBoardRecommendations 정렬 후 strip 단계 추가.
   *
   * 회귀 가드:
   * - quest / lane / resonance / targetMaps / meta / reason 활성 필드 보존.
   * - 정렬 순서 동일 (점수 내림차순, 동점 시 quest.title 한국어 정렬).
   * - QuestBoardPanel / adventureGuide.featured[0] 동일 동작.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 347: scoreQuest score → _sortKey 변경', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      // scoreQuest 반환에 _sortKey 도입.
      assert.ok(/_sortKey: score/.test(source),
          '_sortKey internal-only 도입');
  });

  test('cycle 347: getQuestBoardRecommendations 정렬 후 strip', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      assert.ok(/right\._sortKey - left\._sortKey/.test(source),
          '_sortKey 기준 정렬');
      assert.ok(/const \{ _sortKey, \.\.\.exposed \}/.test(source),
          '_sortKey strip 패턴');
  });

  test('cycle 347: getQuestBoardRecommendations 동작 보존', async () => {
      const { getQuestBoardRecommendations } = await import('../src/utils/questOperations.js');
      const player = { job: '검사', level: 5, hp: 100, maxHp: 100, mp: 50, maxMp: 50, equip: {}, relics: [], stats: {}, quests: [] };
      const board = getQuestBoardRecommendations(player);
      assert.ok(Array.isArray(board.featured), 'featured array');
      assert.ok(Array.isArray(board.backlog), 'backlog array');
      // featured / backlog 항목에 score 외부 노출 0건.
      if (board.featured.length > 0) {
          assert.equal(board.featured[0].score, undefined, 'featured[0].score 0건');
          assert.equal(board.featured[0]._sortKey, undefined, 'featured[0]._sortKey strip');
          assert.ok('lane' in board.featured[0], 'lane 보존');
          assert.ok('meta' in board.featured[0], 'meta 보존');
      }
  });

  test('cycle 346 회귀 가드: getJobOutfitAffinity totalSlots 0건 보존', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      const fn = source.slice(source.indexOf('export const getJobOutfitAffinity'));
      assert.ok(!/totalSlots:/.test(fn),
          'cycle 346 totalSlots 0건 보존');
  });
}

// ─── 원본: tests/cycle-429-quest-reward-chips-default-accent-redundant.test.js ───
{
  /**
   * cycle 429: QuestTab QuestRewardChips default `accent = 'blue'` redundant 정리
   *   (cycle 222-428 silent dead config 시리즈 189번째 — redundant default annotation
   *   lens 회귀, cycle 364-368 패턴 + cycle 428 paired completion).
   *
   * 발견 (1 redundant default value):
   * - src/components/tabs/QuestTab.tsx QuestRewardChips:
   *     `({ reward, accent = 'blue' }: any) => { ... }`
   * - 호출 사이트 분석 (1곳, accent 명시 전달):
   *     line 350: `<QuestRewardChips reward={...} accent={isComplete ? 'green' : isBounty ? 'amber' : 'blue'} />`
   *   → 호출자가 ternary로 accent 명시 → default 'blue'는 도달 불가.
   *
   * 패턴 (cycle 222-428 시리즈 189번째):
   * - cycle 364-368 시리즈: redundant default annotation.
   * - cycle 428: QuestBoardPanel RewardChips default accent 'blue' 제거.
   * - cycle 429: QuestTab QuestRewardChips 동일 패턴 — paired completion.
   *
   * 수정 (src/components/tabs/QuestTab.tsx):
   * - destructure에서 default 값 제거 → `({ reward, accent }: any) =>`.
   *
   * 회귀 가드:
   * - 1 호출자 명시 accent 전달 → 동작 그대로.
   * - ternary 분기 (green/amber/else fallback) 그대로 활성.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 429: QuestRewardChips destructure에서 default accent 값 제거", async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      const fnIdx = source.indexOf('const QuestRewardChips');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/accent = 'blue'/.test(block),
          "QuestRewardChips destructure default 제거됨");
      assert.ok(/\{ reward, accent \}/.test(block),
          'destructure에서 accent 파라미터 보존');
  });

  test('cycle 429: 호출 사이트 accent 명시 전달 (정합성 가드)', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      const callMatches = source.match(/<QuestRewardChips[^>]*\/?>/g) || [];
      assert.ok(callMatches.length >= 1, 'QuestRewardChips 호출 1건 이상');
      for (const call of callMatches) {
          assert.ok(/accent=/.test(call),
              `호출에 accent 명시 전달`);
      }
  });

  test('cycle 429: ternary 분기 (green/amber/blue fallback) 보존', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      const fnIdx = source.indexOf('const QuestRewardChips');
      const fnEnd = source.indexOf('};', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(/accent === 'green'/.test(block), 'green 분기 보존');
      assert.ok(/accent === 'amber'/.test(block), 'amber 분기 보존');
      assert.ok(/border-cyber-blue/.test(block), 'blue fallback 클래스 보존');
  });

  test('cycle 428 회귀 가드: QuestBoardPanel RewardChips default accent 0건', async () => {
      const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      const fnIdx = source.indexOf('const RewardChips');
      const fnEnd = source.indexOf('=>', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/accent = 'blue'/.test(block),
          "cycle 428 RewardChips default 제거 보존");
  });
}

// ─── 원본: tests/cycle-481-quest-tab-compact-cascade.test.js ───
{
  /**
   * cycle 481: QuestTab `compact` prop cascade unreachable 정리
   *   (cycle 222-480 silent dead config 시리즈 233번째 — unreachable code path
   *   cascade cleanup, cycle 471-479 paired 10사이클).
   *
   * 발견 (1 prop + 1 state + 3 const + 33 ternary 가지 + multiple conditional UI 블록 dead):
   * - src/components/tabs/QuestTab.tsx:
   *     · interface compact?: boolean.
   *     · destructure compact = false.
   *     · useState(false) showAllQuests + setShowAllQuests.
   *     · visibleQuestEntries IIFE (compact && !showAllQuests 가지).
   *     · hiddenQuestCount const.
   *     · useQuestSummaryCards const.
   *     · 본체 33 ternary (mostly className compact ? 'tight' : 'loose').
   *     · `compact && !showAllQuests ? <summary-card> : <full-card>` Daily Protocol 분기.
   *     · {compact && (hidden... || showAll...)} 토글 헤더 블록.
   * - 호출 사이트:
   *     · Dashboard.tsx:176 — cycle 471이 compact prop 제거. caller 0건.
   * - 결과: compact 항상 undefined → cascade 전체 unreachable.
   *
   * cycle 471 → 472-479 (8사이클 cascade) → 480 milestone → 481 cascade 10사이클 paired.
   *
   * 수정 (src/components/tabs/QuestTab.tsx):
   * - interface compact 제거.
   * - destructure compact = false 제거.
   * - useState showAllQuests + setShowAllQuests 제거.
   * - visibleQuestEntries / hiddenQuestCount / useQuestSummaryCards 제거.
   * - 33 ternary 모두 false 가지로 inline.
   * - Daily Protocol summary-card 가지 제거 (false 가지 full-card만 유지).
   * - 토글 헤더 블록 제거.
   * - 본체에서 visibleQuestEntries → activeQuestEntries 직접 사용.
   *
   * 회귀 가드:
   * - player / actions / isInSafeZone prop 보존.
   * - 본체 quest list / Daily Protocol / Weekly Protocol / discovery chains 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 481: QuestTab destructure에서 compact 0건', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      const fnIdx = source.indexOf('const QuestTab =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
  });

  test('cycle 481: interface에서 compact 0건', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      const ifaceIdx = source.indexOf('interface QuestTabProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/\bcompact\b/.test(block), 'interface에 compact 0건');
  });

  test('cycle 481: cascade dead 0건', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(!/showAllQuests/.test(source), 'showAllQuests 0건');
      assert.ok(!/hiddenQuestCount/.test(source), 'hiddenQuestCount 0건');
      assert.ok(!/useQuestSummaryCards/.test(source), 'useQuestSummaryCards 0건');
      assert.ok(!/visibleQuestEntries/.test(source), 'visibleQuestEntries 0건');
  });

  test('cycle 481: 본체 compact 참조 0건', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건');
  });

  test('cycle 481: 정합성 가드 — Dashboard <QuestTab> compact 전달 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const idx = source.indexOf('<QuestTab');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <QuestTab> compact 전달 0건');
  });

  test('cycle 481: player / actions / isInSafeZone / activeQuestEntries 보존', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(/activeQuestEntries/.test(source), 'activeQuestEntries 보존');
      assert.ok(/dpMissions/.test(source), 'dpMissions 보존');
      assert.ok(/weeklyMissions/.test(source), 'weeklyMissions 보존');
      const fnIdx = source.indexOf('const QuestTab =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
      assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
      assert.ok(/isInSafeZone/.test(sig), 'isInSafeZone prop 보존');
  });
}

// ─── 원본: tests/cycle-487-quest-board-panel-mobile-focused-cascade.test.js ───
{
  /**
   * cycle 487: QuestBoardPanel `mobileFocused` cascade unreachable 정리
   *   (cycle 222-486 silent dead config 시리즈 239번째 — unreachable code path
   *   cascade cleanup, cycle 486 paired completion).
   *
   * 발견 (1 prop + 2 ternary 가지 unreachable, 1 ternary 두 가지 동일):
   * - src/components/tabs/QuestBoardPanel.tsx:
   *     · interface mobileFocused?: boolean.
   *     · destructure mobileFocused = false.
   *     · line 81: `mobileFocused ? <mobile-class> : <non-mobile-class>` —
   *       non-mobile branch unreachable.
   *     · line 90: `bleedClassName={mobileFocused ? '-mx-4 px-4' : '-mx-4 px-4'}` —
   *       두 가지 IDENTICAL → ternary 자체가 dead.
   * - 호출 사이트:
   *     · ControlPanel.tsx:204 — mobileFocused={mobileFocused} 전달.
   *     · ControlPanel은 MobileGameLayout (cycle 486 분석)에서 항상 mobileFocused
   *       =true 받으므로 forward도 항상 true.
   *     · 다른 파일 import 0건.
   * - 결과: mobileFocused 항상 true → ternary 첫 가지만 진입.
   *
   * 패턴 (cycle 222-486 시리즈 239번째):
   * - cycle 486: ControlPanel mobileFocused cascade.
   * - cycle 487: QuestBoardPanel — paired completion (subchild cascade).
   *
   * 수정 (src/components/tabs/QuestBoardPanel.tsx):
   * - interface mobileFocused 제거.
   * - destructure mobileFocused = false 제거.
   * - line 81 ternary → mobile-class 가지만 inline.
   * - line 90 identical-branches ternary → 정적 '-mx-4 px-4'.
   *
   * 호출 사이트 (ControlPanel.tsx:204):
   * - mobileFocused 전달 자체 제거.
   *
   * 회귀 가드:
   * - player / actions / setGameState / onOpenArchiveConsole prop 보존.
   * - 본체 quest list / bounty / Mission Terminal UI 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 487: QuestBoardPanel destructure에서 mobileFocused 0건', async () => {
      const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      const fnIdx = source.indexOf('const QuestBoardPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/mobileFocused/.test(sig), 'destructure에 mobileFocused 0건');
  });

  test('cycle 487: interface에서 mobileFocused 0건', async () => {
      const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      const ifaceIdx = source.indexOf('interface QuestBoardPanelProps');
      const ifaceEnd = source.indexOf('}', ifaceIdx);
      const block = source.slice(ifaceIdx, ifaceEnd);
      assert.ok(!/mobileFocused/.test(block), 'interface에 mobileFocused 0건');
  });

  test('cycle 487: 본체에서 mobileFocused 참조 0건', async () => {
      const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      assert.ok(!/mobileFocused/.test(source), 'mobileFocused 참조 0건');
  });

  test('cycle 487: 정합성 가드 — ControlPanel <QuestBoardPanel> mobileFocused 전달 0건', async () => {
      const source = await readSrc('src/components/ControlPanel.tsx');
      const idx = source.indexOf('<QuestBoardPanel');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/mobileFocused/.test(jsx), 'ControlPanel <QuestBoardPanel> mobileFocused 전달 0건');
  });

  test('cycle 487: player / actions / setGameState / onOpenArchiveConsole prop 보존', async () => {
      const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      const fnIdx = source.indexOf('const QuestBoardPanel =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
      assert.ok(/\bactions\b/.test(sig), 'actions prop 보존');
      assert.ok(/setGameState/.test(sig), 'setGameState prop 보존');
      assert.ok(/onOpenArchiveConsole/.test(sig), 'onOpenArchiveConsole prop 보존');
  });
}

// ─── 원본: tests/cycle-508-sync-quest-progress-defaults-unreachable.test.js ───
{
  /**
   * cycle 508: syncQuestProgress 2 defaults unreachable batch
   *   (cycle 222-507 silent dead config 시리즈 258번째 — redundant default annotation
   *   util-level batch, util default 청소 메가 시리즈 7번째).
   *
   * 발견 (2 default unreachable):
   * - src/utils/questProgress.ts (line 10):
   *     export const syncQuestProgress = (player: Player, enemyName: any = '',
   *         questCatalog: any = QUESTS) => {...}
   * - 호출 사이트 (1 callsite):
   *     · CombatEngine.ts:1571 — syncQuestProgress(player, enemyName, DB.QUESTS).
   *     · 1 callsite, 3 args 명시 전달.
   *     · 다른 파일 import 0건.
   * - 결과: 2 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-507 시리즈 258번째):
   * - cycle 502-507: util default 청소 메가 시리즈.
   * - cycle 508: syncQuestProgress 2 defaults batch — 동일 lens.
   *
   * 수정 (src/utils/questProgress.ts):
   * - signature에서 enemyName: any = '' / questCatalog: any = QUESTS default 제거.
   *
   * 회귀 가드:
   * - 1 callsite 동작 그대로.
   * - body normalizedEnemyName / latch / 분기 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 508: syncQuestProgress signature defaults 0건', async () => {
      const source = await readSrc('src/utils/questProgress.ts');
      const fnIdx = source.indexOf('export const syncQuestProgress');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/enemyName:\s*any\s*=\s*''/.test(sig), 'enemyName default 제거');
      assert.ok(!/questCatalog:\s*any\s*=\s*QUESTS/.test(sig), 'questCatalog default 제거');
      assert.ok(/\benemyName\b/.test(sig), 'enemyName 파라미터 보존');
      assert.ok(/\bquestCatalog\b/.test(sig), 'questCatalog 파라미터 보존');
  });

  test('cycle 508: 정합성 가드 — CombatEngine 1 callsite 3 args', async () => {
      const source = await readSrc('src/systems/CombatEngine.ts');
      const matches = source.match(/syncQuestProgress\(/g) || [];
      assert.equal(matches.length, 1, 'syncQuestProgress 호출 1건');
      assert.ok(/syncQuestProgress\(player,\s*enemyName,\s*DB\.QUESTS\)/.test(source),
          '3 args 명시 전달 보존');
  });

  test('cycle 508: body 동작 보존 (normalizedEnemyName / latch)', async () => {
      const source = await readSrc('src/utils/questProgress.ts');
      assert.ok(/normalizedEnemyName = enemyName \|\| ''/.test(source),
          'normalizedEnemyName 보존');
      assert.ok(/const latch = /.test(source), 'latch 함수 보존');
  });

  test('cycle 508: cycle 502-507 회귀 가드 — 이전 정리 보존', async () => {
      const ep = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/getNarrativeEventChance[^=]*baseChance:\s*any\s*=\s*0/.test(ep),
          'cycle 507 getNarrativeEventChance baseChance default 0건');
  });
}

// ─── 원본: tests/cycle-523-get-quest-level-gap-player-level-default-unreachable.test.js ───
{
  /**
   * cycle 523: getQuestLevelGap `playerLevel = 1` default unreachable
   *   (cycle 222-522 silent dead config 시리즈 267번째 — redundant default annotation
   *   util-level cleanup, util default 청소 메가 시리즈 20번째).
   *
   * 발견 (1 default unreachable):
   * - src/utils/questOperations.ts (line 34):
   *     const getQuestLevelGap = (quest, playerLevel: any = 1) =>
   *         Math.abs((quest?.minLv || 1) - (playerLevel || 1));
   * - 호출 사이트 (1 callsite, 모듈 내부 private):
   *     · questOperations.ts:116 — getQuestLevelGap(quest, playerLevel)
   *       (playerLevel은 caller scoreQuest에서 player?.level || 1로 보장).
   *     · 다른 파일 import 0건 (private 모듈 helper).
   * - 결과: playerLevel 항상 명시 전달. default 1 도달 불가.
   *
   * 패턴 (cycle 222-522 시리즈 267번째):
   * - cycle 502-522: util default 청소 메가 시리즈 19사이클.
   * - cycle 523: getQuestLevelGap playerLevel — 동일 lens. cycle 519
   *   getMapLevel과 동일 패턴 (private + body의 || 1 defensive 보존).
   *
   * 수정 (src/utils/questOperations.ts):
   * - signature에서 playerLevel: any = 1 → playerLevel: any.
   * - body의 (playerLevel || 1) defensive 가드 보존.
   *
   * 회귀 가드:
   * - 1 internal callsite 동작 그대로.
   * - body Math.abs((quest?.minLv || 1) - (playerLevel || 1)) 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 523: getQuestLevelGap signature에서 playerLevel default 0건', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      const fnIdx = source.indexOf('const getQuestLevelGap');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/playerLevel:\s*any\s*=\s*1/.test(sig), 'playerLevel default 1 제거');
      assert.ok(/\bplayerLevel\b/.test(sig), 'playerLevel 파라미터 자체는 보존');
  });

  test('cycle 523: 정합성 가드 — internal callsite 보존', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      assert.ok(/getQuestLevelGap\(quest,\s*playerLevel\)/.test(source),
          'internal callsite (quest, playerLevel) 보존');
  });

  test('cycle 523: body Math.abs defensive 가드 보존', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      assert.ok(/Math\.abs\(\(quest\?\.minLv \|\| 1\) - \(playerLevel \|\| 1\)\)/.test(source),
          'Math.abs((quest?.minLv || 1) - (playerLevel || 1)) defensive guard 보존');
  });

  test('cycle 523: cycle 502-522 회귀 가드 — util default 청소 시리즈 보존', async () => {
      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/const toInt[^=]*fallback:\s*any\s*=\s*0/.test(aiu),
          'cycle 522 toInt fallback default 0건');

      const ea = await readSrc('src/utils/equipmentArt.ts');
      assert.ok(!/const hashText[^=]*value:\s*any\s*=\s*''/.test(ea),
          'cycle 521 hashText value default 0건');
  });
}

// ─── 원본: tests/cycle-541-quest-progress-helpers-defaults-cross-file-batch.test.js ───
{
  /**
   * cycle 541: getQuestProgressText + getQuestProgressPercent 4 defaults
   *   cross-file batch unreachable (cycle 222-540 silent dead config 시리즈
   *   283번째 — redundant default annotation 청소 메가 시리즈 36번째).
   *   cross-file 동일 helper 패턴 정리.
   *
   * 발견 (4 defaults batch, 2 files 같은 helper 패턴):
   * - src/components/tabs/QuestTab.tsx (line 20, 26):
   *     · getQuestProgressText (quest, progress: any = 0)
   *     · getQuestProgressPercent (progress: any = 0, goal: any = 1)
   * - src/components/tabs/QuestBoardPanel.tsx (line 17, 23):
   *     · getQuestProgressText (quest, progress: any = 0)  ← 동일 helper 중복
   *     · getQuestProgressPercent (progress: any = 0, goal: any = 1)
   *       ← 동일 helper 중복
   * - 호출 사이트 (모두 명시 전달):
   *     · QuestTab.tsx:76 — getQuestProgressPercent(entry.progress,
   *       entry.quest.goal) — 2 args 명시.
   *     · QuestTab.tsx:285 — getQuestProgressText(entry.quest, entry.progress)
   *       — 2 args 명시.
   *     · QuestBoardPanel.tsx:201 — getQuestProgressText(entry.quest,
   *       entry.progress) — 2 args 명시.
   *     · QuestBoardPanel.tsx:205 — getQuestProgressPercent(entry.progress,
   *       entry.quest.goal) — 2 args 명시.
   *     · 다른 caller 0건 (private 모듈 helper).
   * - 결과: 4 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-540 시리즈 283번째):
   * - cycle 502-540: default 청소 메가 시리즈 39사이클.
   * - cycle 541: cross-file duplicated helper batch — QuestTab과 QuestBoardPanel
   *   에 동일 helper 정의가 중복(cycle 313이 export 제거하면서 분리). 동일
   *   pattern이라 single-cycle 4-default batch.
   *
   * 수정 (양쪽 파일):
   * - getQuestProgressText signature: progress: any = 0 → progress: any.
   * - getQuestProgressPercent signature: progress / goal defaults 모두 제거.
   * - body의 Math.min/Math.max guard 보존.
   *
   * 회귀 가드:
   * - 4 internal callsite 동작 그대로.
   * - body 'Level' ternary + Math.max(0, progress) defensive 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 541: QuestTab.tsx 2 defaults 0건', async () => {
      const source = await readSrc('src/components/tabs/QuestTab.tsx');
      const txtSig = source.slice(source.indexOf('const getQuestProgressText'),
                                    source.indexOf('=>', source.indexOf('const getQuestProgressText')));
      assert.ok(!/progress:\s*any\s*=\s*0/.test(txtSig),
          'QuestTab getQuestProgressText progress default 0 제거');

      const pctSig = source.slice(source.indexOf('const getQuestProgressPercent'),
                                    source.indexOf('=>', source.indexOf('const getQuestProgressPercent')));
      assert.ok(!/progress:\s*any\s*=\s*0/.test(pctSig),
          'QuestTab getQuestProgressPercent progress default 0 제거');
      assert.ok(!/goal:\s*any\s*=\s*1/.test(pctSig),
          'QuestTab getQuestProgressPercent goal default 1 제거');
  });

  test('cycle 541: QuestBoardPanel.tsx 2 defaults 0건', async () => {
      const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      const txtSig = source.slice(source.indexOf('const getQuestProgressText'),
                                    source.indexOf('=>', source.indexOf('const getQuestProgressText')));
      assert.ok(!/progress:\s*any\s*=\s*0/.test(txtSig),
          'QuestBoardPanel getQuestProgressText progress default 0 제거');

      const pctSig = source.slice(source.indexOf('const getQuestProgressPercent'),
                                    source.indexOf('=>', source.indexOf('const getQuestProgressPercent')));
      assert.ok(!/progress:\s*any\s*=\s*0/.test(pctSig),
          'QuestBoardPanel getQuestProgressPercent progress default 0 제거');
      assert.ok(!/goal:\s*any\s*=\s*1/.test(pctSig),
          'QuestBoardPanel getQuestProgressPercent goal default 1 제거');
  });

  test('cycle 541: 정합성 가드 — 4 callsite 보존', async () => {
      const qt = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(/getQuestProgressPercent\(entry\.progress,\s*entry\.quest\.goal\)/.test(qt),
          'QuestTab getQuestProgressPercent callsite 보존');
      assert.ok(/getQuestProgressText\(entry\.quest,\s*entry\.progress\)/.test(qt),
          'QuestTab getQuestProgressText callsite 보존');

      const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      assert.ok(/getQuestProgressText\(entry\.quest,\s*entry\.progress\)/.test(qb),
          'QuestBoardPanel getQuestProgressText callsite 보존');
      assert.ok(/getQuestProgressPercent\(entry\.progress,\s*entry\.quest\.goal\)/.test(qb),
          'QuestBoardPanel getQuestProgressPercent callsite 보존');
  });

  test('cycle 541: body defensive guards 보존', async () => {
      const qt = await readSrc('src/components/tabs/QuestTab.tsx');
      assert.ok(/Math\.min\(100,\s*\(Math\.max\(0,\s*progress\)\s*\/\s*Math\.max\(1,\s*goal\)\)/.test(qt),
          'QuestTab Math.min/Math.max defensive 보존');

      const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      assert.ok(/Math\.min\(100,\s*\(Math\.max\(0,\s*progress\)\s*\/\s*Math\.max\(1,\s*goal\)\)/.test(qb),
          'QuestBoardPanel Math.min/Math.max defensive 보존');
  });

  test('cycle 541: cycle 502-539 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ai = await readSrc('src/services/aiService.ts');
      assert.ok(!/const callProxy[^=]*trackLabel:\s*any\s*=\s*'ai-call'/.test(ai),
          'cycle 539 callProxy trackLabel default 0건');

      const helpers = await readSrc('src/reducers/handlers/helpers.ts');
      assert.ok(!/applyDailyProtocolProgress[^=]*amount:\s*any\s*=\s*1/.test(helpers),
          'cycle 538 applyDailyProtocolProgress amount default 0건');
  });
}

// ─── 원본: tests/cycle-555-quest-operations-inner-defaults-batch.test.js ───
{
  /**
   * cycle 555: questOperations 4 inner defaults batch unreachable + entry-point
   *   default 보존 (cycle 222-554 silent dead config 시리즈 296번째 — redundant
   *   default annotation 청소 메가 시리즈 49번째). entry-point pattern (cycle
   *   513) 재적용.
   *
   * 발견 (4 inner defaults unreachable, 1 entry default reachable 보존):
   * - src/utils/questOperations.ts:
   *     · line 61: const getQuestTargetMaps = (quest, maps: any = MAPS) — 2 callers
   *       (line 78/122) 모두 maps 명시.
   *     · line 76: const isBossQuest = (quest, maps: any = MAPS) — 1 caller
   *       (line 88, getQuestLane 내부) 명시.
   *     · line 84: const getQuestLane = (quest, resonance, maps: any = MAPS) —
   *       1 caller (line 120, scoreQuest 내부) 명시.
   *     · line 118: const scoreQuest = (..., maps: any = MAPS) — 1 caller
   *       (line 168, getQuestBoardRecommendations 내부) 명시.
   * - 호출 사이트 audit:
   *     · 4 inner functions: 모두 chain caller가 maps 명시 전달이라 default 도달
   *       불가.
   *     · entry: getQuestBoardRecommendations(line 160)는 외부 caller 3개
   *       (adventureGuide:335, QuestBoardPanel:66, cycle-356 test) 모두 1 arg만
   *       전달 → maps default = MAPS REACHABLE 보존 필수.
   *
   * 패턴 (cycle 222-554 시리즈 296번째):
   * - cycle 502-554: default 청소 메가 시리즈 53사이클.
   * - cycle 555: entry-point 패턴 (cycle 513 getEquipmentArtProfile에서 정착)
   *   재적용 — wrapper의 default는 entry이라 보존, inner chain의 default는
   *   redundant 정리. 4 inner defaults batch.
   *
   * 수정 (src/utils/questOperations.ts):
   * - getQuestTargetMaps signature: maps: any = MAPS → maps: any.
   * - isBossQuest signature: maps: any = MAPS → maps: any.
   * - getQuestLane signature: maps: any = MAPS → maps: any.
   * - scoreQuest signature: maps: any = MAPS → maps: any.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 4 inner callsite chain 동작 그대로.
   * - entry getQuestBoardRecommendations 2 defaults 보존 (maps + questCatalog).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 555: 4 inner defaults 0건', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      const fns = ['getQuestTargetMaps', 'isBossQuest', 'getQuestLane', 'scoreQuest'];
      for (const fn of fns) {
          const fnIdx = source.indexOf(`const ${fn}`);
          const fnEnd = source.indexOf('=>', fnIdx);
          const sig = source.slice(fnIdx, fnEnd);
          assert.ok(!/maps:\s*any\s*=\s*MAPS/.test(sig),
              `${fn}: maps default MAPS 제거`);
      }
  });

  test('cycle 555: entry getQuestBoardRecommendations 2 defaults 보존 (reachable)', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      const fnIdx = source.indexOf('export const getQuestBoardRecommendations');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/maps:\s*any\s*=\s*MAPS/.test(sig),
          'getQuestBoardRecommendations maps default MAPS 보존 (entry-point reachable)');
      assert.ok(/questCatalog:\s*any\s*=\s*QUESTS/.test(sig),
          'getQuestBoardRecommendations questCatalog default QUESTS 보존');
  });

  test('cycle 555: 정합성 가드 — chain callsite 보존', async () => {
      const source = await readSrc('src/utils/questOperations.ts');
      assert.ok(/getQuestTargetMaps\(quest,\s*maps\)/.test(source),
          'getQuestTargetMaps(quest, maps) chain 보존');
      assert.ok(/isBossQuest\(quest,\s*maps\)/.test(source),
          'isBossQuest(quest, maps) chain 보존');
      assert.ok(/getQuestLane\(quest,\s*resonance,\s*maps\)/.test(source),
          'getQuestLane(quest, resonance, maps) chain 보존');
  });

  test('cycle 555: cycle 502-554 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ep = await readSrc('src/utils/explorationPacing.ts');
      assert.ok(!/const getExploreState[^=]*stats:\s*any\s*=\s*\{\}/.test(ep),
          'cycle 554 getExploreState stats default 0건');

      const ce = await readSrc('src/systems/CombatEngine.ts');
      assert.ok(!/applyFatalProtection\(player: Player, relics:\s*Relic\[\]\s*=\s*\[\]/.test(ce),
          'cycle 553 applyFatalProtection relics default 0건');
  });
}

// ─── 원본: tests/cycle-589-quest-board-panel-system-tab-defaults-batch.test.js ───
{
  /**
   * cycle 589: QuestBoardPanel + SystemTab 2 defaults cross-file batch unreachable
   *   (cycle 222-588 silent dead config 시리즈 327번째 — redundant default annotation
   *   청소 메가 시리즈 80번째). cross-file 2-default batch.
   *
   * 발견 (2 defaults batch, 2 files):
   * - src/components/tabs/QuestBoardPanel.tsx (line 59):
   *     const QuestBoardPanel = ({ player, actions, setGameState,
   *         onOpenArchiveConsole = null }: QuestBoardPanelProps) => {...};
   * - src/components/tabs/SystemTab.tsx (line 28):
   *     const SystemTab = ({ player, actions, stats, runtime = null }:
   *         SystemTabProps) => {...};
   * - 호출 사이트:
   *     · QuestBoardPanel: ControlPanel:158 — 4 props 명시 전달.
   *     · SystemTab: Dashboard:241 — runtime={runtime} 명시 전달.
   * - 결과: 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-588 시리즈 327번째):
   * - cycle 502-588: default 청소 메가 시리즈 87사이클.
   * - cycle 589: components/tabs/ cross-file 2-default batch — cycle 584/588과
   *   동일 onOpenArchiveConsole 패턴 + SystemTab runtime.
   *
   * 수정:
   * - QuestBoardPanel: onOpenArchiveConsole = null → onOpenArchiveConsole.
   * - SystemTab: runtime = null → runtime.
   *
   * 회귀 가드:
   * - 2 production callsite 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 589: 2 defaults 0건', async () => {
      const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
      const qbSig = qb.slice(qb.indexOf('const QuestBoardPanel = '),
                              qb.indexOf('=>', qb.indexOf('const QuestBoardPanel = ')));
      assert.ok(!/onOpenArchiveConsole\s*=\s*null/.test(qbSig),
          'QuestBoardPanel onOpenArchiveConsole default null 제거');

      const st = await readSrc('src/components/tabs/SystemTab.tsx');
      const stSig = st.slice(st.indexOf('const SystemTab = '),
                              st.indexOf('=>', st.indexOf('const SystemTab = ')));
      assert.ok(!/runtime\s*=\s*null/.test(stSig),
          'SystemTab runtime default null 제거');
  });

  test('cycle 589: 정합성 가드 — production callsite 보존', async () => {
      const cp = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(/<QuestBoardPanel player=\{player\} actions=\{actions\} setGameState=\{setGameState\} onOpenArchiveConsole=\{onOpenArchiveConsole\}/.test(cp),
          'ControlPanel <QuestBoardPanel> 4-prop callsite 보존');

      const dash = await readSrc('src/components/Dashboard.tsx');
      assert.ok(/<SystemTab player=\{player\} actions=\{actions\} stats=\{stats\} runtime=\{runtime\}/.test(dash),
          'Dashboard <SystemTab> 4-prop callsite 보존');
  });

  test('cycle 589: cycle 502-588 회귀 가드 — default 청소 시리즈 보존', async () => {
      const cr = await readSrc('src/components/tabs/CraftingPanel.tsx');
      assert.ok(!/CraftingPanel = \({[^}]+onOpenArchiveConsole\s*=\s*null/.test(cr),
          'cycle 588 CraftingPanel onOpenArchiveConsole default 0건');

      const cp = await readSrc('src/components/ControlPanel.tsx');
      assert.ok(!/enemy\s*=\s*null/.test(cp),
          'cycle 587 ControlPanel enemy default 0건');
  });
}

// ─── 원본: tests/cycle-94-quest-progress-latching.test.js ───
{
  /**
   * cycle 94: 퀘스트 진행도 latch — 윈도우 기반 카운터 회귀 방지.
   *
   * 발견된 회귀 위험:
   * - syncQuestProgress의 'survive_low_hp' 분기는 countLowHpWins(stats, threshold)
   *   를 호출하는데, 그 함수는 stats.recentBattles(50개 윈도우) 안에서 hpRatio
   *   <= threshold 인 win 횟수를 센다.
   * - 플레이어가 일찍 5번의 저-HP 승리를 달성해 progress=5(goal=5)에 도달했다가
   *   퀘스트를 청구하지 않은 채 50번의 일반 승리를 더 하면, 윈도우에서 옛 저-HP
   *   승리가 밀려나 current=4가 되고 progress도 5→4로 회귀해 청구가 막힘.
   * - cycle 74에서 같은 패턴(stats.escapes를 명시 카운터로 도입)으로 도주 회귀를
   *   막았으나, 그 fix는 escapes 한 곳에 국한.
   *
   * 이번 사이클은 questProgress 레이어에서 latch 패턴(Math.max)을 적용해 모든
   * 카운터 기반 진행도가 한 번 올라가면 내려가지 않게 만든다. 카운터가 단조
   * 증가인 다른 분기(explores/crafts/escapes 등)에는 무해하고, 윈도우 기반인
   * survive_low_hp의 회귀를 막는다.
   */

  const buildLowHpWinsQuestPlayer = ({ progress, recentBattles }) => ({
      level: 30,
      job: '검사',
      quests: [{ id: 62, progress }],
      stats: {
          kills: 100, deaths: 0, total_gold: 5000,
          recentBattles,
      },
  });

  test('survive_low_hp: 진행도 5에서 recentBattles 빈 상태로도 progress 5 유지 (latch)', () => {
      // 시나리오: 이미 5번의 저-HP 승리를 모았고 quest.progress=5. 그 뒤로 50번의
      // 일반 승리로 윈도우가 회전하여 저-HP 승리가 모두 밀려난 상태(recentBattles
      // 에 hpRatio<=0.2인 win이 0건). 기존 코드라면 progress=0으로 회귀.
      const recentBattles = Array.from({ length: 50 }, () => ({ result: 'win', hpRatio: 0.9 }));
      const player = buildLowHpWinsQuestPlayer({ progress: 5, recentBattles });
      const result = syncQuestProgress(player);
      const quest = result.updatedQuests.find((q) => q.id === 62);
      assert.equal(quest.progress, 5, 'progress should latch at 5, not regress to 0');
  });

  test('survive_low_hp: 진행도 0에서 저-HP 승리 3건 → progress 3 (정상 증가)', () => {
      const recentBattles = [
          { result: 'win', hpRatio: 0.15 },
          { result: 'win', hpRatio: 0.18 },
          { result: 'win', hpRatio: 0.05 },
          { result: 'win', hpRatio: 0.5 }, // not low-HP
      ];
      const player = buildLowHpWinsQuestPlayer({ progress: 0, recentBattles });
      const result = syncQuestProgress(player);
      const quest = result.updatedQuests.find((q) => q.id === 62);
      assert.equal(quest.progress, 3, 'normal monotonic progress when increasing');
  });

  test('survive_low_hp: latch 후에도 새 저-HP 승리는 추가로 누적', () => {
      const recentBattles = [
          { result: 'win', hpRatio: 0.18 },
          { result: 'win', hpRatio: 0.18 },
          { result: 'win', hpRatio: 0.18 },
          { result: 'win', hpRatio: 0.18 },
          { result: 'win', hpRatio: 0.18 },
          { result: 'win', hpRatio: 0.18 },
      ];
      const player = buildLowHpWinsQuestPlayer({ progress: 4, recentBattles });
      const result = syncQuestProgress(player);
      const quest = result.updatedQuests.find((q) => q.id === 62);
      assert.equal(quest.progress, 5, '4 + new wins → cap at goal=5');
  });

  test('explore_count quest: 회귀 없이 stats.explores 정상 매핑 (회귀 보존)', () => {
      const player = {
          level: 12, job: '모험가',
          stats: { kills: 0, deaths: 0, total_gold: 0, explores: 8 },
          quests: [{ id: 61, progress: 0 }],
      };
      const result = syncQuestProgress(player);
      const quest = result.updatedQuests.find((q) => q.id === 61);
      assert.equal(quest.progress, 8);
  });

  test('explore_count quest: latch 적용 — explores가 줄어도 progress 유지', () => {
      // 상상적 케이스 — explores 카운터가 어떤 이유로 감소한 경우
      const player = {
          level: 12, job: '모험가',
          stats: { kills: 0, deaths: 0, total_gold: 0, explores: 3 },
          quests: [{ id: 61, progress: 12 }], // 이전엔 progress=12까지 올라감
      };
      const result = syncQuestProgress(player);
      const quest = result.updatedQuests.find((q) => q.id === 61);
      assert.equal(quest.progress, 12, 'latch protects against any unexpected counter regression');
  });
}

// ─── 원본: tests/cycle-99-quest-level-undefined.test.js ───
{
  /**
   * cycle 99: Player.level이 undefined일 때 Level 퀘스트 진행도가 NaN이 되거나
   * Math.max에 undefined가 들어가 TypeScript 에러를 일으키던 회귀 fix.
   *
   * 발견 경로:
   * - npm run verify의 type-check 단계에서 cycle 94 latch refactor 이후 잔존하던
   *   TS2345 에러 발견. `Math.max(quest.progress || 0, player.level)` 인자에
   *   undefined가 들어갈 수 있음 (Player 타입에서 level이 optional).
   * - Player.level이 undefined인 케이스는 손상된 save / 부분 mock 객체에서 발생
   *   가능. 런타임에 NaN progress가 만들어지면 quest 청구가 영구 잠김.
   *
   * fix:
   *   `Math.max(quest.progress || 0, player.level || 0)` — undefined → 0 fallback.
   *
   * verify:full 통합 명령(cycle 73)이 type-check를 포함하므로 이 가드는 cycle 78+
   * 사이클들이 npm run test:unit + lint + build-guard만으로 잠시 type 회귀를
   * 놓쳤던 부분을 후행 보강.
   */

  test('Level 퀘스트 진행도: player.level undefined → progress 0 (NaN 회피)', () => {
      const player = {
          // level intentionally omitted
          job: '모험가',
          quests: [{ id: 10, progress: 0 }],
          stats: { kills: 0 },
      };
      const result = syncQuestProgress(player);
      const quest = result.updatedQuests.find((q) => q.id === 10);
      assert.ok(quest, 'quest 10 should exist after sync');
      assert.equal(Number.isNaN(quest.progress), false, 'progress should not be NaN');
      assert.equal(quest.progress, 0, 'progress should be 0 when level is undefined');
  });

  test('Level 퀘스트 진행도: player.level=7 → progress 7 (정상)', () => {
      const player = {
          level: 7,
          job: '모험가',
          quests: [{ id: 10, progress: 0 }],
          stats: { kills: 0 },
      };
      const result = syncQuestProgress(player);
      const quest = result.updatedQuests.find((q) => q.id === 10);
      assert.equal(quest.progress, 7);
  });

  test('Level 퀘스트 진행도: latch 동작 — 이미 progress 12에서 player.level=7 → progress 12 유지', () => {
      const player = {
          level: 7,
          job: '모험가',
          quests: [{ id: 10, progress: 12 }],
          stats: { kills: 0 },
      };
      const result = syncQuestProgress(player);
      const quest = result.updatedQuests.find((q) => q.id === 10);
      assert.equal(quest.progress, 12, 'cycle 94 latch should still work');
  });
}
