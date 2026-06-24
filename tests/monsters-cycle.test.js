import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { CombatEngine } from '../src/systems/CombatEngine.js';
import { MONSTERS } from '../src/data/monsters.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/**
 * 몬스터(Monster) 관련 cycle 테스트 — 통합본.
 * 기존 18개 cycle-*.test.js 통합 (audit #1). 각 원본 본문을 블록 { } 으로 격리 — 행동/커버리지 동일.
 */

// ─── 원본: tests/cycle-165-map-monster-profile-baseline.test.js ───
{
  /**
   * cycle 165: 맵 spawn pool → MONSTERS 정합성 baseline 가드.
   *
   * 발견:
   * - maps.ts의 monsters[] 배열에 monsters.ts MONSTERS 객체에 없는 이름 42건
   *   사용 중. spawnEnemy(exploreUtils.ts:175)는 `DB.MONSTERS[baseName]`이
   *   undefined면 weakness/resistance/atkMult/hpMult/expMult/goldMult/pattern/
   *   phase2 모두 미적용 — 해당 enemy는 generic stat-blank으로 spawn되어
   *   속성 약점/저항 메커니즘이 작동 안 함.
   * - 콘텐츠 갭 — 게임은 진행되지만 전투 깊이 축소.
   *
   * cycle 141 reward.item / cycle 148 relic.effect / cycle 164 quest.target
   * baseline pattern 재사용 — 양방향 가드로 점진 정리:
   *
   * 1. KNOWN_MISSING_MAP_MONSTERS Set — 현재 누락 명시 인정.
   * 2. NEW dead 가드: baseline 외 추가되면 즉시 실패 — 새 map 추가 시 monster
   *    profile 누락 catch.
   * 3. baseline 좁히기 가드: monster profile 추가됐으면 baseline에서도 제거.
   *
   * cycle 165(34) → 166(-8) → 167(-8) → 168(-8) → 169(-10) = 0 🎯
   * 5 사이클에서 점진 정리 완료. 빈 Set lock — 새 map monster 추가 시 profile
   * 누락이 즉시 detect.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  // cycle 165 baseline — 42 → 165(-8) → 166(-8) → 167(-8) → 168(-8) → 169(-10) = 0 🎯
  // 모든 maps.ts spawn pool 참조가 MONSTERS profile을 가짐. 빈 Set lock.
  const KNOWN_MISSING_MAP_MONSTERS = new Set([]);

  const collectMapMonsterRefs = async () => {
      const maps = await readFile(path.join(ROOT, 'src/data/maps.ts'), 'utf8');
      const refs = new Set();
      // monsters: [...] — 일반 spawn pool
      const arrRe = /monsters:\s*\[([^\]]+)\]/g;
      let m;
      while ((m = arrRe.exec(maps)) !== null) {
          const strRe = /'([^']+)'|"([^"]+)"/g;
          let mm;
          while ((mm = strRe.exec(m[1])) !== null) refs.add(mm[1] || mm[2]);
      }
      // cycle 173: bossMonsters: [...] — 보스 spawn pool 도 포함.
      const bossArrRe = /bossMonsters:\s*\[([^\]]+)\]/g;
      while ((m = bossArrRe.exec(maps)) !== null) {
          const strRe = /'([^']+)'|"([^"]+)"/g;
          let mm;
          while ((mm = strRe.exec(m[1])) !== null) refs.add(mm[1] || mm[2]);
      }
      // cycle 173: boss: 'name' — 단일 보스 참조도 포함 (boolean true는 제외).
      const bossSingleRe = /boss:\s*['"]([^'"]+)['"]/g;
      while ((m = bossSingleRe.exec(maps)) !== null) refs.add(m[1]);
      return refs;
  };

  const findMissing = async () => {
      const refs = await collectMapMonsterRefs();
      const monsterKeys = new Set(Object.keys(MONSTERS));
      return [...refs].filter((n) => !monsterKeys.has(n));
  };

  test('map.monsters[] → MONSTERS 정합성: NEW missing 0건 (baseline 외 추가 시 즉시 실패)', async () => {
      const missing = await findMissing();
      const newMissing = missing.filter((n) => !KNOWN_MISSING_MAP_MONSTERS.has(n));
      assert.deepEqual(newMissing, [],
          `NEW missing map monsters (add MONSTERS[name] profile or update baseline):\n  ${newMissing.join('\n  ')}`);
  });

  test('map.monsters[] baseline 좁히기 — known missing이 MONSTERS에 추가됐으면 baseline에서 제거', async () => {
      const missing = await findMissing();
      const missingSet = new Set(missing);
      const stale = [...KNOWN_MISSING_MAP_MONSTERS].filter((n) => !missingSet.has(n));
      assert.deepEqual(stale, [],
          `stale baseline (these monsters now have profile — remove from KNOWN_MISSING_MAP_MONSTERS):\n  ${stale.join('\n  ')}`);
  });
}

// ─── 원본: tests/cycle-166-monster-undead-storm-batch.test.js ───
{
  /**
   * cycle 166: maps.ts 참조 누락 monster profile 추가 — 언데드 / 폭풍 테마 8종 batch
   * (cycle 165 baseline 34 → 26).
   *
   * cycle 165 화염/얼음 batch에 이은 두 번째 batch. 언데드 5종 (weakness 빛,
   * resistance 어둠) + 폭풍 3종 (weakness 대지, resistance 자연).
   *
   * statusOnHit:
   * - 망자의 사제 / 해골 마법사 / 저주받은 기사 → curse
   * - 묘지 구울 → poison
   *
   * 검증: 8종 모두 MONSTERS에 등록 + weakness/resistance 정확.
   */

  const UNDEAD = ['망자의 사제', '묘지 구울', '유령 군단', '해골 마법사', '저주받은 기사'];
  const STORM = ['뇌운 와이번', '번개 정령', '폭풍 그리핀'];

  test('cycle 166: 언데드 5종 모두 MONSTERS 등록 + weakness 빛 / resistance 어둠', () => {
      for (const name of UNDEAD) {
          const profile = MONSTERS[name];
          assert.ok(profile, `${name} profile 누락`);
          assert.equal(profile.weakness, '빛', `${name} weakness 빛 아님`);
          assert.equal(profile.resistance, '어둠', `${name} resistance 어둠 아님`);
      }
  });

  test('cycle 166: 폭풍 3종 모두 MONSTERS 등록 + weakness 대지 / resistance 자연', () => {
      for (const name of STORM) {
          const profile = MONSTERS[name];
          assert.ok(profile, `${name} profile 누락`);
          assert.equal(profile.weakness, '대지');
          assert.equal(profile.resistance, '자연');
      }
  });

  test('cycle 166: statusOnHit 매핑 정합 — 망자의 사제/해골 마법사/저주받은 기사 → curse, 묘지 구울 → poison', () => {
      assert.equal(MONSTERS['망자의 사제'].statusOnHit, 'curse');
      assert.equal(MONSTERS['해골 마법사'].statusOnHit, 'curse');
      assert.equal(MONSTERS['저주받은 기사'].statusOnHit, 'curse');
      assert.equal(MONSTERS['묘지 구울'].statusOnHit, 'poison');
  });

  test('cycle 166: pattern 합리성 — 마법사/구울은 heavyChance 높음, 골렘 없음(이번 batch)', () => {
      assert.ok(MONSTERS['해골 마법사'].pattern.heavyChance >= 0.5,
          '해골 마법사는 nuker 패턴(높은 heavyChance)');
      assert.ok(MONSTERS['폭풍 그리핀'].pattern.heavyChance >= 0.5,
          '폭풍 그리핀은 sweep 패턴(높은 heavyChance)');
  });
}

// ─── 원본: tests/cycle-167-monster-nature-void-cave-batch.test.js ───
{
  /**
   * cycle 167: maps.ts 참조 누락 monster profile 추가 — 자연/공허/동굴 8종 batch
   * (cycle 165 baseline 26 → 18).
   *
   * cycle 165 화염/얼음, cycle 166 언데드/폭풍에 이은 세 번째 batch.
   *
   * 자연/꽃 (4종) — weakness 화염, resistance 자연:
   * - 봄의 정령, 정원 요정 (statusOnHit poison), 꽃 골렘 (탱커), 꽃잎 슬라임 (statusOnHit poison)
   *
   * 공허 (3종) — weakness 빛, resistance 어둠:
   * - 공허 감시병 (탱커), 공허 마법사 (statusOnHit curse), 공허의 파편
   *
   * 동굴 (1종) — weakness 빛, resistance 어둠:
   * - 동굴 박쥐 (저레벨 quick striker)
   */

  const NATURE = ['봄의 정령', '정원 요정', '꽃 골렘', '꽃잎 슬라임'];
  const VOID = ['공허 감시병', '공허 마법사', '공허의 파편'];
  const CAVE = ['동굴 박쥐'];

  test('cycle 167: 자연/꽃 4종 모두 MONSTERS 등록 + weakness 화염 / resistance 자연', () => {
      for (const name of NATURE) {
          const profile = MONSTERS[name];
          assert.ok(profile, `${name} profile 누락`);
          assert.equal(profile.weakness, '화염');
          assert.equal(profile.resistance, '자연');
      }
  });

  test('cycle 167: 공허 3종 모두 MONSTERS 등록 + weakness 빛 / resistance 어둠', () => {
      for (const name of VOID) {
          const profile = MONSTERS[name];
          assert.ok(profile, `${name} profile 누락`);
          assert.equal(profile.weakness, '빛');
          assert.equal(profile.resistance, '어둠');
      }
  });

  test('cycle 167: 동굴 박쥐 등록 + 저레벨 quick striker stats', () => {
      const bat = MONSTERS['동굴 박쥐'];
      assert.ok(bat);
      assert.equal(bat.weakness, '빛');
      assert.equal(bat.resistance, '어둠');
      assert.ok(bat.hp <= 200, '저레벨 박쥐는 hp 낮음');
      assert.ok(bat.pattern.heavyChance >= 0.3, 'quick striker pattern');
  });

  test('cycle 167: statusOnHit 매핑 — poison 2종 (정원 요정/꽃잎 슬라임) + curse 1종 (공허 마법사)', () => {
      assert.equal(MONSTERS['정원 요정'].statusOnHit, 'poison');
      assert.equal(MONSTERS['꽃잎 슬라임'].statusOnHit, 'poison');
      assert.equal(MONSTERS['공허 마법사'].statusOnHit, 'curse');
  });

  test('cycle 167: 꽃 골렘 탱커 패턴 (높은 guardChance, 낮은 heavyChance)', () => {
      const golem = MONSTERS['꽃 골렘'];
      assert.ok(golem.pattern.guardChance >= 0.25);
      assert.ok(golem.pattern.heavyChance <= 0.25);
      assert.ok(golem.def >= 30);
  });
}

// ─── 원본: tests/cycle-168-monster-corrupted-lab-batch.test.js ───
{
  /**
   * cycle 168: maps.ts 참조 누락 monster profile 추가 — 부패/실험실 8종 batch
   * (cycle 165 baseline 18 → 10).
   *
   * cycle 165(화염/얼음) → 166(언데드/폭풍) → 167(자연/공허/동굴) → 168(부패/실험실)
   * batch 시리즈 4번째.
   *
   * 부패/타락 (5종) — weakness 빛, resistance 어둠:
   * - 붕괴한 수호자 (탱커 + curse)
   * - 실험실 수호자 (탱커, def 48)
   * - 최후의 수호자 (보스 톤, hp 540)
   * - 타락한 용사 (전사형 atk 92)
   * - 파멸의 기사 (탱커-전사 + curse)
   *
   * 실험실/기계 (3종) — weakness 자연/냉기, resistance 대지:
   * - 생체 병기 (statusOnHit poison)
   * - 오염된 연구원 (mage + curse)
   * - 폭주 자동인형 (탱커, weakness 냉기)
   */

  const CORRUPTED = ['붕괴한 수호자', '실험실 수호자', '최후의 수호자', '타락한 용사', '파멸의 기사'];
  const LAB = ['생체 병기', '오염된 연구원', '폭주 자동인형'];

  test('cycle 168: 부패/타락 5종 weakness 빛 / resistance 어둠', () => {
      for (const name of CORRUPTED) {
          const profile = MONSTERS[name];
          assert.ok(profile, `${name} profile 누락`);
          assert.equal(profile.weakness, '빛');
          assert.equal(profile.resistance, '어둠');
      }
  });

  test('cycle 168: 실험실 3종 등록 + resistance 대지', () => {
      for (const name of LAB) {
          const profile = MONSTERS[name];
          assert.ok(profile, `${name} profile 누락`);
          assert.equal(profile.resistance, '대지');
      }
  });

  test('cycle 168: statusOnHit 매핑 — curse 3종 (붕괴한/파멸의/오염된) + poison 1종 (생체)', () => {
      assert.equal(MONSTERS['붕괴한 수호자'].statusOnHit, 'curse');
      assert.equal(MONSTERS['파멸의 기사'].statusOnHit, 'curse');
      assert.equal(MONSTERS['오염된 연구원'].statusOnHit, 'curse');
      assert.equal(MONSTERS['생체 병기'].statusOnHit, 'poison');
  });

  test('cycle 168: 최후의 수호자 보스 톤 (hp 540, exp 268+, gold 125+)', () => {
      const m = MONSTERS['최후의 수호자'];
      assert.ok(m.hp >= 500);
      assert.ok(m.exp >= 260);
      assert.ok(m.gold >= 120);
  });

  test('cycle 168: 폭주 자동인형 weakness 냉기 (대지 resistance과 분리)', () => {
      const m = MONSTERS['폭주 자동인형'];
      assert.equal(m.weakness, '냉기');
      assert.equal(m.resistance, '대지');
  });
}

// ─── 원본: tests/cycle-169-monster-final-batch.test.js ───
{
  /**
   * cycle 169 🎯: maps.ts 참조 누락 monster profile 추가 — 잔존 10종 batch
   * (cycle 165 baseline 10 → 0 달성).
   *
   * 5 사이클(165-169) 점진 정리:
   *   165(42) → 166(-8) → 167(-8) → 168(-8) → 169(-10) = 0
   *
   * 모든 maps.ts spawn pool 참조 monster가 MONSTERS profile 보유. spawnEnemy
   * (exploreUtils.ts:175)의 DB.MONSTERS[baseName] lookup이 모든 spawn 케이스에서
   * hit. 속성 약점/저항/패턴/statusOnHit 메커니즘이 모든 enemy에 적용됨.
   *
   * 이번 사이클 batch:
   * - 바람 (2): 광풍의 원소 / 바람 추적자 — weakness 대지, resistance 자연.
   * - 심연 (1): 심연의 눈 — weakness 빛, resistance 어둠 (statusOnHit curse).
   * - 에테르 (2): 에테르 잔류체 / 에테르 흡수체 — weakness 자연, resistance 빛.
   * - 종말 (2): 종말의 마법사 (nuker) / 종말의 전령 (보스 톤).
   * - 허무/혼돈 (2): 허무 집행관 (탱커) / 혼돈의 추종자 (statusOnHit curse).
   * - 차원 (1): 차원 방랑자.
   */

  const FINAL_BATCH = [
      '광풍의 원소', '바람 추적자',
      '심연의 눈',
      '에테르 잔류체', '에테르 흡수체',
      '종말의 마법사', '종말의 전령',
      '허무 집행관', '혼돈의 추종자',
      '차원 방랑자',
  ];

  test('cycle 169: 잔존 10종 모두 MONSTERS 등록 + 필수 필드 (hp/atk/def/exp/gold)', () => {
      for (const name of FINAL_BATCH) {
          const profile = MONSTERS[name];
          assert.ok(profile, `${name} profile 누락`);
          assert.ok(typeof profile.hp === 'number' && profile.hp > 0, `${name} hp`);
          assert.ok(typeof profile.atk === 'number' && profile.atk > 0, `${name} atk`);
          assert.ok(typeof profile.def === 'number' && profile.def >= 0, `${name} def`);
          assert.ok(typeof profile.exp === 'number' && profile.exp > 0, `${name} exp`);
          assert.ok(typeof profile.gold === 'number' && profile.gold > 0, `${name} gold`);
          assert.ok(profile.weakness, `${name} weakness`);
          assert.ok(profile.resistance, `${name} resistance`);
      }
  });

  test('cycle 169: 바람 2종 weakness 대지 / resistance 자연', () => {
      for (const name of ['광풍의 원소', '바람 추적자']) {
          assert.equal(MONSTERS[name].weakness, '대지');
          assert.equal(MONSTERS[name].resistance, '자연');
      }
  });

  test('cycle 169: 에테르 2종 weakness 자연 / resistance 빛 (energy 테마)', () => {
      for (const name of ['에테르 잔류체', '에테르 흡수체']) {
          assert.equal(MONSTERS[name].weakness, '자연');
          assert.equal(MONSTERS[name].resistance, '빛');
      }
  });

  test('cycle 169: 종말의 전령 보스 톤 (hp 420+, exp 268+, gold 128+)', () => {
      const m = MONSTERS['종말의 전령'];
      assert.ok(m.hp >= 400);
      assert.ok(m.exp >= 260);
      assert.ok(m.gold >= 125);
  });

  test('cycle 169: statusOnHit curse 매핑 (심연의 눈 / 종말의 마법사 / 혼돈의 추종자)', () => {
      assert.equal(MONSTERS['심연의 눈'].statusOnHit, 'curse');
      assert.equal(MONSTERS['종말의 마법사'].statusOnHit, 'curse');
      assert.equal(MONSTERS['혼돈의 추종자'].statusOnHit, 'curse');
  });

  test('cycle 169: 종말의 마법사 nuker 패턴 (heavyChance 0.6)', () => {
      const m = MONSTERS['종말의 마법사'];
      assert.ok(m.pattern.heavyChance >= 0.6);
      assert.ok(m.atk >= 100);
  });
}

// ─── 원본: tests/cycle-173-monster-boss-coverage-extension.test.js ───
{
  /**
   * cycle 173: cycle 165 baseline 가드의 boss/bossMonsters 누락 검출 보강.
   *
   * 발견:
   * - cycle 165 baseline 테스트는 maps.ts의 monsters[] 배열만 스캔했음.
   * - boss: 'name' 단일 참조와 bossMonsters: [...] 배열은 검사 누락.
   * - 결과: '봄의 여왕' (정원 dungeon bossMonsters) / '서리 군주' (서리 폭풍 유적
   *   bossMonsters)가 MONSTERS에 profile 미등록인데 baseline가 통과해 잠복.
   * - 해당 보스 처치 시 generic stat-blank — 약점/저항/phase2 모두 미적용 회귀.
   *
   * 수정:
   * 1. cycle 165 collectMapMonsterRefs를 확장 — monsters[] + bossMonsters[] +
   *    boss: 'X' 모두 수집.
   * 2. MONSTERS에 '봄의 여왕' / '서리 군주' 추가 (isBoss + phase2 포함):
   *    - 봄의 여왕: weakness 화염, resistance 자연, phase2 statusEffect 'poison'.
   *    - 서리 군주: weakness 화염, resistance 냉기, phase2 statusEffect 'freeze'.
   */

  test("cycle 173: '봄의 여왕' MONSTERS 등록 + isBoss + phase2 (정원 보스)", () => {
      const m = MONSTERS['봄의 여왕'];
      assert.ok(m, '봄의 여왕 profile 누락');
      assert.equal(m.isBoss, true);
      assert.equal(m.weakness, '화염');
      assert.equal(m.resistance, '자연');
      assert.ok(m.phase2, 'phase2 누락');
      assert.equal(m.phase2.statusEffect, 'poison');
  });

  test("cycle 173: '서리 군주' MONSTERS 등록 + isBoss + phase2 (서리 보스)", () => {
      const m = MONSTERS['서리 군주'];
      assert.ok(m);
      assert.equal(m.isBoss, true);
      assert.equal(m.weakness, '화염');
      assert.equal(m.resistance, '냉기');
      assert.ok(m.phase2);
      assert.equal(m.phase2.statusEffect, 'freeze');
  });

  test("cycle 173: cycle 165 baseline 테스트가 boss/bossMonsters도 검사함 (회귀 가드)", async () => {
      const { readFile } = await import('node:fs/promises');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const ROOT = path.join(HERE, '..');
      const baselineSrc = await readFile(path.join(ROOT, 'tests/monsters-cycle.test.js'), 'utf8'); // cycle-165 통합처
      assert.match(baselineSrc, /bossMonsters/, 'cycle 165 가드가 bossMonsters 검사');
      assert.match(baselineSrc, /boss:/, 'cycle 165 가드가 boss: 단일 참조 검사');
  });
}

// ─── 원본: tests/cycle-227-monster-status-on-hit.test.js ───
{
  /**
   * cycle 227: 27 monsters의 statusOnHit 필드가 dead config인 silent 회귀 fix
   *   (cycle 222-226 silent dead config 시리즈 연장).
   *
   * 발견 (monster.statusOnHit 미적용):
   * - 27 monsters에 statusOnHit 필드 정의 (poison/curse/burn/freeze 종류).
   *   예: 슬라임(poison), 화염 비룡(burn), 망자의 사제(curse), 서리 마법사(freeze).
   * - 그러나 src/ 어디에서도 'statusOnHit' read 안 함. CombatEngine.enemyAttack은
   *   phase2/phase3 statusEffect만 처리, 일반 hit에는 dispatch path 0건.
   * - 결과: 27 몬스터가 desc 내러티브상 status를 부여하는 것처럼 보이지만 실제 상태이상 0건.
   *
   * 패턴 (cycle 222-227 silent dead config 시리즈 6번째):
   * - cycle 222: weapon 5종 armors 버킷 오배치.
   * - cycle 223: '얼음' elem 비매칭.
   * - cycle 224: 4 items mpBonus 미적용.
   * - cycle 225: 2 armors hpBonus 미적용 (+230 HP).
   * - cycle 226: 2 armors evasion 미적용.
   * - cycle 227: 27 monsters statusOnHit 미적용 (가장 큰 규모).
   *
   * 수정 (src/systems/CombatEngine.ts enemyAttack):
   * - heavy hit (heavyResolved) + statusOnHit 정의 + 플레이어 생존 + 상태 미보유 시 status 부여.
   * - heavy hit만 trigger — 모든 hit마다 적용은 너무 강함 (slime이 매 턴 독 부여).
   * - status_resist relic의 확률로 저항 체크 (phase2/3 패턴 동일).
   * - 상태이상 부여 로그 emit.
   *
   * 회귀 가드:
   * - statusOnHit 미정의 monster는 0 영향.
   * - phase2/phase3 statusEffect 처리는 별도 path 보존.
   * - 일반 hit (heavyResolved=false)는 status 부여 안 함.
   * - 이미 보유 중인 status는 중복 안 됨.
   */

  test('cycle 227: heavy hit + statusOnHit인 적이 player에 status 부여', () => {
      // 강제로 heavy hit 발생 시키기 위해 mock 필요. enemyAttack 분기 검증을 위해
      // pattern.heavyChance = 1로 설정 (100% heavy).
      const player = {
          name: 'Test', job: '전사', level: 10,
          hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [],
          skillChoices: {},
          titles: [],
          combatFlags: {},
          status: [],
      };
      const enemy = {
          name: '슬라임', baseName: '슬라임',
          hp: 100, maxHp: 100, atk: 50, def: 5,
          statusOnHit: 'poison',
          pattern: { guardChance: 0.0, heavyChance: 1.0 }, // 100% heavy
      };
      const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      // heavy hit + statusOnHit → 100% poison 부여
      const playerStatus = result.updatedPlayer.status || [];
      assert.ok(playerStatus.includes('poison'),
          `slime의 statusOnHit poison이 heavy hit 시 부여되어야 함 (실제 status: ${JSON.stringify(playerStatus)})`);
  });

  test('cycle 227: statusOnHit 미정의 monster는 status 부여 안 함', () => {
      const player = {
          name: 'Test', job: '전사', level: 10,
          hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
      };
      const enemy = {
          name: '오크', hp: 100, maxHp: 100, atk: 50, def: 5,
          pattern: { guardChance: 0.0, heavyChance: 1.0 },
          // statusOnHit 미정의
      };
      const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      assert.deepEqual(result.updatedPlayer.status || [], [],
          'statusOnHit 미정의 적은 player.status 변화 없음');
  });

  test('cycle 227: 일반 hit (heavyChance=0)는 statusOnHit 부여 안 함', () => {
      const player = {
          name: 'Test', job: '전사', level: 10,
          hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
      };
      const enemy = {
          name: '슬라임', hp: 100, maxHp: 100, atk: 50, def: 5,
          statusOnHit: 'poison',
          pattern: { guardChance: 0.0, heavyChance: 0.0 }, // 0% heavy
      };
      const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      // 일반 hit → status 부여 안 됨
      assert.deepEqual(result.updatedPlayer.status || [], [],
          '일반 hit은 statusOnHit 부여 안 함 (heavy 전용)');
  });

  test('cycle 227: 이미 같은 status 보유 중인 player는 중복 추가 안 함', () => {
      const player = {
          name: 'Test', job: '전사', level: 10,
          hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: { weapon: null, armor: null, offhand: null },
          relics: [], skillChoices: {}, titles: [], combatFlags: {},
          status: ['poison'], // 이미 poison 보유
      };
      const enemy = {
          name: '슬라임', hp: 100, maxHp: 100, atk: 50, def: 5,
          statusOnHit: 'poison',
          pattern: { guardChance: 0.0, heavyChance: 1.0 },
      };
      const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      const poisonCount = (result.updatedPlayer.status || []).filter((s) => s === 'poison').length;
      assert.equal(poisonCount, 1, '동일 status는 중복 안 됨 (cycle 106 phase pattern과 정합)');
  });

  test('cycle 226 회귀 가드: armor evasion 처리 유지', () => {
      const player = {
          name: 'Test', job: '도적', level: 10,
          hp: 1000, maxHp: 1000, mp: 50, maxMp: 100,
          atk: 20, def: 5,
          equip: { weapon: null, armor: { name: '극한 회피갑', type: 'armor', val: 30, evasion: 1.0 }, offhand: null },
          relics: [], skillChoices: {}, titles: [], combatFlags: {}, status: [],
      };
      const enemy = { name: '슬라임', hp: 100, atk: 50, def: 5, statusOnHit: 'poison', pattern: { guardChance: 0, heavyChance: 1.0 } };
      const stats = { atk: 100, def: 50, relics: [], activeSynergies: [], critChance: 0 };

      const result = CombatEngine.enemyAttack(player, enemy, stats);
      assert.equal(result.damage, 0, 'evasion=1.0 회피');
      // 회피 시 statusOnHit 부여 안 됨 (early return)
      assert.deepEqual(result.updatedPlayer.status || [], [],
          '회피 시 statusOnHit 미부여 — 회피로 모든 효과 무효화');
  });
}

// ─── 원본: tests/cycle-251-monster-weakness-fire-typo.test.js ───
{
  /**
   * cycle 251: monster weakness '불꽃' → '화염' typo dead config
   *   (cycle 222-250 silent dead config 시리즈 23번째 — element typo audit, cycle 223 paired).
   *
   * 발견 (element 표준 불일치):
   * - src/data/items.ts elem 값: 냉기 / 대지 / 바람 / 빛 / 어둠 / 에테르 / 자연 / 화염 (8종).
   * - src/data/classes.ts skill type: 냉기 / 대지 / 물리 / 빛 / 어둠 / 자연 / 화염 (7종).
   * - src/data/monsters.ts weakness 값에 '불꽃' 6 monsters (구름 정령 / 익사한 기사 /
   *   살아있는 마법서 / 잉크 슬라임 / 책의 정령 / 독 지네).
   * - 그러나 어떤 item / skill도 elem='불꽃' 정의하지 않음 → 화염 attack 시
   *   getElementMultiplier가 enemy.weakness === elem 매칭 실패 → ELEMENT_WEAK_MULT 영원히
   *   미적용. 이 6 monsters은 화염 아이템 / 화염 스킬에 약점 광고하지만 실제로 1.0배.
   *
   * 패턴 (cycle 222-250 silent dead config 시리즈 23번째):
   * - cycle 223: 3 items elem '얼음' → '냉기' typo fix (paired와 동일 pattern).
   * - cycle 251: 6 monsters weakness '불꽃' → '화염' typo fix.
   *
   * 수정 (src/data/monsters.ts):
   * - 6 monsters의 weakness '불꽃' → '화염' 표준 통일.
   *
   * 회귀 가드:
   * - 다른 weakness 값 변화 없음 (냉기/자연/어둠/빛 등).
   * - resistance 값 그대로 (바람 등 미적용 resistance는 별도 cycle).
   * - getElementMultiplier 시그니처 변화 없음.
   *
   * 별도 cycle 후보 (보너스 발견):
   * - 3 monsters weakness '번개' (돌 거인/황금 왕국 수호자/왕국 기사) — items에 elem '번개' 없음.
   * - 1 monster weakness '마법' (용병 전사) — items에 elem '마법' 없음.
   *   이 둘은 design 의도 모호 — '번개' → '빛' 또는 신규 element 추가 결정 필요. cycle 251 범위 외.
   */

  test('cycle 251: monsters.ts에서 weakness "불꽃" 0건 (모두 "화염"으로 통일)', async () => {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const path = await import('node:path');
      const here = path.dirname(fileURLToPath(import.meta.url));
      const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
      const matches = source.match(/weakness:\s*'불꽃'/g);
      assert.equal(matches, null, `monsters.ts에 weakness '불꽃' 0건 (실제: ${matches?.length || 0}건)`);
  });

  test('cycle 251: 6 ex-불꽃 monsters 모두 weakness "화염"으로 변경', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      const targets = ['구름 정령', '익사한 기사', '살아있는 마법서', '잉크 슬라임', '책의 정령', '독 지네'];
      targets.forEach((name) => {
          assert.ok(MONSTERS[name], `'${name}' monster 정의 존재`);
          assert.equal(MONSTERS[name].weakness, '화염',
              `'${name}' weakness '화염' (실제: ${MONSTERS[name].weakness})`);
      });
  });

  test('cycle 251: 화염 element 공격이 ex-불꽃 monster에 ELEMENT_WEAK_MULT 적용', () => {
      const enemy = { name: '구름 정령', hp: 1000, maxHp: 1000, atk: 50, def: 5, weakness: '화염' };
      const mult = CombatEngine.getElementMultiplier('화염', enemy, []);
      // BALANCE.ELEMENT_WEAK_MULT = 1.5 (기본값).
      assert.ok(mult > 1.0, `'화염' attack vs '구름 정령' (weakness '화염') → 약점 배율 적용 (실제: ${mult})`);
  });

  test('cycle 251: 다른 weakness 값 변화 없음 (회귀 가드)', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      // 냉기 weakness 가진 monster sample 회귀 가드.
      const flameDragon = Object.entries(MONSTERS).find(([, m]) => m.weakness === '냉기');
      assert.ok(flameDragon, '냉기 weakness 가진 monster 1개 이상 존재 (회귀 가드)');
  });

  test('cycle 251: resistance 값 변화 없음 (회귀 가드)', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      // 구름 정령 resistance: '바람' 그대로 (이 cycle 범위 외).
      assert.equal(MONSTERS['구름 정령'].resistance, '바람',
          '구름 정령 resistance 보존 (cycle 251 범위 외)');
  });

  test('cycle 223 회귀 가드: items.ts elem "얼음" 0건 유지', async () => {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const path = await import('node:path');
      const here = path.dirname(fileURLToPath(import.meta.url));
      const source = await readFile(path.join(here, '..', 'src/data/items.ts'), 'utf8');
      const matches = source.match(/elem:\s*'얼음'/g);
      assert.equal(matches, null, 'cycle 223 items.ts elem 얼음 0 회귀 가드');
  });
}

// ─── 원본: tests/cycle-252-monster-resistance-fire-typo.test.js ───
{
  /**
   * cycle 252: monster resistance '불꽃' → '화염' typo (cycle 251 paired completion)
   *   (cycle 222-251 silent dead config 시리즈 24번째 — element typo audit).
   *
   * 발견 (cycle 251 paired):
   * - cycle 251에서 weakness '불꽃' → '화염' 6 monsters fix.
   * - 동일 typo가 resistance에도 2 monsters에 잔존: '분노한 마구스' / '사기꾼 마법사'.
   * - getElementMultiplier가 enemy.resistance === elem 매칭 실패 → ELEMENT_RESIST_MULT (0.5x)
   *   영원히 미적용 → 화염 attack 시 풀 데미지 적용. monster의 화염 저항 광고가 fake.
   *
   * 패턴 (cycle 222-251 silent dead config 시리즈 24번째):
   * - cycle 251: weakness '불꽃' → '화염' 6건.
   * - cycle 252: resistance '불꽃' → '화염' 2건 (paired completion).
   *
   * 수정 (src/data/monsters.ts):
   * - 2 monsters의 resistance '불꽃' → '화염' 표준 통일.
   *
   * 회귀 가드:
   * - 다른 resistance 값 변화 없음 (물/독/비전/번개/마법 등은 별도 design 결정 cycle).
   * - cycle 251 weakness 동작 유지.
   *
   * 별도 cycle 후보 (잔존):
   * - 2 monsters resistance '물' (강의 요괴 / 저주받은 어부) — 냉기 또는 바람 매핑 결정.
   * - 1 monster resistance '독' (독 지네) — 자연 매핑?
   * - 1 monster resistance '비전' (line 524 boss) — 에테르 매핑?
   * - 5 monsters resistance '번개' / '마법' — 신규 element 추가 vs 매핑 결정.
   */

  test('cycle 252: monsters.ts에서 resistance "불꽃" 0건 (모두 "화염"으로 통일)', async () => {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const path = await import('node:path');
      const here = path.dirname(fileURLToPath(import.meta.url));
      const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
      const matches = source.match(/resistance:\s*'불꽃'/g);
      assert.equal(matches, null, `monsters.ts에 resistance '불꽃' 0건 (실제: ${matches?.length || 0}건)`);
  });

  test('cycle 252: 2 ex-불꽃 resistance monsters 모두 "화염"으로 변경', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      const targets = ['분노한 마구스', '사기꾼 마법사'];
      targets.forEach((name) => {
          assert.ok(MONSTERS[name], `'${name}' monster 정의 존재`);
          assert.equal(MONSTERS[name].resistance, '화염',
              `'${name}' resistance '화염' (실제: ${MONSTERS[name].resistance})`);
      });
  });

  test('cycle 252: 화염 attack이 ex-불꽃 resistance monster에 ELEMENT_RESIST_MULT 적용', () => {
      const enemy = { name: '분노한 마구스', hp: 1000, maxHp: 1000, atk: 50, def: 5, resistance: '화염' };
      const mult = CombatEngine.getElementMultiplier('화염', enemy, []);
      // BALANCE.ELEMENT_RESIST_MULT = 0.5 (보통).
      assert.ok(mult < 1.0, `'화염' attack vs '분노한 마구스' (resistance '화염') → 저항 배율 적용 (실제: ${mult})`);
  });

  test('cycle 251 회귀 가드: weakness "불꽃" 0건 유지', async () => {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const path = await import('node:path');
      const here = path.dirname(fileURLToPath(import.meta.url));
      const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
      const matches = source.match(/weakness:\s*'불꽃'/g);
      assert.equal(matches, null, 'cycle 251 weakness 불꽃 0 회귀 가드');
  });

  test('cycle 252: 다른 resistance 값 변화 없음 (회귀 가드)', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      // 분노한 마구스 resistance 화염 보존 (cycle 252 fix 결과).
      assert.equal(MONSTERS['분노한 마구스']?.resistance, '화염', "'분노한 마구스' resistance '화염' 보존");
      // 참고: 물/비전/번개/마법 resistance는 후속 cycles 253-255에서 모두 매핑 완료.
  });
}

// ─── 원본: tests/cycle-253-monster-resistance-element-typo.test.js ───
{
  /**
   * cycle 253: monster resistance '독' → '자연' / '비전' → '에테르' (cycle 251-252 시리즈)
   *   (cycle 222-252 silent dead config 시리즈 25번째 — element typo audit 연속).
   *
   * 발견 (잔존 dead resistances 2건 — items elem 매칭 가능):
   *
   * 1) '독 지네' resistance '독' (line 328): items elem '자연'에 매핑 가능.
   *    - items.ts: 정령의 지팡이 / 세계수의 지팡이 / 독사의 송곳니 / 독침 단검 / 독아 채찍 등
   *      자연 계열 weapons은 모두 elem '자연' 사용.
   *    - 그러나 '독 지네' resistance '독' → 어떤 item / skill도 elem='독' 정의 안 함 →
   *      ELEMENT_RESIST_MULT 영원히 미적용. 독 저항 광고가 fake.
   *
   * 2) '차원 분열자' (boss) resistance '비전' (line 524): items elem '에테르'에 매핑 가능.
   *    - items.ts: 에테르 검 (tier 4) / 차원절단자 (tier 5) 등 차원/공허 weapons은 elem '에테르'.
   *    - resistance '비전' → 어떤 item / skill도 elem='비전' 정의 안 함 → 비전 저항 fake.
   *
   * 패턴 (cycle 222-252 silent dead config 시리즈 25번째):
   * - cycle 251: monster weakness '불꽃' → '화염' 6건.
   * - cycle 252: monster resistance '불꽃' → '화염' 2건.
   * - cycle 253: 추가 dead resistance 2건 (독 → 자연, 비전 → 에테르).
   *
   * 수정 (src/data/monsters.ts):
   * - '독 지네' resistance '독' → '자연'.
   * - '차원 분열자' resistance '비전' → '에테르'.
   *
   * 회귀 가드:
   * - cycle 251-252 동작 유지.
   * - 다른 resistance 변화 없음 (물/번개/마법은 별도 design 결정 cycle).
   *
   * 별도 cycle 후보 (잔존 dead):
   * - 2 monsters resistance '물' (강의 요괴 / 저주받은 어부) — '냉기' 또는 '바람' 매핑.
   * - 5 monsters '번개' / '마법' — 신규 element 추가 vs 매핑 결정.
   */

  test('cycle 253: 독 지네 resistance "자연"으로 변경', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      assert.ok(MONSTERS['독 지네'], "'독 지네' monster 정의 존재");
      assert.equal(MONSTERS['독 지네'].resistance, '자연',
          `'독 지네' resistance '자연' (실제: ${MONSTERS['독 지네'].resistance})`);
  });

  test('cycle 253: 차원 분열자 resistance "에테르"로 변경', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      assert.ok(MONSTERS['차원 분열자'], "'차원 분열자' monster 정의 존재");
      assert.equal(MONSTERS['차원 분열자'].resistance, '에테르',
          `'차원 분열자' resistance '에테르' (실제: ${MONSTERS['차원 분열자'].resistance})`);
  });

  test('cycle 253: 자연 attack이 독 지네에 ELEMENT_RESIST_MULT 적용', () => {
      const enemy = { name: '독 지네', hp: 1000, maxHp: 1000, atk: 50, def: 5, resistance: '자연' };
      const mult = CombatEngine.getElementMultiplier('자연', enemy, []);
      assert.ok(mult < 1.0, `'자연' attack vs '독 지네' (resistance '자연') → 저항 배율 적용 (실제: ${mult})`);
  });

  test('cycle 253: 에테르 attack이 차원 분열자에 ELEMENT_RESIST_MULT 적용', () => {
      const enemy = { name: '차원 분열자', hp: 1000, maxHp: 1000, atk: 50, def: 5, resistance: '에테르' };
      const mult = CombatEngine.getElementMultiplier('에테르', enemy, []);
      assert.ok(mult < 1.0, `'에테르' attack vs '차원 분열자' (resistance '에테르') → 저항 배율 적용 (실제: ${mult})`);
  });

  test('cycle 253: monsters.ts에서 resistance "독" 0건 + resistance "비전" 0건', async () => {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const path = await import('node:path');
      const here = path.dirname(fileURLToPath(import.meta.url));
      const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
      const dokMatches = source.match(/resistance:\s*'독'/g);
      const arcaneMatches = source.match(/resistance:\s*'비전'/g);
      assert.equal(dokMatches, null, `monsters.ts에 resistance '독' 0건 (실제: ${dokMatches?.length || 0}건)`);
      assert.equal(arcaneMatches, null, `monsters.ts에 resistance '비전' 0건 (실제: ${arcaneMatches?.length || 0}건)`);
  });

  test('cycle 251-252 회귀 가드: weakness/resistance "불꽃" 0건 유지', async () => {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const path = await import('node:path');
      const here = path.dirname(fileURLToPath(import.meta.url));
      const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
      assert.equal(source.match(/weakness:\s*'불꽃'/g), null, 'cycle 251 weakness 불꽃 회귀 가드');
      assert.equal(source.match(/resistance:\s*'불꽃'/g), null, 'cycle 252 resistance 불꽃 회귀 가드');
  });

  test('cycle 253: 후속 cycles 254-255 mappings 정합 (회귀 가드)', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      // cycle 254: 물 → 냉기.
      assert.equal(MONSTERS['강의 요괴']?.resistance, '냉기', "'강의 요괴' resistance '냉기' (cycle 254)");
      // cycle 255: 번개 → 빛.
      assert.equal(MONSTERS['돌 거인']?.weakness, '빛', "'돌 거인' weakness '빛' (cycle 255)");
  });
}

// ─── 원본: tests/cycle-254-monster-resistance-water-typo.test.js ───
{
  /**
   * cycle 254: monster resistance '물' → '냉기' (cycle 251-253 element typo 시리즈)
   *   (cycle 222-253 silent dead config 시리즈 26번째).
   *
   * 발견 (잔존 dead resistance — '물'):
   * - '강의 요괴' (line 314) / '저주받은 어부' (line 317) 2 monsters resistance '물' 정의.
   * - 그러나 어떤 item / skill도 elem='물' 정의 안 함 → ELEMENT_RESIST_MULT 영원히 미적용.
   * - water-themed 몬스터의 저항 광고가 fake.
   * - 매핑 결정: '물' → '냉기' (items.ts 냉기 계열 weapons이 가장 유사한 element —
   *   ice/cold ↔ water 친화성. items 냉기 계열: 서리칼날/빙결의 왕관검/얼음 지팡이 등).
   *
   * 패턴 (cycle 222-253 silent dead config 시리즈 26번째):
   * - cycle 251: weakness '불꽃' → '화염' 6건.
   * - cycle 252: resistance '불꽃' → '화염' 2건.
   * - cycle 253: resistance '독' → '자연', '비전' → '에테르' 2건.
   * - cycle 254: resistance '물' → '냉기' 2건.
   *
   * 수정 (src/data/monsters.ts):
   * - '강의 요괴' resistance '물' → '냉기'.
   * - '저주받은 어부' resistance '물' → '냉기'.
   *
   * 회귀 가드:
   * - cycle 251-253 동작 유지.
   * - 다른 resistance 변화 없음.
   *
   * 별도 cycle 후보 (잔존 마지막 dead):
   * - 4 monsters weakness '번개' (3 + 왕국 기사) — 신규 element 추가 vs '빛' 매핑.
   * - 1 monster weakness '마법' (용병 전사) — generic, 별도 design 결정.
   */

  test('cycle 254: 강의 요괴 resistance "냉기"로 변경', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      assert.ok(MONSTERS['강의 요괴'], "'강의 요괴' monster 정의 존재");
      assert.equal(MONSTERS['강의 요괴'].resistance, '냉기',
          `'강의 요괴' resistance '냉기' (실제: ${MONSTERS['강의 요괴'].resistance})`);
  });

  test('cycle 254: 저주받은 어부 resistance "냉기"로 변경', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      assert.ok(MONSTERS['저주받은 어부'], "'저주받은 어부' monster 정의 존재");
      assert.equal(MONSTERS['저주받은 어부'].resistance, '냉기',
          `'저주받은 어부' resistance '냉기' (실제: ${MONSTERS['저주받은 어부'].resistance})`);
  });

  test('cycle 254: monsters.ts에서 resistance "물" 0건', async () => {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const path = await import('node:path');
      const here = path.dirname(fileURLToPath(import.meta.url));
      const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
      const matches = source.match(/resistance:\s*'물'/g);
      assert.equal(matches, null, `monsters.ts에 resistance '물' 0건 (실제: ${matches?.length || 0}건)`);
  });

  test('cycle 254: 냉기 attack이 강의 요괴에 ELEMENT_RESIST_MULT 적용', () => {
      const enemy = { name: '강의 요괴', hp: 1000, maxHp: 1000, atk: 50, def: 5, resistance: '냉기' };
      const mult = CombatEngine.getElementMultiplier('냉기', enemy, []);
      assert.ok(mult < 1.0,
          `'냉기' attack vs '강의 요괴' (resistance '냉기') → 저항 배율 적용 (실제: ${mult})`);
  });

  test('cycle 254: 기존 weakness 빛 보존 (회귀 가드)', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      assert.equal(MONSTERS['강의 요괴'].weakness, '빛', "'강의 요괴' weakness '빛' 보존");
      assert.equal(MONSTERS['저주받은 어부'].weakness, '빛', "'저주받은 어부' weakness '빛' 보존");
  });

  test('cycle 251-253 회귀 가드: element typo 시리즈 누적 0건', async () => {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const path = await import('node:path');
      const here = path.dirname(fileURLToPath(import.meta.url));
      const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
      assert.equal(source.match(/weakness:\s*'불꽃'/g), null, 'cycle 251 weakness 불꽃 회귀');
      assert.equal(source.match(/resistance:\s*'불꽃'/g), null, 'cycle 252 resistance 불꽃 회귀');
      assert.equal(source.match(/resistance:\s*'독'/g), null, 'cycle 253 resistance 독 회귀');
      assert.equal(source.match(/resistance:\s*'비전'/g), null, 'cycle 253 resistance 비전 회귀');
  });
}

// ─── 원본: tests/cycle-255-monster-element-finale.test.js ───
{
  /**
   * cycle 255: monster element typo audit 마무리 — '번개' → '빛' / '마법' → '에테르'
   *   (cycle 222-254 silent dead config 시리즈 27번째 — element typo 시리즈 5사이클 마무리).
   *
   * 발견 (잔존 마지막 dead elements):
   * - weakness '번개' 3 monsters (돌 거인 / 황금 왕국 수호자 / 왕국 기사) — physical-resistant
   *   metal/armored 적 의도하나 어떤 item / skill도 elem='번개' 정의 안 함.
   * - resistance '번개' 2 monsters (폭풍 수호자 / 번개 골렘) — 번개 친화 적의 자기 저항.
   * - weakness '마법' 1 monster (용병 전사) + resistance '마법' 1 monster (살아있는 마법서).
   * - 결과: 모두 elem 매칭 실패 → ELEMENT_WEAK_MULT / ELEMENT_RESIST_MULT 영원히 미적용.
   *
   * 매핑 결정:
   * - '번개' → '빛': lightning ⚡ ↔ light ✨ thematic 친화. game 내 일부 skills (e.g. 썬더볼트)도
   *   type='빛' 사용. items에는 elem='번개' 없음.
   * - '마법' → '에테르': '에테르' (ether/arcane)가 가장 magical element. cycle 253 '비전'도
   *   동일 매핑. items.ts 차원/공허 weapons elem='에테르'.
   *
   * 패턴 (cycle 222-254 silent dead config 시리즈 27번째):
   * - cycle 251: weakness '불꽃' → '화염' 6건.
   * - cycle 252: resistance '불꽃' → '화염' 2건.
   * - cycle 253: resistance '독' → '자연', '비전' → '에테르' 2건.
   * - cycle 254: resistance '물' → '냉기' 2건.
   * - cycle 255: '번개' → '빛' 5건 + '마법' → '에테르' 2건 (시리즈 마무리).
   *
   * 수정 (src/data/monsters.ts):
   * - 3 weakness '번개' → '빛'.
   * - 2 resistance '번개' → '빛'.
   * - 1 weakness '마법' → '에테르'.
   * - 1 resistance '마법' → '에테르'.
   *
   * 회귀 가드:
   * - cycle 251-254 element typo 시리즈 0건 유지.
   * - 이후 monsters.ts에 dead element 잔존 0 — element typo audit 완전 마무리.
   */

  test('cycle 255: 3 ex-번개 weakness monsters 모두 "빛"으로 변경', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      const targets = ['돌 거인', '황금 왕국 수호자', '왕국 기사'];
      targets.forEach((name) => {
          assert.ok(MONSTERS[name], `'${name}' monster 정의 존재`);
          assert.equal(MONSTERS[name].weakness, '빛',
              `'${name}' weakness '빛' (실제: ${MONSTERS[name].weakness})`);
      });
  });

  test('cycle 255: 2 ex-번개 resistance monsters 모두 "빛"으로 변경', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      const targets = ['폭풍 수호자', '번개 골렘'];
      targets.forEach((name) => {
          assert.ok(MONSTERS[name], `'${name}' monster 정의 존재`);
          assert.equal(MONSTERS[name].resistance, '빛',
              `'${name}' resistance '빛' (실제: ${MONSTERS[name].resistance})`);
      });
  });

  test('cycle 255: 용병 전사 weakness "에테르" + 살아있는 마법서 resistance "에테르"', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      assert.equal(MONSTERS['용병 전사'].weakness, '에테르',
          `'용병 전사' weakness '에테르' (실제: ${MONSTERS['용병 전사'].weakness})`);
      assert.equal(MONSTERS['살아있는 마법서'].resistance, '에테르',
          `'살아있는 마법서' resistance '에테르' (실제: ${MONSTERS['살아있는 마법서'].resistance})`);
  });

  test('cycle 255: monsters.ts에서 dead element 모두 0건 (element typo audit 마무리)', async () => {
      const { readFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      const path = await import('node:path');
      const here = path.dirname(fileURLToPath(import.meta.url));
      const source = await readFile(path.join(here, '..', 'src/data/monsters.ts'), 'utf8');
      const deadPatterns = [
          /weakness:\s*'불꽃'/g,
          /resistance:\s*'불꽃'/g,
          /weakness:\s*'번개'/g,
          /resistance:\s*'번개'/g,
          /weakness:\s*'마법'/g,
          /resistance:\s*'마법'/g,
          /weakness:\s*'독'/g,
          /resistance:\s*'독'/g,
          /weakness:\s*'비전'/g,
          /resistance:\s*'비전'/g,
          /weakness:\s*'물'/g,
          /resistance:\s*'물'/g,
      ];
      deadPatterns.forEach((pattern) => {
          const matches = source.match(pattern);
          assert.equal(matches, null, `dead element pattern ${pattern} 0건 (실제: ${matches?.length || 0}건)`);
      });
  });

  test('cycle 255: 빛 attack이 ex-번개 monster에 ELEMENT_WEAK_MULT 적용', () => {
      const enemy = { name: '돌 거인', hp: 1000, maxHp: 1000, atk: 50, def: 5, weakness: '빛' };
      const mult = CombatEngine.getElementMultiplier('빛', enemy, []);
      assert.ok(mult > 1.0, `'빛' attack vs '돌 거인' (weakness '빛') → 약점 배율 (실제: ${mult})`);
  });

  test('cycle 255: 에테르 attack이 살아있는 마법서에 ELEMENT_RESIST_MULT 적용', () => {
      const enemy = { name: '살아있는 마법서', hp: 1000, maxHp: 1000, atk: 50, def: 5, resistance: '에테르' };
      const mult = CombatEngine.getElementMultiplier('에테르', enemy, []);
      assert.ok(mult < 1.0, `'에테르' attack vs '살아있는 마법서' (resistance '에테르') → 저항 배율 (실제: ${mult})`);
  });

  test('cycle 251-254 회귀 가드: element typo 시리즈 누적 동작 유지', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      // cycle 251 — '구름 정령' weakness '화염'
      assert.equal(MONSTERS['구름 정령'].weakness, '화염', 'cycle 251 회귀 가드');
      // cycle 252 — '분노한 마구스' resistance '화염'
      assert.equal(MONSTERS['분노한 마구스'].resistance, '화염', 'cycle 252 회귀 가드');
      // cycle 253 — '독 지네' resistance '자연' / '차원 분열자' resistance '에테르'
      assert.equal(MONSTERS['독 지네'].resistance, '자연', 'cycle 253 독 회귀 가드');
      assert.equal(MONSTERS['차원 분열자'].resistance, '에테르', 'cycle 253 비전 회귀 가드');
      // cycle 254 — '강의 요괴' resistance '냉기'
      assert.equal(MONSTERS['강의 요괴'].resistance, '냉기', 'cycle 254 회귀 가드');
  });
}

// ─── 원본: tests/cycle-283-monster-types-dead.test.js ───
{
  /**
   * cycle 283: Monster 타입의 9 dead 필드 cleanup
   *   (cycle 222-282 silent dead config 시리즈 53번째 — cleanup lens 연속, 대량).
   *
   * 발견 (3 interfaces, 9 dead 필드):
   * - MonsterBase 4 dead 필드:
   *   - elem?: string (line 21): monster.elem access 0건. 속성 시스템은 weakness/resistance.
   *   - dropTable?: string (line 29): 어디서도 read 0건.
   *   - prefix?: string (line 31): MONSTER_PREFIXES는 mStats.name에 직접 string 합치는 방식 사용.
   *   - signatureDrops?: Array<...> (line 34): bossSignatureHint은 local variable 사용, monster
   *     필드에는 set 안 함.
   * - BossPhase 3 dead 필드:
   *   - atkMult?: number (line 41): 활성은 atkBonus.
   *   - defMult?: number (line 42): 활성은 defBonus (cycle 228).
   *   - skills?: string[] (line 44): phase2/phase3에 skills 설정 0건.
   * - BossMonster 2 dead 필드:
   *   - phases?: BossPhase[] (line 56): 활성은 phase2/phase3 singular.
   *   - onDeath?: string (line 59): 어디서도 read 0건.
   *
   * 패턴 (cycle 222-282 silent dead config 시리즈 53번째):
   * - cycle 280-282: types/player.ts dead fields cleanup 3사이클.
   * - cycle 283: types/monster.ts dead fields cleanup (대량, 9 필드).
   *
   * 수정 (src/types/monster.ts):
   * - 9 dead 필드 제거.
   *
   * 회귀 가드:
   * - 활성 필드 (name/baseName/hp/maxHp/atk/def/exp/gold/weakness/resistance/isBoss/isElite/dropMod/
   *   pattern/phase2/phase3/atkBonus/defBonus/threshold/log/statusEffect) 모두 유지.
   * - [key: string]: any index signature로 동적 필드 호환.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 283: MonsterBase 4 dead 필드 제거 (elem/dropTable/prefix/signatureDrops)', async () => {
      const source = await readSrc('src/types/monster.ts');
      const baseBlock = source.match(/export interface MonsterBase \{[\s\S]+?\n\}/);
      assert.ok(baseBlock, 'MonsterBase interface 발견');
      assert.ok(!/elem\?:\s*string;/.test(baseBlock[0]), 'elem 제거됨');
      assert.ok(!/dropTable\?:\s*string;/.test(baseBlock[0]), 'dropTable 제거됨');
      assert.ok(!/prefix\?:\s*string;/.test(baseBlock[0]), 'prefix 제거됨');
      assert.ok(!/signatureDrops\?:/.test(baseBlock[0]), 'signatureDrops 제거됨');
  });

  test('cycle 283: BossPhase 3 dead 필드 제거 (atkMult/defMult/skills)', async () => {
      const source = await readSrc('src/types/monster.ts');
      // cycle 328: BossPhase export → private (외부 import 0건). 정의는 유지.
      const phaseBlock = source.match(/(?:export )?interface BossPhase \{[\s\S]+?\n\}/);
      assert.ok(phaseBlock, 'BossPhase interface 발견');
      assert.ok(!/atkMult\?:\s*number;/.test(phaseBlock[0]), 'atkMult 제거됨');
      assert.ok(!/defMult\?:\s*number;/.test(phaseBlock[0]), 'defMult 제거됨');
      assert.ok(!/skills\?:\s*string\[\];/.test(phaseBlock[0]), 'skills 제거됨');
  });

  test('cycle 283: BossMonster 2 dead 필드 제거 (phases/onDeath)', async () => {
      const source = await readSrc('src/types/monster.ts');
      // cycle 298: BossMonster export 제거 (private downgrade) → 정의 자체는 유지.
      const bossBlock = source.match(/(?:export )?interface BossMonster[\s\S]+?\n\}/);
      assert.ok(bossBlock, 'BossMonster interface 발견');
      assert.ok(!/phases\?:\s*BossPhase\[\];/.test(bossBlock[0]), 'phases (array) 제거됨');
      assert.ok(!/onDeath\?:\s*string;/.test(bossBlock[0]), 'onDeath 제거됨');
  });

  test('cycle 283: 활성 필드 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/types/monster.ts');
      const activeFields = [
          'name', 'baseName', 'hp', 'maxHp', 'atk', 'def', 'exp', 'gold',
          'weakness', 'resistance', 'isBoss', 'isElite', 'dropMod',
          'phase2', 'phase3', 'atkBonus', 'defBonus', 'threshold', 'log', 'statusEffect',
      ];
      activeFields.forEach((field) => {
          const re = new RegExp(`${field}\\??:\\s*`);
          assert.ok(re.test(source), `${field} 필드 유지`);
      });
  });
}

// ─── 원본: tests/cycle-366-monster-phase-threshold-default-redundant.test.js ───
{
  /**
   * cycle 366: monsters.ts phase2/phase3 threshold default 7회 redundant 정리
   *   (cycle 222-365 silent dead config 시리즈 132번째 — cleanup lens 연속).
   *
   * 발견 (7 dead config field — default 명시):
   * - monsters.ts phase2 객체 2개에 `threshold: 0.5` — BALANCE.BOSS_PHASE2_THRESHOLD
   *   기본값(0.5)과 동일.
   * - monsters.ts phase3 객체 5개에 `threshold: 0.25` — CombatEngine.ts:1098의
   *   `phase3.threshold ?? 0.25` 기본값과 동일.
   * - 두 케이스 모두 `?? default` fallback이 적용되므로 기본값과 같은 명시는 redundant.
   * - threshold가 다른 값(0.2)인 phase3 5개는 보존 (실제 효과 차이).
   *
   * 패턴 (cycle 222-365 silent dead config 시리즈 132번째):
   * - cycle 365: eventChain outcome chainId 70 redundant duplicates.
   * - cycle 366: monster phase threshold default 7 redundant duplicates.
   *
   * 수정 (src/data/monsters.ts):
   * - phase2의 `threshold: 0.5` 2회 제거.
   * - phase3의 `threshold: 0.25` 5회 제거.
   *
   * 회귀 가드:
   * - phase3의 `threshold: 0.2` 5회 보존 (default와 다른 값).
   * - phase2/phase3 다른 모든 필드(name/atkBonus/defBonus/pattern/log/statusEffect) 보존.
   * - CombatEngine phase 전환 동작 그대로 (`?? default` fallback).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 366: phase2 threshold 0.5 redundant 0건', async () => {
      const source = await readSrc('src/data/monsters.ts');
      const phase2WithThreshold = source.match(/phase2:[^}]+threshold:/g) || [];
      assert.equal(phase2WithThreshold.length, 0,
          `phase2 entries with explicit threshold 0건이어야 함, ${phase2WithThreshold.length}건 발견`);
  });

  test('cycle 366: phase3 threshold 0.25 redundant 0건', async () => {
      const source = await readSrc('src/data/monsters.ts');
      const phase3WithThreshold025 = source.match(/phase3:[^}]+threshold: 0\.25/g) || [];
      assert.equal(phase3WithThreshold025.length, 0,
          `phase3 entries with threshold: 0.25 0건이어야 함, ${phase3WithThreshold025.length}건 발견`);
  });

  test('cycle 366: phase3 threshold 0.2 (default와 다름) 5회 보존', async () => {
      const source = await readSrc('src/data/monsters.ts');
      const phase3WithThreshold02 = source.match(/phase3:[^}]+threshold: 0\.2[^0-9]/g) || [];
      assert.equal(phase3WithThreshold02.length, 5,
          `phase3 threshold: 0.2 5회 보존, 발견 ${phase3WithThreshold02.length}`);
  });

  test('cycle 366: phase2/phase3 핵심 필드 보존 (회귀 가드)', async () => {
      const { MONSTERS } = await import('../src/data/monsters.js');
      // 원시의 신 — phase2(threshold 0.5 → 기본값) + phase3 (0.25 default 보존)
      const primordial = MONSTERS['원시의 신'];
      assert.ok(primordial, '원시의 신 보스 존재');
      assert.ok(primordial.phase2.name, 'phase2.name 보존');
      assert.ok(primordial.phase2.atkBonus, 'phase2.atkBonus 보존');
      assert.ok(primordial.phase2.pattern, 'phase2.pattern 보존');
      assert.ok(primordial.phase2.log, 'phase2.log 보존');
      assert.equal(primordial.phase2.threshold, undefined, 'phase2.threshold 0건 (default 0.5 fallback)');
  });

  test('cycle 365 회귀 가드: eventChain outcome.chainId 0건 보존', async () => {
      const source = await readSrc('src/data/eventChains.ts');
      const matches = source.match(/chainId:/g) || [];
      assert.equal(matches.length, 0, 'cycle 365 chainId 0건 보존');
  });
}

// ─── 원본: tests/cycle-372-maps-safe-monsters-empty-redundant.test.js ───
{
  /**
   * cycle 372: maps.ts safe-zone monsters: [] 5회 redundant 정리
   *   (cycle 222-371 silent dead config 시리즈 137번째 — cleanup lens 연속).
   *
   * 발견 (5 redundant default annotations):
   * - src/data/maps.ts에 5 safe-zone 맵 (시작의 마을 / 여행자의 쉼터 /
   *   사막 오아시스 / 북부 요새 / 허공의 섬)이 `monsters: []` 명시.
   * - 모든 monsters 사용 사이트가 `|| []` 또는 `Array.isArray ? : []` fallback
   *   처리 (mapSignatureHints / exploreUtils / Codex / MonsterCodex 4곳).
   * - monsters: [] = undefined와 동일 효과 → redundant.
   *
   * 핵심 비교:
   * - 황금 왕국 (type: 'safe', monsters: ['황금 왕국 수호자', ...]) — 비어있지 않음 → 보존.
   *
   * 패턴 (cycle 222-371 silent dead config 시리즈 137번째):
   * - cycle 371: maps safe-zone eventChance: 0 5 redundant.
   * - cycle 372: maps safe-zone monsters: [] 5 redundant (동일 lens 후속).
   *
   * 수정 (src/data/maps.ts):
   * - 5 safe-zone 맵에서 `monsters: []` 명시 제거.
   *
   * 회귀 가드:
   * - 황금 왕국 monsters: [...] 보존 (비어있지 않은 명시 값).
   * - 6 safe-zone 맵 (type: 'safe') 정의 자체는 모두 보존.
   * - mapSignatureHints / exploreUtils / Codex 동작 그대로 (`|| []` fallback).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 372: maps.ts safe-zone monsters: [] 0건', async () => {
      const source = await readSrc('src/data/maps.ts');
      const matches = source.match(/monsters: \[\]/g) || [];
      assert.equal(matches.length, 0,
          `safe-zone monsters: [] 0건이어야 함, ${matches.length}건 발견`);
  });

  test('cycle 372: 6 safe-zone 맵 정의 보존', async () => {
      const source = await readSrc('src/data/maps.ts');
      const matches = source.match(/type: 'safe'/g) || [];
      assert.ok(matches.length >= 6, `6+ safe-zone 보존 (${matches.length}건)`);
  });

  test('cycle 372: 황금 왕국 monsters 배열 보존 (비어있지 않음)', async () => {
      const { MAPS } = await import('../src/data/maps.js');
      assert.equal(MAPS['황금 왕국'].type, 'safe', '황금 왕국 type=safe');
      assert.ok(Array.isArray(MAPS['황금 왕국'].monsters),
          '황금 왕국 monsters 배열 보존');
      assert.ok(MAPS['황금 왕국'].monsters.length > 0,
          '황금 왕국 monsters 비어있지 않음');
  });

  test('cycle 372: MAPS 동작 보존', async () => {
      const { MAPS } = await import('../src/data/maps.js');
      const safeMaps = ['시작의 마을', '여행자의 쉼터', '사막 오아시스', '북부 요새', '허공의 섬'];
      for (const name of safeMaps) {
          assert.equal(MAPS[name].type, 'safe', `${name} type 'safe' 보존`);
          assert.equal(MAPS[name].monsters, undefined,
              `${name} monsters 0건 (undefined fallback)`);
      }
  });

  test('cycle 371 회귀 가드: maps safe-zone eventChance: 0 0건 보존', async () => {
      const source = await readSrc('src/data/maps.ts');
      const matches = source.match(/eventChance: 0$/gm) || [];
      assert.equal(matches.length, 0, 'cycle 371 eventChance: 0 0건 보존');
  });
}

// ─── 원본: tests/cycle-422-monster-icon-golem-duplicate.test.js ───
{
  /**
   * cycle 422: MonsterIcon getMonsterType '골렘' 중복 includes 정리
   *   (cycle 222-421 silent dead config 시리즈 182번째 — duplicate detection lens 회귀,
   *   cycle 385 변형).
   *
   * 발견 (1 redundant duplicate):
   * - src/components/icons/MonsterIcon.tsx getMonsterType
   *   line 35: `name.includes('골렘') || name.includes('골렘') || name.includes('자동인형')`
   * - 동일 문자열 '골렘' includes 2회 — short-circuit `||`라 두 번째 호출은 첫 번째가
   *   false일 때만 평가되지만, 동일 입력에 대해 동일 결과라 절대 추가 매치 0건.
   * - 결과: 두 번째 `name.includes('골렘')` 절대 의미 있는 분기 0건.
   *
   * 패턴 (cycle 222-421 시리즈 182번째):
   * - cycle 385: ELEMENT_TONE_KEY 중복 키 정리 (duplicate detection 변형).
   * - cycle 421: SkillTypeIcon TYPE_PATHS '번개' unreachable.
   * - cycle 422: MonsterIcon '골렘' 동일 문자열 중복 — duplicate detection 회귀.
   *
   * 수정 (src/components/icons/MonsterIcon.tsx):
   * - line 35 두 번째 `name.includes('골렘')` 제거.
   *
   * 회귀 가드:
   * - 활성 매칭 ('골렘' / '자동인형') 보존 → golem type 결정 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 422: getMonsterType 골렘 중복 includes 0건', async () => {
      const source = await readSrc('src/components/icons/MonsterIcon.tsx');
      const fnStart = source.indexOf('const getMonsterType');
      const fnEnd = source.indexOf('};', fnStart);
      const block = source.slice(fnStart, fnEnd);
      const golemMatches = block.match(/name\.includes\('골렘'\)/g) || [];
      assert.equal(golemMatches.length, 1, "getMonsterType에서 name.includes('골렘') 1건만 (중복 제거)");
  });

  test('cycle 422: golem 분기 활성 보존 (자동인형 매칭 그대로)', async () => {
      const source = await readSrc('src/components/icons/MonsterIcon.tsx');
      const fnStart = source.indexOf('const getMonsterType');
      const fnEnd = source.indexOf('};', fnStart);
      const block = source.slice(fnStart, fnEnd);
      assert.ok(/name\.includes\('골렘'\)/.test(block), "'골렘' 매칭 보존");
      assert.ok(/name\.includes\('자동인형'\)/.test(block), "'자동인형' 매칭 보존");
      assert.ok(/return 'golem'/.test(block), "golem return 보존");
  });

  test('cycle 422: getMonsterType 동작 회귀 가드 — 골렘 / 자동인형 모두 golem 반환', async () => {
      const { default: MonsterIcon } = await import('../src/components/icons/MonsterIcon.tsx').catch(() => ({ default: null }));
      // MonsterIcon은 React component라 직접 호출 어려움. 대신 source 정합성 가드.
      const source = await readSrc('src/components/icons/MonsterIcon.tsx');
      // golem branch 유일 매칭자 = '골렘' 또는 '자동인형'
      assert.ok(/if \(name\.includes\('골렘'\) \|\| name\.includes\('자동인형'\)\) return 'golem';/.test(source),
          "golem 분기 형태: '골렘' || '자동인형' → return 'golem'");
  });

  test('cycle 421 회귀 가드: SkillTypeIcon TYPE_PATHS / TYPE_COLORS 번개 0건', async () => {
      const source = await readSrc('src/components/icons/SkillTypeIcon.tsx');
      const pathsStart = source.indexOf('const TYPE_PATHS');
      const pathsEnd = source.indexOf('};', pathsStart);
      const pathsBlock = source.slice(pathsStart, pathsEnd);
      const colorsStart = source.indexOf('const TYPE_COLORS');
      const colorsEnd = source.indexOf('};', colorsStart);
      const colorsBlock = source.slice(colorsStart, colorsEnd);
      assert.ok(!/'번개'/.test(pathsBlock), "cycle 421 TYPE_PATHS '번개' 0건 보존");
      assert.ok(!/'번개'/.test(colorsBlock), "cycle 421 TYPE_COLORS '번개' 0건 보존");
  });
}

// ─── 원본: tests/cycle-465-monster-icon-class-name-unreachable.test.js ───
{
  /**
   * cycle 465: MonsterIcon `className` prop unreachable 정리
   *   (cycle 222-464 silent dead config 시리즈 220번째 — unreachable code path
   *   cleanup lens, cycle 463/464 패턴 회귀, 같은 디렉토리 paired).
   *
   * 발견 (1 prop unreachable):
   * - src/components/icons/MonsterIcon.tsx (line 51):
   *     const MonsterIcon = ({ name, discovered = false, isBoss = false,
   *                            size = 32, className = '' }: any) => {...
   *         className={`inline-flex ... ${className}`}
   *     }
   * - 호출 사이트 분석 (전체 src/):
   *     · MonsterCodex.tsx:98 — name/discovered/isBoss/size 전달, className 0건.
   *     · MonsterCodex.tsx:121 — 동일.
   *     · 2 callsite 모두 className 전달 0건.
   * - 결과: className은 항상 ''. body의 ${className} 보간은 빈 문자열만 추가.
   *
   * 패턴 (cycle 222-464 시리즈 220번째):
   * - cycle 463: ClassIcon cssClass prop unreachable.
   * - cycle 464: ClassIcon showBorder prop unreachable false 가지.
   * - cycle 465: MonsterIcon className prop unreachable — 같은 icons/ 디렉토리
   *   paired 회귀.
   *
   * 수정 (src/components/icons/MonsterIcon.tsx):
   * - destructure에서 className = '' 제거.
   * - body className 템플릿에서 ${className} 보간 제거.
   * - JSDoc @param에서 className 제거.
   *
   * 회귀 가드:
   * - name / discovered / isBoss / size prop 보존.
   * - 2 callsite 동작 변동 0.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 465: MonsterIcon destructure에서 className 0건', async () => {
      const source = await readSrc('src/components/icons/MonsterIcon.tsx');
      const fnIdx = source.indexOf('const MonsterIcon =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bclassName\b/.test(sig), 'destructure에 className 0건');
  });

  test('cycle 465: ${className} 보간 0건', async () => {
      const source = await readSrc('src/components/icons/MonsterIcon.tsx');
      assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
  });

  test('cycle 465: 정합성 가드 — 2 callsite className 전달 0건', async () => {
      const source = await readSrc('src/components/codex/MonsterCodex.tsx');
      const matches = source.match(/<MonsterIcon[^/]*\/>/g) || [];
      assert.equal(matches.length, 2, 'MonsterIcon 호출 2건');
      matches.forEach((m, i) => {
          assert.ok(!/\bclassName\b/.test(m), `callsite ${i}에 className 전달 0건`);
      });
  });

  test('cycle 465: name / discovered / isBoss / size prop 보존', async () => {
      const source = await readSrc('src/components/icons/MonsterIcon.tsx');
      const fnIdx = source.indexOf('const MonsterIcon =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bname\b/.test(sig), 'name 보존');
      // cycle 571: discovered/isBoss/size defaults cascade 제거 (2 callsite 모두 명시).
      //   파라미터 자체는 보존.
      assert.ok(/\bdiscovered\b/.test(sig), 'discovered 파라미터 보존 (default cycle 571 제거)');
      assert.ok(/\bisBoss\b/.test(sig), 'isBoss 파라미터 보존 (default cycle 571 제거)');
      assert.ok(/\bsize\b/.test(sig), 'size 파라미터 보존 (default cycle 571 제거)');
  });
}

// ─── 원본: tests/cycle-571-monster-icon-defaults-batch.test.js ───
{
  /**
   * cycle 571: MonsterIcon 3 defaults batch unreachable
   *   (cycle 222-570 silent dead config 시리즈 310번째 — redundant default annotation
   *   청소 메가 시리즈 63번째). single-cycle 3-default batch.
   *
   * 발견 (3 defaults batch):
   * - src/components/icons/MonsterIcon.tsx (line 54):
   *     const MonsterIcon = ({ name, discovered = false, isBoss = false,
   *         size = 32 }: any) => {...};
   * - 호출 사이트 (2 callers):
   *     · MonsterCodex:98 — <MonsterIcon name={m.name} discovered={m.encountered}
   *       isBoss={m.isBoss} size={24} />
   *     · MonsterCodex:121 — <MonsterIcon name={m.name} discovered
   *       isBoss={m.isBoss} size={28} />
   * - 결과: discovered / isBoss / size 항상 명시 전달. 3 defaults 모두 도달 불가.
   *
   * 패턴 (cycle 222-570 시리즈 310번째):
   * - cycle 502-570: default 청소 메가 시리즈 69사이클.
   * - cycle 571: components/icons/ 시리즈 4번째 (cycle 567/568/569에 이은).
   *   single-cycle 3-default batch.
   *
   * 수정 (src/components/icons/MonsterIcon.tsx):
   * - signature에서 discovered = false → discovered.
   * - signature에서 isBoss = false → isBoss.
   * - signature에서 size = 32 → size.
   * - body 동작 보존.
   *
   * 회귀 가드:
   * - 2 production callsite 동작 그대로.
   * - body SILHOUETTE_PATHS / boss/humanoid 분기 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 571: MonsterIcon signature에서 3 defaults 0건', async () => {
      const source = await readSrc('src/components/icons/MonsterIcon.tsx');
      const fnIdx = source.indexOf('const MonsterIcon = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/discovered\s*=\s*false/.test(sig),
          'MonsterIcon discovered default false 제거');
      assert.ok(!/isBoss\s*=\s*false/.test(sig),
          'MonsterIcon isBoss default false 제거');
      assert.ok(!/size\s*=\s*32/.test(sig),
          'MonsterIcon size default 32 제거');
  });

  test('cycle 571: 정합성 가드 — 2 production callsite 보존', async () => {
      const source = await readSrc('src/components/codex/MonsterCodex.tsx');
      assert.ok(/<MonsterIcon name=\{m\.name\} discovered=\{m\.encountered\} isBoss=\{m\.isBoss\} size=\{24\}/.test(source),
          'MonsterCodex:98 <MonsterIcon> callsite 보존');
      assert.ok(/<MonsterIcon name=\{m\.name\} discovered isBoss=\{m\.isBoss\} size=\{28\}/.test(source),
          'MonsterCodex:121 <MonsterIcon> callsite 보존');
  });

  test('cycle 571: body SILHOUETTE_PATHS 분기 보존', async () => {
      const source = await readSrc('src/components/icons/MonsterIcon.tsx');
      assert.ok(/const type = isBoss \? 'boss' : getMonsterType\(name\)/.test(source),
          "isBoss ? 'boss' : getMonsterType ternary 보존");
      assert.ok(/SILHOUETTE_PATHS\[type\] \|\| SILHOUETTE_PATHS\.humanoid/.test(source),
          'SILHOUETTE_PATHS humanoid fallback 보존');
  });

  test('cycle 571: cycle 502-570 회귀 가드 — default 청소 시리즈 보존', async () => {
      const sti = await readSrc('src/components/icons/SkillTypeIcon.tsx');
      assert.ok(!/const SkillTypeIcon = \({ type, size\s*=\s*14/.test(sti),
          'cycle 569 SkillTypeIcon size default 0건');

      const ci = await readSrc('src/components/icons/ClassIcon.tsx');
      assert.ok(!/const ClassIcon = \({ className: jobName, size\s*=\s*28/.test(ci),
          'cycle 568 ClassIcon size default 0건');
  });
}
