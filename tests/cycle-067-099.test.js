import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { ACHIEVEMENTS, QUESTS } from '../src/data/quests.js';
import { TITLES } from '../src/data/titles.js';
import { access, readFile } from 'node:fs/promises';
import { buildRunShareText } from '../src/utils/runShareText.js';
import { buildRunSummary, checkTitles, getAchievementCurrentValue, isAchievementUnlocked } from '../src/utils/gameUtils.js';
import { fileURLToPath } from 'node:url';
import { getRunSummaryAnalysis } from '../src/utils/outcomeAnalysis.js';
import { syncQuestProgress } from '../src/utils/questProgress.js';

/**
 * cycle 67-99 정리 가드 (audit #1 통합 14개)
 */

// ─── cycle-74-escape-counter.test.js ───
{
  // cycle 74: 도주 성공 카운터(stats.escapes)와 그 위에 쌓이는 achievements 3종.
  //
  // 기존 동작:
  // - 도주 성공은 stats.recentBattles에만 push되어 50개 윈도우 밖으로 밀려나면 사라짐.
  // - achievement / quest target으로 사용 불가.
  //
  // 이번 추가:
  // - combatAttack의 escape success 분기에서 stats.escapes += 1
  // - achievements 3종 (ach_escape_5 / 20 / 50)
  // - INITIAL_STATE.player.stats.escapes = 0 default

  const findAch = (id) => ACHIEVEMENTS.find((a) => a.id === id);

  test('ach_escape_5 / ach_escape_20 / ach_escape_50 achievements 등록됨', () => {
      const ids = ['ach_escape_5', 'ach_escape_20', 'ach_escape_50'];
      for (const id of ids) {
          const ach = findAch(id);
          assert.ok(ach, `${id} should exist`);
          assert.equal(ach.target, 'escapes');
          assert.ok(typeof ach.goal === 'number' && ach.goal > 0);
      }
  });

  test('escape achievement goal이 단조 증가 (5 < 20 < 50)', () => {
      const goals = ['ach_escape_5', 'ach_escape_20', 'ach_escape_50'].map((id) => findAch(id).goal);
      for (let i = 1; i < goals.length; i++) {
          assert.ok(goals[i] > goals[i - 1], 'goals should be monotonically increasing');
      }
  });

  test('isAchievementUnlocked: escapes 5 → ach_escape_5 unlocked', () => {
      const player = { stats: { escapes: 5 } };
      assert.equal(isAchievementUnlocked(findAch('ach_escape_5'), player), true);
      assert.equal(isAchievementUnlocked(findAch('ach_escape_20'), player), false);
  });

  test('isAchievementUnlocked: escapes 50 → 3종 모두 unlocked', () => {
      const player = { stats: { escapes: 50 } };
      assert.equal(isAchievementUnlocked(findAch('ach_escape_5'), player), true);
      assert.equal(isAchievementUnlocked(findAch('ach_escape_20'), player), true);
      assert.equal(isAchievementUnlocked(findAch('ach_escape_50'), player), true);
  });

  test('isAchievementUnlocked: stats.escapes 누락 → 0 취급', () => {
      const player = { stats: {} };
      assert.equal(isAchievementUnlocked(findAch('ach_escape_5'), player), false);
  });
}

// ─── cycle-82-crafts-syntheses-stats.test.js ───
{
  /**
   * cycle 82: 합성/제작 카운터의 StatsPanel 노출 + INITIAL_STATE 선언적 일관성.
   *
   * 배경:
   * - cycle 80에서 ESCAPES를 stats panel에 노출시킨 패턴(cycle 74→80)을
   *   crafts/syntheses에도 적용해 모험 중 누적되는 보조 카운터들을 가시화.
   * - INITIAL_STATE.player.stats에는 crafts:0이 있지만 syntheses는 누락.
   *   incrementStat이 missing field를 0으로 안전 처리하지만, 선언적
   *   일관성을 위해 추가한다 (target='synths' achievement 3종이 cycle 30+
   *   부터 존재).
   *
   * 계약:
   *   1. INITIAL_STATE.player.stats에 syntheses: 0 선언
   *   2. StatsPanel statEntries에 '제작 횟수' 라벨 row 노출
   *   3. StatsPanel statEntries에 '합성 횟수' 라벨 row 노출
   *   4. 기존 '도주 횟수' row 회귀 보존
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('INITIAL_STATE.player.stats에 syntheses: 0 선언', async () => {
      const source = await readSrc('src/reducers/gameReducer.ts');
      assert.ok(
          /syntheses:\s*0/.test(source),
          'INITIAL_STATE.player.stats should declare syntheses: 0'
      );
  });

  test('StatsPanel: 제작 횟수 row 노출', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      assert.ok(
          /label:\s*['"]제작 횟수['"]/.test(source),
          'StatsPanel should expose 제작 횟수 row'
      );
  });

  test('StatsPanel: 합성 횟수 row 노출', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      assert.ok(
          /label:\s*['"]합성 횟수['"]/.test(source),
          'StatsPanel should expose 합성 횟수 row'
      );
  });

  test('StatsPanel: 도주 횟수 row 회귀 보존 (cycle 80)', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      assert.ok(
          /label:\s*['"]도주 횟수['"]/.test(source),
          '도주 횟수 row from cycle 80 must be preserved'
      );
  });
}

// ─── cycle-83-discoveries-map-semantic.test.js ───
{
  /**
   * cycle 83: 'discoveries' 시맨틱 통일 — 지도 발견 카운트 = visitedMaps.length.
   *
   * 배경:
   * - `ach_discover_5/10/15` ("새 지역 N곳 발견") + 퀘스트 201 ("15곳 발견") +
   *   타이틀 `cartographer` ("지도 제작자") 모두 의도가 "지도(맵) 발견 카운트".
   * - 그러나 cycle X에서 `stats.discoveries`라는 별도의 이벤트 카운터가
   *   _shared.ts에서 narrative_event/relic_found/anomaly/key_event 발생 시 +1
   *   되도록 추가되었고, questProgress/checkTitles/StatsPanel이 이를 잘못 읽어
   *   "탐험 중 흥미로운 사건 마주친 횟수"로 취급되고 있었음.
   * - 결과: 타이틀 cartographer가 10번의 이벤트만으로 풀려 의도(10개 맵 발견)
   *   대비 한참 일찍 unlock. 퀘스트 201도 동일.
   *
   * 이번 사이클: questProgress + checkTitles + StatsPanel 모두 visitedMaps.length로
   * 통일. getAchievementCurrentValue('discoveries')가 이미 그렇게 읽고 있던
   * 정합성 기준선에 맞춤.
   */

  const findAch = (id) => ACHIEVEMENTS.find((a) => a.id === id);
  const findQuest = (id) => QUESTS.find((q) => q.id === id);
  const findTitle = (id) => TITLES.find((t) => t.id === id);

  const makePlayer = (visitedMaps, discoveries = 0) => ({
      level: 30,
      job: '검사',
      quests: [],
      stats: {
          kills: 0, deaths: 0, total_gold: 0, killRegistry: {},
          visitedMaps,
          discoveries,
      },
  });

  test('quest 201 (15곳 발견): visitedMaps 14곳 → progress 14, 15곳 → progress 15', () => {
      const quest201 = findQuest(201);
      assert.ok(quest201, 'quest 201 should exist');
      assert.equal(quest201.type, 'discovery_count');
      assert.equal(quest201.target, 'discoveries');

      const player14 = {
          ...makePlayer(Array.from({ length: 14 }, (_, i) => `맵${i}`), 100),
          quests: [{ id: 201, progress: 0 }],
      };
      const out14 = syncQuestProgress(player14);
      assert.equal(out14.updatedQuests[0].progress, 14, '14 maps → 14 progress (not 100 from events)');

      const player15 = {
          ...makePlayer(Array.from({ length: 15 }, (_, i) => `맵${i}`), 0),
          quests: [{ id: 201, progress: 0 }],
      };
      const out15 = syncQuestProgress(player15);
      assert.equal(out15.updatedQuests[0].progress, 15, '15 maps → 15 progress (goal reached)');
  });

  test('quest 72 (탐험 발견 6회): visitedMaps 6곳 → progress 6', () => {
      const quest72 = findQuest(72);
      assert.ok(quest72, 'quest 72 should exist');
      const player = {
          ...makePlayer(['a', 'b', 'c', 'd', 'e', 'f'], 99),
          quests: [{ id: 72, progress: 0 }],
      };
      const out = syncQuestProgress(player);
      assert.equal(out.updatedQuests[0].progress, 6);
  });

  test('title cartographer (지도 제작자): val 10 — visitedMaps 10곳 → 활성', () => {
      const title = findTitle('cartographer');
      assert.ok(title, 'cartographer title should exist');
      assert.equal(title.cond.type, 'discoveries');
      assert.equal(title.cond.val, 10);

      const player10 = makePlayer(Array.from({ length: 10 }, (_, i) => `m${i}`), 0);
      const earned10 = checkTitles(player10);
      assert.ok(earned10.includes('cartographer'), 'with 10 visited maps cartographer should be earned');

      const player9 = makePlayer(Array.from({ length: 9 }, (_, i) => `m${i}`), 999);
      const earned9 = checkTitles(player9);
      assert.ok(!earned9.includes('cartographer'), 'with 9 visited maps cartographer should NOT be earned even with 999 events');
  });

  test('getAchievementCurrentValue("discoveries") 회귀 — visitedMaps.length 유지', () => {
      const player = makePlayer(['a', 'b', 'c', 'd', 'e'], 100);
      const ach = findAch('ach_discover_5');
      const value = getAchievementCurrentValue(ach, player);
      assert.equal(value, 5, 'achievement should still read visitedMaps.length (regression baseline)');
  });
}

// ─── cycle-84-discoveries-runsummary.test.js ───
{
  /**
   * cycle 84: 'discoveries' 시맨틱 통일 마무리 — RunSummary/share에 맵 발견 수 노출 +
   * 잔존 dead write 제거.
   *
   * cycle 83에서 discoveries → visitedMaps.length로 의미를 통일했고,
   * 이번 사이클은 그 마무리:
   *   1. _shared.ts의 stats.discoveries 누적 (이제 dead write) 제거
   *   2. INITIAL_STATE.player.stats.discoveries 선언 제거
   *   3. buildRunSummary가 discoveries: visitedMaps.length 노출
   *   4. buildRunShareText가 discoveries > 0일 때 "🗺️ 지도 발견 N곳" 라인 추가
   *      (escapeLine과 동일한 silence-over-noise 패턴)
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('buildRunSummary: discoveries = visitedMaps.length', () => {
      const player = {
          level: 30, job: '검사', stats: {
              kills: 100, deaths: 0, total_gold: 5000,
              visitedMaps: ['시작의 마을', '평원', '숲', '동굴', '사막', '오아시스', '피라미드'],
          }, equip: {}, inv: [], relics: [],
      };
      const summary = buildRunSummary(player, '시작의 마을');
      assert.equal(summary.discoveries, 7, 'summary.discoveries should be visitedMaps.length');
  });

  test('buildRunSummary: visitedMaps 미설정 → discoveries = 0', () => {
      const player = {
          level: 1, job: '모험가', stats: { kills: 0, deaths: 0, total_gold: 0 },
          equip: {}, inv: [], relics: [],
      };
      const summary = buildRunSummary(player, '시작의 마을');
      assert.equal(summary.discoveries, 0);
  });

  test('buildRunShareText: discoveries > 0 → 지도 발견 라인 노출', () => {
      const summary = {
          job: '검사', level: 30, loc: '심연', kills: 100, bossKills: 3,
          relicsFound: 2, totalGold: 50000, prestigeRank: 0,
          signaturesAcquired: 0, signatureNames: [],
          escapes: 0, discoveries: 12,
      };
      const text = buildRunShareText(summary);
      assert.match(text, /🗺️.*12.*곳/, 'should include 지도 발견 line with count');
  });

  test('buildRunShareText: discoveries == 0 → silent', () => {
      const summary = {
          job: '검사', level: 5, loc: '평원', kills: 5, bossKills: 0,
          relicsFound: 0, totalGold: 100, prestigeRank: 0,
          signaturesAcquired: 0, signatureNames: [],
          escapes: 0, discoveries: 0,
      };
      const text = buildRunShareText(summary);
      assert.doesNotMatch(text, /지도 발견/, 'should be silent when discoveries == 0');
  });

  test('buildRunShareText: 기존 escape line 회귀 보존 (cycle 78)', () => {
      const summary = {
          job: '검사', level: 10, loc: '평원', kills: 50, bossKills: 1,
          relicsFound: 1, totalGold: 1000, prestigeRank: 0,
          signaturesAcquired: 0, signatureNames: [],
          escapes: 7, discoveries: 0,
      };
      const text = buildRunShareText(summary);
      assert.match(text, /🏃 도주 7회.*위험 회피/, 'escape line preserved');
  });

  test('_shared.ts dead write 제거 — stats.discoveries 누적 제거', async () => {
      const source = await readSrc('src/hooks/gameActions/_shared.ts');
      assert.doesNotMatch(
          source,
          /discoveries:\s*\[/,
          '_shared.ts should no longer write to stats.discoveries (dead write after cycle 83)'
      );
  });

  test('INITIAL_STATE: stats.discoveries 선언 제거', async () => {
      const source = await readSrc('src/reducers/gameReducer.ts');
      // 이전엔 'discoveries: 0' 이 INITIAL_STATE.player.stats에 선언되어 있었음.
      // cycle 84에서 dead field로 정리. 다른 'discoveries' 잔존 reference 없는지도 확인.
      assert.doesNotMatch(
          source,
          /\bdiscoveries:\s*0/,
          'INITIAL_STATE should no longer declare stats.discoveries'
      );
  });
}

// ─── cycle-86-run-summary-extras.test.js ───
{
  /**
   * cycle 86: RunSummaryCard에 escapes/discoveries 시각 노출.
   *
   * 배경:
   * - cycle 78에서 escape 라인을 share text에 추가, cycle 84에서 discoveries
   *   라인을 share text에 추가. 그러나 RunSummaryCard 자체(시각 카드)는 둘 다
   *   노출하지 않음 — 공유 텍스트로만 자랑할 수 있고 화면에선 안 보였음.
   * - 다른 reflection surface(signaturesAcquired)는 별도의 highlight 섹션
   *   (data-testid="run-summary-signatures")으로 시각 노출되는 패턴이 정착됨
   *   (cycle 18). 동일 패턴으로 escape/discovery도 surface.
   *
   * 추가:
   * - 새 mini section: data-testid="run-summary-extras"
   * - 조건: escapes > 0 || discoveries > 0 (둘 다 0이면 silent)
   * - 각 메트릭은 자체 data-testid (run-summary-escape, run-summary-discovery)로
   *   selectable.
   *
   * 계약:
   *   1. 컴포넌트 source가 run-summary-extras testid 노출
   *   2. run-summary-escape testid 노출
   *   3. run-summary-discovery testid 노출
   *   4. signaturesAcquired highlight (cycle 18) 회귀 보존
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('RunSummaryCard: run-summary-extras testid 노출', async () => {
      const source = await readSrc('src/components/RunSummaryCard.tsx');
      assert.ok(
          /data-testid\s*=\s*["']run-summary-extras["']/.test(source),
          'should expose data-testid="run-summary-extras"'
      );
  });

  test('RunSummaryCard: run-summary-escape testid 노출', async () => {
      const source = await readSrc('src/components/RunSummaryCard.tsx');
      assert.ok(
          /data-testid\s*=\s*["']run-summary-escape["']/.test(source),
          'should expose data-testid="run-summary-escape"'
      );
  });

  test('RunSummaryCard: run-summary-discovery testid 노출', async () => {
      const source = await readSrc('src/components/RunSummaryCard.tsx');
      assert.ok(
          /data-testid\s*=\s*["']run-summary-discovery["']/.test(source),
          'should expose data-testid="run-summary-discovery"'
      );
  });

  test('RunSummaryCard: extras 섹션은 escapes>0 OR discoveries>0 조건부 (silence-over-noise)', async () => {
      const source = await readSrc('src/components/RunSummaryCard.tsx');
      // 조건 표현식에 escapes와 discoveries 둘 다 등장해야 함 (||로 결합)
      assert.match(
          source,
          /(s\.escapes[^&|]+\|\|[^&|]+s\.discoveries|s\.discoveries[^&|]+\|\|[^&|]+s\.escapes)/,
          'extras section should be gated on (escapes > 0 || discoveries > 0)'
      );
  });

  test('RunSummaryCard: signaturesAcquired highlight 회귀 보존 (cycle 18)', async () => {
      const source = await readSrc('src/components/RunSummaryCard.tsx');
      assert.ok(
          /data-testid\s*=\s*["']run-summary-signatures["']/.test(source),
          'cycle 18 signature highlight section must be preserved'
      );
  });
}

// ─── cycle-87-run-analysis-escape-discovery.test.js ───
{
  /**
   * cycle 87: getRunSummaryAnalysis 반성(focus) 어드바이스에 escape/discovery 시그널
   * 통합.
   *
   * 배경:
   * - cycle 78/84에서 escapes/discoveries를 RunSummary에 노출, cycle 86에서
   *   시각 chip까지 추가했으나 actionable focus 어드바이스 (RunSummaryCard
   *   "Run Readout" 박스)는 두 시그널을 무시하고 있었음.
   * - "런이 끝났을 때 무엇을 배워야 하나?"가 reflection의 핵심인데, 도주가
   *   많거나 탐험이 좁았다는 사실을 다음 런 전략에 연결해주는 advice가 비어
   *   있어 reflection의 가치가 일부 누락된 상태.
   *
   * 추가 advice:
   *   - escapes >= 10 AND bossKills <= 1 → "도주가 많았고 보스 진입이 적었습니다.
   *     장비와 성장을 보강한 뒤 보스에 도전하세요."
   *   - discoveries <= 4 AND level >= 12 → "발견한 지역이 적었습니다. 새로운 길을
   *     탐색해 유물과 사건을 만날 기회를 넓히세요."
   *   - discoveries >= 15 → 칭찬 라인 "탐험 폭이 넓었습니다. 같은 호기심으로
   *     다음 런도 시작하세요."
   *
   * 모든 advice는 silence-over-noise: 조건 미충족 시 추가 안 됨.
   * focus는 .slice(0, 3) cap을 유지하므로 기존 라인을 밀어내지 않음.
   */

  test('escapes 많고 bossKills 적음 → 도주 advice 추가', () => {
      const summary = {
          level: 18, kills: 200, bossKills: 0, relicsFound: 4, totalGold: 8000,
          primaryBuild: '초반 균형', difficultyLabel: 'NORMAL',
          recentWinRate: 60,
          escapes: 12, discoveries: 8,
      };
      const result = getRunSummaryAnalysis(summary);
      assert.ok(
          result.focus.some((line) => /도주.*보스/.test(line)),
          'should advise on high-escape low-boss pattern'
      );
  });

  test('discoveries 적고 레벨 높음 → 탐험 권장 advice', () => {
      const summary = {
          level: 20, kills: 300, bossKills: 2, relicsFound: 5, totalGold: 12000,
          primaryBuild: '검사 중심', difficultyLabel: 'HARD',
          escapes: 0, discoveries: 3,
      };
      const result = getRunSummaryAnalysis(summary);
      assert.ok(
          result.focus.some((line) => /발견한 지역|탐색/.test(line)),
          'should advise on low-discovery high-level pattern'
      );
  });

  test('discoveries 많음 → 탐험 칭찬 advice', () => {
      const summary = {
          level: 25, kills: 400, bossKills: 3, relicsFound: 6, totalGold: 20000,
          primaryBuild: '탐험형', difficultyLabel: 'NORMAL',
          escapes: 0, discoveries: 18,
      };
      const result = getRunSummaryAnalysis(summary);
      assert.ok(
          result.focus.some((line) => /탐험 폭|호기심/.test(line)),
          'should compliment broad exploration'
      );
  });

  test('escapes/discoveries 모두 0 → 새 advice 추가 안 됨 (silence)', () => {
      const summary = {
          level: 10, kills: 100, bossKills: 1, relicsFound: 3, totalGold: 5000,
          primaryBuild: '균형', difficultyLabel: 'EASY',
          escapes: 0, discoveries: 0,
      };
      const result = getRunSummaryAnalysis(summary);
      // 신규 cycle 87 advice 라인 모두 부재
      assert.ok(!result.focus.some((line) => /도주.*보스/.test(line)));
      assert.ok(!result.focus.some((line) => /발견한 지역|탐색|탐험 폭|호기심/.test(line)));
  });

  test('focus는 최대 3개 cap 유지 (회귀)', () => {
      // 모든 시그널 동시 충족 케이스 — 기존 4개 + 신규 2개 = 6개 후보지만 3개 cap
      const summary = {
          level: 15, kills: 20, bossKills: 0, relicsFound: 0, totalGold: 1000,
          primaryBuild: '균형', difficultyLabel: 'EASY',
          escapes: 15, discoveries: 2, // 도주 advice + 탐험 권장 advice
      };
      const result = getRunSummaryAnalysis(summary);
      assert.ok(result.focus.length <= 3, `focus should be capped at 3, got ${result.focus.length}`);
  });
}

// ─── cycle-88-escape-sound-cue.test.js ───
{
  /**
   * cycle 88: 도주 성공 사운드 큐 — escape feedback chain의 마지막 sensory channel.
   *
   * 배경:
   * - cycle 74에서 stats.escapes를 도입한 뒤 76(quest), 77(title), 78(share),
   *   80(StatsPanel), 86(RunSummaryCard chip), 87(focus advice)까지 시각/텍스트
   *   표면을 닫았으나, 도주 성공 모먼트 자체에는 sensory 큐가 없음 (실패는
   *   'error' 로그가 'error' 사운드를 트리거하지만 성공은 'info' 로그라 mapping
   *   되지 않음).
   * - victory(승리)는 5음 상승, escape(도주)는 그것과 대비되는 가벼운 retreat
   *   tone — 후퇴이지만 위험 회피 성공의 안도감.
   *
   * 추가:
   * - SoundManager.play case 'escape' — 짧은 하강 sine (1100 → 600Hz)
   * - combatAttack.ts: 도주 성공 분기에서 soundManager.play('escape') 호출
   *
   * 'attack' 사운드(useGameEngine 'combat' 로그 매핑)나 'item' 사운드(직접 호출)
   * 처럼, escape는 직접 호출 패턴으로 (info 로그 type을 좁히지 않으면 다른
   * info 로그도 escape sound 트리거하기 때문).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('SoundManager: case "escape" 분기 존재', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.match(
          source,
          /case\s+['"]escape['"]\s*:/,
          'SoundManager.play should handle "escape" case'
      );
  });

  test('combatAttack.ts: 도주 성공 분기에서 escape 사운드 재생', async () => {
      const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
      assert.ok(
          /soundManager.*\(['"]escape['"]\)/.test(source) || /play\(['"]escape['"]\)/.test(source),
          'combatAttack should call soundManager.play("escape") on escape success'
      );
  });

  test('combatAttack.ts: soundManager import 추가됨', async () => {
      const source = await readSrc('src/hooks/combatActions/combatAttack.ts');
      assert.match(
          source,
          /import\s*\{[^}]*soundManager[^}]*\}\s*from/,
          'combatAttack should import soundManager'
      );
  });

  test('SoundManager: 기존 legendary chord 회귀 보존', async () => {
      const source = await readSrc('src/systems/SoundManager.ts');
      assert.match(
          source,
          /case\s+['"]legendary['"]\s*:/,
          'cycle 20 legendary case must be preserved'
      );
  });
}

// ─── cycle-90-onboarding-deadcode-cleanup.test.js ───
{
  /**
   * cycle 90: OnboardingGuide 데드코드 정리.
   *
   * 발견:
   * - src/components/OnboardingGuide.tsx 컴포넌트는 자기 자신 외엔 어디서도
   *   import되지 않는 dead component (commit c9a5564 "3칸 레이아웃 단순화"에서
   *   렌더 위치는 제거됐지만 파일 + 관련 state plumbing은 잔존).
   * - 관련 dead plumbing:
   *     state.onboardingDismissed (INITIAL_STATE / GameState interface)
   *     AT.SET_ONBOARDING_DISMISSED action constant
   *     uiHandlers SET_ONBOARDING_DISMISSED handler
   *     bootstrapHandlers의 LOAD_DATA payload merge 라인
   *     useGameEngine의 dismissOnboarding action + onboardingDismissed export
   *     useFirebaseSync의 read + save + deps
   *     gameUtils.migrateData의 boolean coercion 라인
   *
   * Firebase save에 잔존하는 onboardingDismissed 필드는 forward-compatible로
   * 무시됨 (필드 삭제는 안전; 추가/이름변경만 migrate 필요).
   *
   * 정리 후 모든 referent가 사라져야 함.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  const fileExists = async (relPath) => {
      try {
          await access(path.join(ROOT, relPath));
          return true;
      } catch {
          return false;
      }
  };

  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('OnboardingGuide.tsx 파일 제거됨', async () => {
      const exists = await fileExists('src/components/OnboardingGuide.tsx');
      assert.equal(exists, false, 'OnboardingGuide.tsx should be deleted');
  });

  test('actionTypes.ts에 SET_ONBOARDING_DISMISSED 제거됨', async () => {
      const source = await readSrc('src/reducers/actionTypes.ts');
      assert.doesNotMatch(source, /SET_ONBOARDING_DISMISSED/);
  });

  test('GameState/INITIAL_STATE에 onboardingDismissed 제거됨', async () => {
      const source = await readSrc('src/reducers/gameReducer.ts');
      assert.doesNotMatch(source, /onboardingDismissed/);
  });

  test('uiHandlers에 SET_ONBOARDING_DISMISSED 핸들러 제거됨', async () => {
      const source = await readSrc('src/reducers/handlers/uiHandlers.ts');
      assert.doesNotMatch(source, /onboardingDismissed/i);
  });

  test('bootstrapHandlers의 onboardingDismissed merge 라인 제거됨', async () => {
      const source = await readSrc('src/reducers/handlers/bootstrapHandlers.ts');
      assert.doesNotMatch(source, /onboardingDismissed/);
  });

  test('useGameEngine에 onboardingDismissed export / dismissOnboarding 제거됨', async () => {
      const source = await readSrc('src/hooks/useGameEngine.ts');
      assert.doesNotMatch(source, /onboardingDismissed/);
      assert.doesNotMatch(source, /dismissOnboarding/);
  });

  test('useFirebaseSync에 onboardingDismissed 참조 제거됨', async () => {
      const source = await readSrc('src/hooks/useFirebaseSync.ts');
      assert.doesNotMatch(source, /onboardingDismissed/);
  });

  test('gameUtils.migrateData에 onboardingDismissed boolean coercion 제거됨', async () => {
      const source = await readSrc('src/utils/gameUtils.ts');
      assert.doesNotMatch(source, /onboardingDismissed/);
  });
}

// ─── cycle-91-dead-component-cleanup.test.js ───
{
  /**
   * cycle 91: 미사용 React 컴포넌트 2건 정리.
   *
   * cycle 90 OnboardingGuide 정리에 이어 dead component 추가 발견:
   *
   *   - src/components/icons/EquipmentSpriteGlyph.tsx (941 lines)
   *     자기 자신 외엔 어디서도 import되지 않음 (EquipmentSpriteLayer/
   *     EquipmentSpriteGlyph 둘 다 export됐지만 consumer 0건). 코드베이스 최대
   *     단일 .tsx 파일이었던 데드코드.
   *   - src/components/dashboard/DashboardPanels.tsx (332 lines)
   *     동일 폴더의 FocusPanel.tsx만 active. DashboardPanels는 어디서도 참조 X.
   *
   * 합 1273 lines 정리.
   *
   * 의존성 utils(equipmentArt / getExplorationForecast / getQuestTracker)는
   * 다른 active consumer가 있어 그대로 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  const fileExists = async (relPath) => {
      try {
          await access(path.join(ROOT, relPath));
          return true;
      } catch {
          return false;
      }
  };

  test('EquipmentSpriteGlyph.tsx 파일 제거됨', async () => {
      assert.equal(await fileExists('src/components/icons/EquipmentSpriteGlyph.tsx'), false);
  });

  test('DashboardPanels.tsx 파일 제거됨', async () => {
      assert.equal(await fileExists('src/components/dashboard/DashboardPanels.tsx'), false);
  });

  // cycle 310: FocusPanel.tsx도 cycle 91 시점에 active이었으나 이후 dispatch path가 모두 다른
  //   컴포넌트로 이주하면서 0건 dead로 전락 → cycle 310에서 제거. 이 회귀 가드는 obsolete.

  test('icons 폴더의 active consumer 회귀 보존 — ItemIcon', async () => {
      assert.equal(await fileExists('src/components/icons/ItemIcon.tsx'), true);
  });

  test('equipmentArt utility는 다른 active consumer가 있어 보존', async () => {
      const characterAppearance = await readFile(path.join(ROOT, 'src/utils/characterAppearance.ts'), 'utf8');
      assert.match(characterAppearance, /equipmentArt/);
  });
}

// ─── cycle-92-dead-utils-cleanup.test.js ───
{
  /**
   * cycle 92: dead components/services/utils 정리.
   *
   * cycle 90/91 흐름의 연장. 추가 발견:
   *   - src/components/AdminDashboard.tsx (142 lines)
   *     "v4.0: Hybrid Strategy - Analytics offloaded to AWS Lambda" 주석으로
   *     계획됐던 analytics dashboard. 어디서도 import되지 않음 (실제 admin 액션은
   *     SystemTab의 SET_MULTIPLIER / BROADCAST 버튼이 별도로 처리).
   *   - src/services/analyticsService.ts (27 lines)
   *     fetchAnalyticsData export. 유일한 consumer가 AdminDashboard였음 → 함께
   *     orphan.
   *   - src/utils/animationConfig.ts (111 lines)
   *     중앙화된 Framer Motion 프리셋(MOTION 객체) — 아무도 import 안 함.
   *     컴포넌트가 inline motion을 직접 쓰는 패턴으로 정착되어 사용처가 0건.
   *
   * 합 280 lines 정리.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');

  const fileExists = async (relPath) => {
      try {
          await access(path.join(ROOT, relPath));
          return true;
      } catch {
          return false;
      }
  };

  test('AdminDashboard.tsx 파일 제거됨', async () => {
      assert.equal(await fileExists('src/components/AdminDashboard.tsx'), false);
  });

  test('analyticsService.ts 파일 제거됨', async () => {
      assert.equal(await fileExists('src/services/analyticsService.ts'), false);
  });

  test('animationConfig.ts 파일 제거됨', async () => {
      assert.equal(await fileExists('src/utils/animationConfig.ts'), false);
  });

  test('aiService.ts는 보존 (active service)', async () => {
      assert.equal(await fileExists('src/services/aiService.ts'), true);
  });

  test('SystemTab의 admin 액션은 별도 경로로 보존됨', async () => {
      const { readFile } = await import('node:fs/promises');
      const source = await readFile(path.join(ROOT, 'src/components/tabs/SystemTab.tsx'), 'utf8');
      assert.match(source, /actions\.isAdmin\(\)/);
      assert.match(source, /handleSetMultiplier|SET MULTIPLIER/);
  });
}

// ─── cycle-93-unused-exports-cleanup.test.js ───
{
  /**
   * cycle 93: utils 파일 단위 dead export 정리.
   *
   * cycle 90-92에서 dead component / service를 정리한 흐름의 연장. 이번엔
   * 파일은 active이지만 export 일부가 어디서도 import되지 않고 자기 파일
   * 안에서도 호출되지 않는 dead exports를 정리한다.
   *
   * 정리 대상 (사용처 / 자기 파일 내 호출 모두 0건):
   *   1. IMAGEGEN_OVERLAY_KEYS @ src/utils/itemVisuals.ts (44 라인 const Set)
   *      "추가 imagegen 자산 생성 시 이 set에 키 등록 필요" 주석이 남아있지만
   *      실제로 이 set을 읽는 코드는 없음.
   *   2. getEquipmentOverlayAssetKey @ src/utils/itemVisuals.ts (5 라인)
   *      getEquipmentOverlayAssetSrc 옆에 정의됐지만 호출 0건.
   *   3. getOutfitAffinityTone @ src/utils/jobOutfitAffinity.ts (6 라인)
   *      "UI용: outfit affinity tone" 주석이 있지만 UI 어디서도 호출 X.
   *   4. getMaterialShop @ src/utils/shopRotation.ts (24 라인)
   *      "소재 상점 (레벨 기반 소재 판매)" 의도였지만 ShopPanel은 일반
   *      shop 로직만 사용 — material shop은 미구현 / 사용처 0건.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('itemVisuals.ts: IMAGEGEN_OVERLAY_KEYS export 제거됨', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      assert.doesNotMatch(source, /export\s+const\s+IMAGEGEN_OVERLAY_KEYS/);
  });

  test('itemVisuals.ts: getEquipmentOverlayAssetKey export 제거됨', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      assert.doesNotMatch(source, /export\s+const\s+getEquipmentOverlayAssetKey/);
  });

  test('itemVisuals.ts: 다른 active export는 회귀 보존', async () => {
      const source = await readSrc('src/utils/itemVisuals.ts');
      // getEquipmentOverlayAssetSrc(cycle 45) / getAvatarLoadoutStyle(cycle 36+) 등은 active
      assert.match(source, /export\s+const\s+getEquipmentOverlayAssetSrc/);
      assert.match(source, /export\s+const\s+getAvatarLoadoutStyle/);
  });

  test('jobOutfitAffinity.ts: getOutfitAffinityTone export 제거됨', async () => {
      const source = await readSrc('src/utils/jobOutfitAffinity.ts');
      assert.doesNotMatch(source, /export\s+const\s+getOutfitAffinityTone/);
  });

  test('shopRotation.ts: getMaterialShop export 제거됨', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      assert.doesNotMatch(source, /export\s+const\s+getMaterialShop/);
  });

  test('shopRotation.ts: 다른 active export는 회귀 보존', async () => {
      const source = await readSrc('src/utils/shopRotation.ts');
      // getDailyDeals / getWeeklySpecial 등은 ShopPanel에서 active 사용
      assert.match(source, /export\s+const\s+(getDailyDeals|getWeeklySpecial)/);
  });
}

// ─── cycle-95-max-kill-streak.test.js ───
{
  /**
   * cycle 95: 최대 연속 처치(maxKillStreak) 누적 + 보상 통합.
   *
   * 배경:
   * - cycle 초기부터 killStreak 시스템이 4 tier(3/5/10/20)와 ATK/CRIT 보너스로
   *   잘 구현되어 있고 statsCalculator computeKillStreakBonus가 active.
   * - 그러나 killStreak는 비전투 30초 / 사망 / 도주 시 0으로 리셋되는 휘발성
   *   카운터. "이번 런에 30연속 달성"이 아무 데도 기록되지 않아 reflection /
   *   보상 surface가 비어있던 빈 자리.
   *
   * 추가:
   * - INITIAL_STATE.player.stats.maxKillStreak = 0
   * - combatVictory: 매 처치 후 stats.maxKillStreak = max(prev, newStreak)
   * - achievements 3종: ach_streak_5 / ach_streak_10 / ach_streak_20
   * - title 'berserker' (광전사): cond.type='maxKillStreak', val=20
   * - checkTitles에 type==='maxKillStreak' 핸들러
   */

  const findAch = (id) => ACHIEVEMENTS.find((a) => a.id === id);
  const findTitle = (id) => TITLES.find((t) => t.id === id);

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('INITIAL_STATE.player.stats.maxKillStreak 선언됨', async () => {
      const source = await readSrc('src/reducers/gameReducer.ts');
      assert.match(source, /maxKillStreak:\s*0/);
  });

  test('combatVictory: stats.maxKillStreak 누적 코드 존재', async () => {
      const source = await readSrc('src/hooks/combatActions/combatVictory.ts');
      assert.match(
          source,
          /maxKillStreak:\s*Math\.max/,
          'should update maxKillStreak via Math.max in combatVictory'
      );
  });

  test('ach_streak_5/10/20 achievements 등록됨', () => {
      for (const id of ['ach_streak_5', 'ach_streak_10', 'ach_streak_20']) {
          const ach = findAch(id);
          assert.ok(ach, `${id} should exist`);
          assert.equal(ach.target, 'maxKillStreak');
      }
  });

  test('isAchievementUnlocked: maxKillStreak 20 → ach_streak_20 unlocked', () => {
      const player = { stats: { maxKillStreak: 20 } };
      assert.equal(isAchievementUnlocked(findAch('ach_streak_5'), player), true);
      assert.equal(isAchievementUnlocked(findAch('ach_streak_10'), player), true);
      assert.equal(isAchievementUnlocked(findAch('ach_streak_20'), player), true);
  });

  test('isAchievementUnlocked: maxKillStreak 9 → ach_streak_5만 unlocked', () => {
      const player = { stats: { maxKillStreak: 9 } };
      assert.equal(isAchievementUnlocked(findAch('ach_streak_5'), player), true);
      assert.equal(isAchievementUnlocked(findAch('ach_streak_10'), player), false);
  });

  test('berserker(광전사) 칭호 등록됨 (maxKillStreak 20)', () => {
      const title = findTitle('berserker');
      assert.ok(title, 'berserker title should exist');
      assert.equal(title.name, '광전사');
      assert.equal(title.cond.type, 'maxKillStreak');
      assert.equal(title.cond.val, 20);
  });

  test('checkTitles: maxKillStreak 20 → berserker 활성', () => {
      const player = { titles: [], stats: { maxKillStreak: 20 } };
      const unlocked = checkTitles(player);
      assert.ok(unlocked.includes('berserker'));
  });

  test('checkTitles: maxKillStreak 19 → berserker 비활성', () => {
      const player = { titles: [], stats: { maxKillStreak: 19 } };
      const unlocked = checkTitles(player);
      assert.ok(!unlocked.includes('berserker'));
  });
}

// ─── cycle-96-max-streak-surfaces.test.js ───
{
  /**
   * cycle 96: maxKillStreak feedback chain — StatsPanel / RunSummary / share 표면 통합.
   *
   * cycle 95에서 stats.maxKillStreak 누적 + ach_streak_5/10/20 + berserker 칭호를
   * 깔았다. 이번 사이클은 cycle 78/80/84/86 패턴을 따라 시각/공유 표면에도 노출:
   *
   *   1. StatsPanel: 최대 연속 처치 row (Flame / red-400, killStreak 시스템 톤과 매치)
   *   2. buildRunSummary: maxKillStreak 필드 (reflection 단계에서 사용 가능)
   *   3. buildRunShareText: max-streak > 0이면 "🔥 최대 N연속 처치" 라인
   *      (silence-over-noise — 0이면 출력 안 함)
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('StatsPanel: 최대 연속 처치 row 노출', async () => {
      const source = await readSrc('src/components/StatsPanel.tsx');
      assert.match(
          source,
          /label:\s*['"]최대 연속 처치['"]/,
          'StatsPanel should expose 최대 연속 처치 row'
      );
  });

  test('buildRunSummary: maxKillStreak 노출', () => {
      const player = {
          level: 30, job: '검사',
          stats: {
              kills: 200, deaths: 0, total_gold: 5000,
              maxKillStreak: 18,
          },
          equip: {}, inv: [], relics: [],
      };
      const summary = buildRunSummary(player, '심연');
      assert.equal(summary.maxKillStreak, 18);
  });

  test('buildRunSummary: maxKillStreak 누락 → 0', () => {
      const player = {
          level: 1, job: '모험가',
          stats: { kills: 0, deaths: 0, total_gold: 0 },
          equip: {}, inv: [], relics: [],
      };
      const summary = buildRunSummary(player, '시작의 마을');
      assert.equal(summary.maxKillStreak, 0);
  });

  test('buildRunShareText: maxKillStreak > 0 → 연속 처치 라인 노출', () => {
      const summary = {
          job: '검사', level: 30, loc: '심연', kills: 200, bossKills: 3,
          relicsFound: 2, totalGold: 50000, prestigeRank: 0,
          signaturesAcquired: 0, signatureNames: [],
          escapes: 0, discoveries: 0, maxKillStreak: 22,
      };
      const text = buildRunShareText(summary);
      assert.match(text, /🔥.*22.*연속/, 'should include max-streak line with count');
  });

  test('buildRunShareText: maxKillStreak == 0 → silent (cycle 78 escape 패턴)', () => {
      const summary = {
          job: '검사', level: 5, loc: '평원', kills: 5, bossKills: 0,
          relicsFound: 0, totalGold: 100, prestigeRank: 0,
          signaturesAcquired: 0, signatureNames: [],
          escapes: 0, discoveries: 0, maxKillStreak: 0,
      };
      const text = buildRunShareText(summary);
      assert.doesNotMatch(text, /연속 처치/, 'silent when maxKillStreak == 0');
  });

  test('buildRunShareText: 기존 escape/discovery 라인 회귀 보존', () => {
      const summary = {
          job: '검사', level: 10, loc: '평원', kills: 50, bossKills: 1,
          relicsFound: 1, totalGold: 1000, prestigeRank: 0,
          signaturesAcquired: 0, signatureNames: [],
          escapes: 7, discoveries: 8, maxKillStreak: 0,
      };
      const text = buildRunShareText(summary);
      assert.match(text, /🏃 도주 7회/);
      assert.match(text, /🗺️ 지도 발견 8곳/);
  });
}

// ─── cycle-97-max-streak-reflection.test.js ───
{
  /**
   * cycle 97: maxKillStreak reflection 마무리 — RunSummaryCard chip + focus advice.
   *
   * cycle 95(데이터/보상) + 96(StatsPanel/RunSummary/share)에 이어,
   * cycle 86(escape/discovery chip) + cycle 87(focus advice) 패턴을 따라
   * 시각 카드 + actionable 어드바이스까지 닫는다.
   *
   * 추가:
   * - RunSummaryCard run-summary-extras 섹션에 streak chip
   *   (data-testid="run-summary-streak", Flame / red 톤, maxKillStreak > 0 조건부)
   * - getRunSummaryAnalysis focus advice:
   *   - maxKillStreak >= 10 → "공격형 운영 — 연속 처치를 유지해 streak 보너스를 끌어내고 있습니다."
   *   - maxKillStreak < 3 AND level >= 10 → "연속 처치가 끊기는 흐름. 빌드 강화 + 안전한 적부터 정리해 streak를 쌓아보세요."
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('RunSummaryCard: run-summary-streak testid 노출', async () => {
      const source = await readSrc('src/components/RunSummaryCard.tsx');
      assert.match(source, /data-testid\s*=\s*["']run-summary-streak["']/);
  });

  test('RunSummaryCard: extras 섹션 조건에 maxKillStreak 포함', async () => {
      const source = await readSrc('src/components/RunSummaryCard.tsx');
      // (escapes > 0 || discoveries > 0 || maxKillStreak > 0) 조건
      const idx = source.indexOf('run-summary-extras');
      assert.ok(idx > -1);
      const window = source.slice(Math.max(0, idx - 600), idx);
      assert.match(window, /maxKillStreak/);
  });

  test('RunSummaryCard: 기존 escape/discovery chip 회귀 보존', async () => {
      const source = await readSrc('src/components/RunSummaryCard.tsx');
      assert.match(source, /data-testid\s*=\s*["']run-summary-escape["']/);
      assert.match(source, /data-testid\s*=\s*["']run-summary-discovery["']/);
  });

  test('focus advice: maxKillStreak >= 10 → 공격형 칭찬', () => {
      const summary = {
          level: 20, kills: 200, bossKills: 2, relicsFound: 4, totalGold: 10000,
          primaryBuild: '검사 직선', difficultyLabel: 'NORMAL',
          escapes: 0, discoveries: 0, maxKillStreak: 12,
      };
      const result = getRunSummaryAnalysis(summary);
      assert.ok(
          result.focus.some((line) => /연속 처치|streak|공격형 운영/.test(line)),
          'should compliment offensive streak play'
      );
  });

  test('focus advice: maxKillStreak < 3 AND level >= 10 → streak 활용 권장', () => {
      const summary = {
          level: 15, kills: 80, bossKills: 1, relicsFound: 3, totalGold: 4000,
          primaryBuild: '균형형', difficultyLabel: 'NORMAL',
          escapes: 0, discoveries: 0, maxKillStreak: 2,
      };
      const result = getRunSummaryAnalysis(summary);
      assert.ok(
          result.focus.some((line) => /streak|연속 처치/.test(line)),
          'should advise on building streak'
      );
  });

  test('focus advice: maxKillStreak == 0 OR level 낮음 → silent (조건 미충족)', () => {
      const summary = {
          level: 8, kills: 20, bossKills: 0, relicsFound: 0, totalGold: 200,
          primaryBuild: '균형', difficultyLabel: 'EASY',
          escapes: 0, discoveries: 0, maxKillStreak: 2,
      };
      const result = getRunSummaryAnalysis(summary);
      // level < 10 → 권장 라인 미발생
      assert.ok(
          !result.focus.some((line) => /연속 처치|streak/.test(line)),
          'should be silent at low level even if streak is low'
      );
  });
}
