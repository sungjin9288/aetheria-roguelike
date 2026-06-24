import { readInventoryActionsSource } from "./helpers/inventoryActionsSource.mjs";
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { BOSS_BRIEFS, BOSS_MONSTERS, MONSTERS } from '../src/data/monsters.js';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { DB } from '../src/data/db.js';
import { DROP_TABLES } from '../src/data/dropTables.js';
import { INITIAL_STATE } from '../src/reducers/gameReducer.js';
import { MAPS } from '../src/data/maps.js';
import { fileURLToPath } from 'node:url';
import { getBossSignatureDrops } from '../src/utils/bossSignatureHint.js';
import { getMapSignatureDrops } from '../src/utils/mapSignatureHints.js';
import { getSignatureDropSources } from '../src/utils/signatureDropSources.js';
import { readFile } from 'node:fs/promises';

/**
 * 보스(Boss) cycle 테스트 (audit #1 통합 7개)
 */

// ─── cycle-183-season-boss-drop-tables.test.js ───
{
  /**
   * cycle 183: cycle 173에서 추가된 시즌 보스 2종 drop table 추가 + 정합성 가드.
   *
   * 발견:
   * - cycle 173에서 '봄의 여왕' / '서리 군주'를 MONSTERS에 isBoss로 등록.
   * - 그러나 dropTables.ts / loot.ts에 등록 없어 cycle 171 보너스 드랍(25% tier
   *   5/6 random)만 발동. 큐레이션된 thematic 보상 부재.
   * - 시즌 이벤트 보스라 처치 빈도가 낮음 — 큐레이션 부재 더 두드러짐.
   *
   * 수정 (src/data/dropTables.ts):
   * 봄의 여왕 (자연 테마, weakness 화염): 자연의 결정 / 엘프의 눈물 / 영웅의 물약 /
   *   세계수의 지팡이 (5% legendary). cycle 177 fire_convergence 보상의 친척.
   * 서리 군주 (얼음 테마, weakness 화염): 냉기의 결정 / 상급 체력 물약 / 영웅의 물약 /
   *   빙결의 왕관검 (5% legendary). cycle 177 frozen_truth 보상과 일관 — 같은 legendary
   *   reuse.
   */

  test('cycle 183: 봄의 여왕 drop table 등록', () => {
      const dt = DROP_TABLES['봄의 여왕'];
      assert.ok(Array.isArray(dt), '봄의 여왕 drop table 등록');
      assert.ok(dt.length >= 3, '최소 3개 drop entry');
  });

  test('cycle 183: 서리 군주 drop table 등록', () => {
      const dt = DROP_TABLES['서리 군주'];
      assert.ok(Array.isArray(dt), '서리 군주 drop table 등록');
      assert.ok(dt.length >= 3);
  });

  test('cycle 183: 시즌 보스 drop table item이 모두 items.ts 등록됨', () => {
      const allItemNames = new Set();
      for (const arr of Object.values(DB.ITEMS)) {
          if (Array.isArray(arr)) for (const i of arr) if (i.name) allItemNames.add(i.name);
      }
      const issues = [];
      for (const bossName of ['봄의 여왕', '서리 군주']) {
          const dt = DROP_TABLES[bossName] || [];
          for (const entry of dt) {
              if (entry.item && !allItemNames.has(entry.item)) {
                  issues.push(`${bossName}: '${entry.item}' not in items.ts`);
              }
          }
      }
      assert.deepEqual(issues, []);
  });

  test('cycle 183: 시즌 보스가 MONSTERS에 isBoss로 등록됨 (cycle 173 회귀 가드)', () => {
      assert.equal(MONSTERS['봄의 여왕']?.isBoss, true);
      assert.equal(MONSTERS['서리 군주']?.isBoss, true);
  });

  test('cycle 183: legendary drop rate 합리적 (0.03~0.1)', () => {
      const spring = DROP_TABLES['봄의 여왕'];
      const frost = DROP_TABLES['서리 군주'];
      const springLegendary = spring.find((e) => e.item === '세계수의 지팡이');
      const frostLegendary = frost.find((e) => e.item === '빙결의 왕관검');
      assert.ok(springLegendary && springLegendary.rate >= 0.03 && springLegendary.rate <= 0.1);
      assert.ok(frostLegendary && frostLegendary.rate >= 0.03 && frostLegendary.rate <= 0.1);
  });
}

// ─── cycle-205-handle-defeat-area-boss-reset.test.js ───
{
  /**
   * cycle 205: handleDefeat가 areaBossDefeated를 per-run flag로 reset.
   *
   * 발견 (signature 드롭 path 잠복 lock):
   * - exploreUtils.ts:144 주석: '구역 보스 (15% 확률 스폰) — mapData.boss가 문자열이고
   *   이번 런 미처치 시 보장' — areaBossDefeated는 per-RUN flag.
   * - exploreUtils.ts:147: 게이트 `!(player.stats?.areaBossDefeated?.[areaBossName])` —
   *   defeated이면 spawnAreaBoss=false → 더 이상 spawn 안 함.
   * - combatVictory.ts:158: boss 처치 시 areaBossDefeated[name] = true 마킹.
   *
   * 문제 (handleDefeat ...prevStats spread 회귀):
   * - handleDefeat(CombatEngine.ts:1459): `starterState.stats = {...starterState.stats,
   *   ...prevStats, deaths: ...}` — prevStats spread로 areaBossDefeated 통째로 보존.
   * - 결과: 사망 후 재진입 시 이전 런에서 처치한 area boss가 더 이상 spawn 안 함.
   * - signature drop은 보스 kill에서만 발생 → 같은 보스 재대전 불가 → 그 area의
   *   signature 영구 차단. signaturePity는 보스 kill에서 +=1 하므로 pity counter도
   *   climb 불가 — mercy 시스템 (cycle 75)도 작동 차단.
   * - 다음 ASCEND까지 그 area의 signature 회수 영구 봉인.
   *
   * 정합성:
   * - ASCEND (progressionHandlers.ts:60): areaBossDefeated 미보존 → reset to {} ✓
   * - RESET_GAME (cycle 204): areaBossDefeated 미보존 → reset ✓
   * - handleDefeat: 유일하게 preserve → 회귀.
   *
   * 수정 (src/systems/CombatEngine.ts handleDefeat):
   * - prevStats spread 후 areaBossDefeated 명시 reset to {}.
   * - 다른 multi-run 카운터(kills/killRegistry/codex)는 그대로 보존 (cycle 119/202/203 정합).
   */

  const buildPlayer = (areaBossDefeated) => ({
      ...INITIAL_STATE.player,
      name: 'Test',
      hp: 0,
      maxHp: 100,
      stats: {
          ...INITIAL_STATE.player.stats,
          kills: 50,
          bossKills: 3,
          killRegistry: { '슬라임': 30, '봄의 여왕': 1 },
          areaBossDefeated,
      },
  });

  test('cycle 205: handleDefeat가 areaBossDefeated reset (per-run flag)', () => {
      const player = buildPlayer({ '봄의 여왕': true, '서리 군주': true });
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      assert.deepEqual(result.updatedPlayer.stats.areaBossDefeated, {},
          '사망 후 areaBossDefeated 리셋되어야 area boss 재진입 가능');
  });

  test('cycle 205: handleDefeat가 areaBossDefeated 미정의 시 {} (구형 save)', () => {
      const player = { ...INITIAL_STATE.player, name: 'Test', hp: 0, maxHp: 100 };
      delete player.stats.areaBossDefeated;
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      assert.deepEqual(result.updatedPlayer.stats.areaBossDefeated, {});
  });

  test('cycle 205: areaBossDefeated reset이 다른 multi-run 카운터를 깨지 않음 (회귀 가드)', () => {
      const player = buildPlayer({ '봄의 여왕': true });
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      // 다른 multi-run 카운터는 보존
      assert.equal(result.updatedPlayer.stats.kills, 50);
      assert.equal(result.updatedPlayer.stats.bossKills, 3);
      assert.deepEqual(result.updatedPlayer.stats.killRegistry, { '슬라임': 30, '봄의 여왕': 1 });
      // deaths += 1 (cycle 191 회귀 가드)
      assert.equal(result.updatedPlayer.stats.deaths, 1);
  });

  test('cycle 191 회귀 가드: META 진행도 6종 보존 동시 유지', () => {
      const player = {
          ...INITIAL_STATE.player,
          name: 'Test',
          hp: 0,
          maxHp: 100,
          titles: ['warrior'],
          activeTitle: 'warrior',
          premiumCurrency: 100,
          reviveTokens: 2,
          maxInv: 25,
          seasonPass: { xp: 100, tier: 5, claimed: [], isPremium: true, seasonId: 'S1' },
          stats: {
              ...INITIAL_STATE.player.stats,
              areaBossDefeated: { '봄의 여왕': true },
              cosmeticTitles: ['별을 보는 자'],
              synthProtects: 1,
          },
      };
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      // cycle 191
      assert.deepEqual(result.updatedPlayer.titles, ['warrior']);
      assert.equal(result.updatedPlayer.activeTitle, 'warrior');
      assert.equal(result.updatedPlayer.premiumCurrency, 100);
      assert.equal(result.updatedPlayer.reviveTokens, 2);
      assert.equal(result.updatedPlayer.maxInv, 25);
      assert.deepEqual(result.updatedPlayer.seasonPass, { xp: 100, tier: 5, claimed: [], isPremium: true, seasonId: 'S1' });
      // cycle 188
      assert.deepEqual(result.updatedPlayer.stats.cosmeticTitles, ['별을 보는 자']);
      assert.equal(result.updatedPlayer.stats.synthProtects, 1);
      // cycle 205
      assert.deepEqual(result.updatedPlayer.stats.areaBossDefeated, {});
  });

  test('cycle 205: 처치 안 된 areaBossDefeated 빈 {}는 그대로 빈 {}', () => {
      const player = buildPlayer({});
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      assert.deepEqual(result.updatedPlayer.stats.areaBossDefeated, {});
  });
}

// ─── cycle-273-boss-phase2-story-dispatch.test.js ───
{
  /**
   * cycle 273: aiService 'bossPhase2' 스토리 템플릿 dispatch 누락 dead config
   *   (cycle 222-272 silent dead config 시리즈 44번째 — cycle 272 paired follow-up).
   *
   * 발견 (cycle 272 paired):
   * - cycle 272에서 'questComplete' 스토리 템플릿 dispatch 추가.
   * - 잔존 dead 3종: levelUp / bossPhase2 / ruinRecap.
   * - 'bossPhase2' (`⚡ [${bossName}]이(가) 진정한 힘을 해방합니다!`)는 보스 phase2 transition
   *   시점의 narrative cue. CombatEngine.enemyAttack 내부에서 phase2Triggered 전환되지만 hook
   *   layer는 이 transition을 감지해서 addStoryLog 호출 안 함.
   * - 결과: 보스 phase2 발현이 visual + log + status는 있지만 AI narrative blurb 부재.
   *
   * 패턴 (cycle 222-272 silent dead config 시리즈 44번째):
   * - cycle 272: questComplete 템플릿 dispatch.
   * - cycle 273: bossPhase2 템플릿 dispatch (paired follow-up).
   *
   * 수정 (src/hooks/combatActions/combatAttack.ts):
   * - enemyAttack 호출 후 phase2 transition 감지: 이전 enemy.phase2Triggered=false → 후 true.
   * - addStoryLog('bossPhase2', { bossName: counterResult.updatedEnemy.name }) 호출.
   *
   * 회귀 가드:
   * - cycle 272 questComplete dispatch 동작 유지.
   * - phase2 transition logs / status / atk bonus 동작 변화 없음.
   * - phase2 미정의 보스 / 일반 적은 미발동 (조건 가드).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 273: combatAttack가 phase2 transition 감지', async () => {
      const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
      // result.updatedEnemy.phase2Triggered (이전) vs counterResult.updatedEnemy.phase2Triggered (후) 비교.
      assert.ok(/phase2Triggered/.test(source),
          'combatAttack.ts에서 phase2Triggered 비교');
  });

  test('cycle 273: combatAttack가 addStoryLog("bossPhase2", ...) 호출', async () => {
      const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
      assert.ok(/addStoryLog\(['"]bossPhase2['"]/.test(source),
          "addStoryLog('bossPhase2', ...) 호출");
  });

  test('cycle 273: bossPhase2 payload에 bossName 포함', async () => {
      const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
      assert.ok(/addStoryLog\(['"]bossPhase2['"]\s*,\s*\{[\s\S]{0,80}?bossName/.test(source),
          'bossName 포함된 payload (template "${data.bossName}" 정합)');
  });

  test('cycle 273: aiService bossPhase2 템플릿 정의 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/services/aiService.ts');
      assert.ok(/bossPhase2:[\s\S]{0,200}bossName/.test(source),
          'aiService bossPhase2 템플릿 유지');
  });

  test('cycle 272 회귀 가드: questComplete dispatch 동작 유지', async () => {
      const source = await readInventoryActionsSource();
      assert.ok(/addStoryLog\(['"]questComplete['"]/.test(source),
          'cycle 272 questComplete addStoryLog 유지');
  });
}

// ─── cycle-328-boss-phase-private.test.js ───
{
  /**
   * cycle 328: BossPhase type export → private downgrade
   *   (cycle 222-327 silent dead config 시리즈 97번째 — cleanup lens 연속).
   *
   * 발견 (private downgrade 후보):
   * - src/types/monster.ts: BossPhase interface — phase2 / phase3 필드 타입으로만 사용,
   *   외부 import 0건.
   * - cycle 298 BossMonster private downgrade 패턴 동일.
   *
   * 패턴 (cycle 222-327 silent dead config 시리즈 97번째):
   * - cycle 327: JOB_TYPICAL_LOADOUT dead data 제거.
   * - cycle 328: BossPhase type private downgrade.
   *
   * 수정:
   * - src/types/monster.ts: BossPhase export 제거 (interface 정의 유지).
   * - tests/cycle-283-monster-types-dead.test.js: regex `(?:export )?interface BossPhase`
   *   패턴으로 private downgrade 호환 갱신.
   *
   * 회귀 가드:
   * - MonsterBase / Monster 유니온 / phase2 / phase3 필드 타입 그대로.
   * - cycle 283 dead 필드 cleanup 가드 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 328: BossPhase export 제거 (private)', async () => {
      const source = await readSrc('src/types/monster.ts');
      assert.ok(!/export interface BossPhase\b/.test(source),
          'BossPhase export 제거됨');
      assert.ok(/interface BossPhase\b/.test(source),
          'BossPhase 정의 유지 (private)');
  });

  test('cycle 328: phase2 / phase3 필드 타입 보존', async () => {
      const source = await readSrc('src/types/monster.ts');
      assert.ok(/phase2\?:\s*BossPhase/.test(source), 'phase2 필드 BossPhase 타입');
      assert.ok(/phase3\?:\s*BossPhase/.test(source), 'phase3 필드 BossPhase 타입');
  });

  test('cycle 328: monster.ts active export 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/types/monster.ts');
      assert.ok(/export interface MonsterBase\b/.test(source), 'MonsterBase export 유지');
      assert.ok(/export type Monster\b/.test(source), 'Monster 유니온 export 유지');
  });

  test('cycle 327 회귀 가드: JOB_TYPICAL_LOADOUT 제거 보존', async () => {
      const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
      assert.ok(!/export const JOB_TYPICAL_LOADOUT\b/.test(source),
          'cycle 327 JOB_TYPICAL_LOADOUT 제거 보존');
  });
}

// ─── cycle-367-maps-boss-false-redundant.test.js ───
{
  /**
   * cycle 367: maps.ts boss: false 4회 redundant 정리
   *   (cycle 222-366 silent dead config 시리즈 133번째 — cleanup lens 연속).
   *
   * 발견 (4 redundant default annotations):
   * - src/data/maps.ts에 4 맵이 `boss: false` 명시.
   * - 모든 boss 사용 사이트(`if (mapData.boss)`, `map?.boss ? ...`,
   *   `Boolean(mapData.boss)`, `typeof mapData.boss === 'string'`)가 falsy 체크.
   * - boss 필드 부재 = falsy = boss: false 효과 동일이라 명시 redundant.
   * - boss 값으로 보스 이름(string)을 가지는 맵 또는 boss: true(boolean)로
   *   추상 보스 표시하는 맵만 의미 있음. boss: false는 그냥 noise.
   *
   * 패턴 (cycle 222-366 silent dead config 시리즈 133번째):
   * - cycle 366: monster phase threshold default 7 redundant.
   * - cycle 367: maps boss: false 4 redundant.
   *
   * 수정 (src/data/maps.ts):
   * - 4 곳의 `boss: false,` (또는 `, boss: false`) 명시 제거.
   *
   * 회귀 가드:
   * - boss 필드가 string인 맵 (e.g. '고대 호수의 수호신') 보존.
   * - boss: true 명시 맵 보존 (추상 표시 — bossMonsters 분기 트리거).
   * - mapSignatureHints / explorationPacing / questOperations 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 367: maps.ts boss: false 0건', async () => {
      const source = await readSrc('src/data/maps.ts');
      const matches = source.match(/boss: false/g) || [];
      assert.equal(matches.length, 0,
          `maps.ts에서 boss: false 0건이어야 함, ${matches.length}건 발견`);
  });

  test('cycle 367: 활성 boss 필드 보존 (string + true)', async () => {
      const source = await readSrc('src/data/maps.ts');
      const stringBossMatches = source.match(/boss: '[^']+'/g) || [];
      const trueBossMatches = source.match(/boss: true/g) || [];
      assert.ok(stringBossMatches.length > 0,
          `boss string 필드 보존 (${stringBossMatches.length}건)`);
      assert.ok(trueBossMatches.length > 0,
          `boss true 필드 보존 (${trueBossMatches.length}건)`);
  });

  test('cycle 367: MAPS 동작 보존 (모든 맵 객체 정상)', async () => {
      const { MAPS } = await import('../src/data/maps.js');
      const mapNames = Object.keys(MAPS);
      assert.ok(mapNames.length >= 30, `30+ 맵 보존 (${mapNames.length})`);
      for (const name of mapNames) {
          const m = MAPS[name];
          assert.ok(m, `${name} 맵 정의 존재`);
          // boss가 false였던 맵들은 이제 undefined여야 함
          if (m.boss === false) {
              assert.fail(`${name} 맵에 boss: false 잔존 (제거 누락)`);
          }
      }
  });

  test('cycle 366 회귀 가드: monster phase threshold 0.5/0.25 redundant 0건 보존', async () => {
      const source = await readSrc('src/data/monsters.ts');
      const phase2WithThreshold = source.match(/phase2:[^}]+threshold:/g) || [];
      const phase3WithThreshold025 = source.match(/phase3:[^}]+threshold: 0\.25/g) || [];
      assert.equal(phase2WithThreshold.length, 0, 'cycle 366 phase2 threshold 0건 보존');
      assert.equal(phase3WithThreshold025.length, 0, 'cycle 366 phase3 threshold 0.25 0건 보존');
  });
}

// ─── cycle-68-lake-guardian-boss.test.js ───
{
  // cycle 68: 신성한 호수 mid-game 보스 "고대 호수의 수호신" 완전 통합.
  // MONSTERS / BOSS_BRIEFS / BOSS_MONSTERS / MAPS (boss field) / DROP_TABLES
  // 5개 데이터 소스가 모두 일관되게 등록됐는지 회귀 가드.

  const BOSS_NAME = '고대 호수의 수호신';

  test('MONSTERS에 고대 호수의 수호신이 isBoss=true로 등록됨', () => {
      const entry = MONSTERS[BOSS_NAME];
      assert.ok(entry, 'monster entry should exist');
      assert.equal(entry.isBoss, true, 'isBoss should be true');
      assert.ok(entry.weakness && entry.resistance, 'weakness + resistance defined');
      assert.ok(entry.phase2, 'phase2 transition defined');
      assert.ok(entry.phase2.statusEffect, 'phase2 statusEffect defined');
  });

  test('BOSS_MONSTERS computed list에 자동 포함됨', () => {
      assert.ok(BOSS_MONSTERS.includes(BOSS_NAME), 'auto-derived BOSS_MONSTERS should include the new boss');
  });

  test('BOSS_BRIEFS에 entryHint / counterHint / phaseHint / rewardHint 모두 등록됨', () => {
      const brief = BOSS_BRIEFS[BOSS_NAME];
      assert.ok(brief, 'brief should exist');
      assert.ok(brief.signature, 'signature missing');
      assert.ok(brief.entryHint, 'entryHint missing');
      assert.ok(brief.counterHint, 'counterHint missing');
      assert.ok(brief.phaseHint, 'phaseHint missing');
      assert.ok(brief.rewardHint, 'rewardHint missing');
      assert.ok(Array.isArray(brief.warningChips) && brief.warningChips.length > 0, 'warningChips populated');
      assert.ok(Array.isArray(brief.recommendedBuilds) && brief.recommendedBuilds.length > 0, 'recommendedBuilds populated');
  });

  test('MAPS의 신성한 호수에 boss 필드 연결됨', () => {
      const map = MAPS['신성한 호수'];
      assert.ok(map, 'map should exist');
      assert.equal(map.boss, BOSS_NAME, 'map.boss should reference the new boss name');
  });

  test('DROP_TABLES에 고대 호수의 수호신 엔트리 등록됨', () => {
      const drops = DROP_TABLES[BOSS_NAME];
      assert.ok(Array.isArray(drops), 'drop entries should be an array');
      assert.ok(drops.length >= 3, 'should have at least 3 drop slots');
      for (const entry of drops) {
          assert.ok(entry.item && typeof entry.item === 'string', 'each drop has item name');
          assert.ok(typeof entry.rate === 'number' && entry.rate > 0 && entry.rate <= 1, 'rate in (0, 1]');
      }
  });

  // cycle 69: 신규 보스 → signature drop 연결 테스트.
  // "심해의 수호복" signature가 신성한 호수(고대 호수의 수호신)에서 mid-game
  // 보조 드롭 경로로 제공됨을 회귀 가드. signature 피드백 체인의
  // anticipate→drop 모먼트를 mid-game에서 한 번 노출.

  test('cycle 69: 고대 호수의 수호신에 signature 심해의 수호복 보조 드롭 추가', () => {
      const drops = DROP_TABLES['고대 호수의 수호신'];
      const sigDrop = drops.find((d) => d.item === '심해의 수호복');
      assert.ok(sigDrop, 'signature drop entry should exist');
      assert.equal(sigDrop.rate, 0.03, 'low rate (mid-game 보조 경로)');
  });

  test('cycle 69: getBossSignatureDrops("고대 호수의 수호신")이 심해의 수호복 반환', () => {
      const sigDrops = getBossSignatureDrops('고대 호수의 수호신');
      const found = sigDrops.find((d) => d.name === '심해의 수호복');
      assert.ok(found, 'getBossSignatureDrops should expose the signature');
      assert.equal(found.rate, 0.03);
  });

  test('cycle 69: getMapSignatureDrops("신성한 호수")가 심해의 수호복 포함', () => {
      const drops = getMapSignatureDrops('신성한 호수');
      const found = drops.find((d) => d.name === '심해의 수호복');
      assert.ok(found, 'map signature index should include lake guardian drop');
  });

  test('cycle 69: getSignatureDropSources("심해의 수호복")이 두 보스 모두 표시', () => {
      const sources = getSignatureDropSources('심해의 수호복');
      const sourceNames = sources.map((s) => s.monster);
      assert.ok(sourceNames.includes('고대 호수의 수호신'), 'lake guardian should be in sources');
      assert.ok(sourceNames.includes('심연 크라켄'), 'kraken (existing primary source) preserved');
  });
}

// ─── cycle-70-bestiary-boss-coverage.test.js ───
{
  // cycle 70: Bestiary / MonsterCodex / Codex의 monstersSet에 boss / bossMonsters가
  // 누락되던 버그 수정 회귀 가드.
  //
  // 기존 동작: (Object.values(MAPS)).forEach(map => map.monsters.forEach(...))
  //   → 단일 map.boss 필드만 있는 보스(예: 고대 호수의 수호신)가 set에 안 들어감
  //   → Bestiary "발견 % 진행"에서 보이지도 않고, 도감 total count에도 빠짐
  //
  // 수정 후: monsters + bossMonsters + boss(string) 합집합으로 set 채움.
  // 이 테스트는 set 자체를 만드는 로직을 src에서 빌려와 검증하는 게 아니라,
  // MAPS의 모든 map.boss 단일 필드 값들이 다 string임을 보장 + 신성한 호수의
  // 보스가 등록된 상태임을 confirm해 회귀 시 곧장 깨지게 한다.

  const collectMapEncounters = (map) => [
      ...(Array.isArray(map?.monsters) ? map.monsters : []),
      ...(Array.isArray(map?.bossMonsters) ? map.bossMonsters : []),
      ...(typeof map?.boss === 'string' ? [map.boss] : []),
  ];

  test('cycle 70: 모든 map.boss 단일 필드는 string 또는 boolean', () => {
      for (const [mapName, map] of Object.entries(MAPS)) {
          if (map.boss === undefined) continue;
          // 일부 map은 boss: true/false (legendary 플래그) — string은 실제 보스 이름.
          // helper는 string만 인식하므로 bool 케이스는 silently 무시되어야 함.
          assert.ok(
              typeof map.boss === 'string' || typeof map.boss === 'boolean',
              `${mapName}.boss는 string(보스 이름) 또는 boolean(legendary 플래그)이어야 함`
          );
      }
  });

  test('cycle 70: 신성한 호수의 boss "고대 호수의 수호신"이 monstersSet에 포함됨', () => {
      const lake = MAPS['신성한 호수'];
      assert.ok(lake, 'map exists');
      const encounters = collectMapEncounters(lake);
      assert.ok(
          encounters.includes('고대 호수의 수호신'),
          'collectMapEncounters가 boss 단일 필드를 누락하지 않아야 함'
      );
  });

  test('cycle 70: collectMapEncounters helper가 monsters + bossMonsters + boss 모두 합침', () => {
      const fakeMap = {
          monsters: ['m1', 'm2'],
          bossMonsters: ['b1'],
          boss: 'b2',
      };
      const result = collectMapEncounters(fakeMap);
      assert.deepEqual(result.sort(), ['b1', 'b2', 'm1', 'm2']);
  });

  test('cycle 70: boss: true (legendary 표시)는 helper가 무시함', () => {
      const fakeMap = {
          monsters: ['m1'],
          boss: true,  // legendary 표시지 실제 이름 아님
      };
      const result = collectMapEncounters(fakeMap);
      assert.deepEqual(result, ['m1'], 'boss=true는 string 필터에 안 걸림');
  });

  test('cycle 70: boss / bossMonsters 둘 다 없는 평범한 맵', () => {
      const fakeMap = { monsters: ['m1', 'm2'] };
      const result = collectMapEncounters(fakeMap);
      assert.deepEqual(result, ['m1', 'm2']);
  });
}
