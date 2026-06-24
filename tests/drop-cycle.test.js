import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildGraveData } from '../src/utils/graveUtils.js';
import { fileURLToPath } from 'node:url';
import { readInventoryActionsSourceSync } from './helpers/inventoryActionsSource.mjs';
import { readFile } from 'node:fs/promises';

/**
 * 드롭(Drop) cycle 테스트 (audit #1 통합 4개)
 */

// ─── cycle-208-legendary-drop-detector-season-xp.test.js ───
{
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.resolve(__dirname, '..');

  /**
   * cycle 208: useLegendaryDropDetector가 SEASON_XP.codexDiscover 누락 path fix
   *   (cycle 193 / cycle 196 패턴 follow-up).
   *
   * 발견 (signature codex XP 적립 누락):
   * - cycle 193: combatVictory에 SEASON_XP.codexDiscover dispatch 추가 (boss drop path).
   * - cycle 196: synthesize / questComplete / craft 3개 inventoryActions path 추가.
   * - 그러나 useLegendaryDropDetector(GameRoot.tsx에서 inv 관찰)는 dispatch(UPDATE_CODEX)만
   *   하고 SEASON_XP 미적립.
   * - 영향:
   *   · 4 quest reward (성검 에테르니아 / 세계수의 지팡이 / 성스러운 창)
   *   · 4 event chain reward (천벌의 지팡이 / 그림자 절단기 / 세계수의 지팡이 / 성스러운 창)
   *   - 위 path로 들어오는 signature는 codex만 등록되고 시즌 XP 적립 안 됨.
   * - cycle 193이 명시한 'key 정의됐으나 dispatch 0건이던 dead config' 시리즈의 잔여.
   *
   * 회귀 가드 (combatVictory 중복 award 방지):
   * - combatVictory가 먼저 registerLootToCodex로 codex 업데이트 + SEASON_XP dispatch.
   * - 이후 inv state propagate → useLegendaryDropDetector observe → 동일 signature 발견.
   * - 이 시점엔 codex에 이미 등록되어 있으므로 detector가 SEASON_XP 또 dispatch하면 double award.
   * - 해결: codex prop을 hook에 전달, 'alreadyInCodex' 체크 후 SEASON_XP gate.
   *
   * 수정:
   * - useLegendaryDropDetector(inv, dispatch, codex=null) — codex 파라미터 추가.
   * - 신규 inv signature 발견 시: codex[bucket][name] 미존재 시에만 SEASON_XP dispatch.
   * - GameRoot.tsx 호출부 codex prop 전달 추가.
   */

  test('cycle 208: useLegendaryDropDetector hook signature에 codex 파라미터 추가', () => {
      const file = path.join(ROOT, 'src/hooks/useLegendaryDropDetector.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(
          content,
          /useLegendaryDropDetector\s*=\s*\(\s*inv:[^)]*,\s*dispatch:[^)]*,\s*codex/,
          'hook signature는 (inv, dispatch, codex) 형태로 codex 파라미터 포함해야 함',
      );
  });

  test('cycle 208: codex 미존재 시에만 SEASON_XP.codexDiscover dispatch (alreadyInCodex 가드)', () => {
      const file = path.join(ROOT, 'src/hooks/useLegendaryDropDetector.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(
          content,
          /alreadyInCodex|codex(?:Ref\.current)?(?:\?\.)?\[bucket\]/,
          'codex[bucket][name] 존재 여부 체크 로직 필요',
      );
      assert.ok(
          content.includes('ADD_SEASON_XP') && content.includes('SEASON_XP'),
          'SEASON_XP.codexDiscover dispatch 코드 필요',
      );
  });

  test('cycle 208: GameRoot.tsx 호출부에 codex prop 전달', () => {
      const file = path.join(ROOT, 'src/components/app/GameRoot.tsx');
      const content = fs.readFileSync(file, 'utf-8');
      assert.match(
          content,
          /useLegendaryDropDetector\s*\([^)]*codex/,
          'GameRoot.tsx에서 useLegendaryDropDetector 호출 시 codex prop 전달 필요',
      );
  });

  test('cycle 193 회귀 가드: combatVictory의 codex SEASON_XP dispatch 유지', () => {
      const file = path.join(ROOT, 'src/hooks/combatActions/combatVictory.ts');
      const content = fs.readFileSync(file, 'utf-8');
      assert.ok(
          content.includes('SEASON_XP.codexDiscover'),
          'combatVictory의 SEASON_XP.codexDiscover dispatch는 유지되어야 함 (cycle 193)',
      );
  });

  test('cycle 196 회귀 가드: useInventoryActions의 SEASON_XP dispatch 유지', () => {
      // PR #4: SEASON_XP.codexDiscover dispatch(market/craft/synthesize)는 economy 서브파일로 이동.
      const content = readInventoryActionsSourceSync();
      const matches = content.match(/SEASON_XP\.codexDiscover/g) || [];
      assert.ok(
          matches.length >= 3,
          `useInventoryActions에 SEASON_XP.codexDiscover dispatch는 3건 이상 유지되어야 함 (cycle 196). actual: ${matches.length}`,
      );
  });
}

// ─── cycle-246-map-grave-drop-bonus.test.js ───
{
  /**
   * cycle 246: MAPS의 graveDropBonus 필드 dead config fix
   *   (cycle 222-245 silent dead config 시리즈 18번째).
   *
   * 발견 (graveDropBonus 미적용):
   * - src/data/maps.ts: '영혼의 강' 지역만 graveDropBonus: 2.0 정의 (lore: "묘비 아이템이 자주
   *   발견됩니다").
   * - 그러나 buildGraveData는 player.gold / 2와 1-2 random items만 dispatch — graveDropBonus
   *   read 0건 → 영원히 보너스 미적용.
   * - 결과: '영혼의 강'의 lore와 데이터 정의가 모순 — 사망 시 다른 지역과 동일한 묘비 보상.
   *
   * 패턴 (cycle 222-245 silent dead config 시리즈 18번째):
   * - cycle 245: BOSS_BRIEFS warningChips/recommendedBuilds UI dispatch 누락 (data → util → struct → UI).
   * - cycle 246: MAPS graveDropBonus dispatch 누락 (data → util 경로).
   *
   * 수정 (src/utils/graveUtils.ts):
   * - buildGraveData에서 player.loc → MAPS[loc].graveDropBonus 조회 (default 1.0).
   * - gold *= bonus, dropCount = ceil(originalCount * bonus) (cap inv length).
   *
   * 회귀 가드:
   * - graveDropBonus 미정의 지역(99% 케이스)은 기존 동작 유지 (gold/2, 1-2 items).
   * - inv 비어있을 시 items 빈 배열 (no error).
   */

  test('cycle 246: 영혼의 강에서 사망 시 graveDropBonus 2.0 → gold 2x', () => {
      const player = {
          name: 'Test', loc: '영혼의 강', gold: 1000,
          inv: [
              { name: 'item1', id: 'a' },
              { name: 'item2', id: 'b' },
              { name: 'item3', id: 'c' },
              { name: 'item4', id: 'd' },
          ],
      };
      // gold default = 1000/2 = 500. bonus 2.0 → 1000.
      const grave = buildGraveData(player, () => 0.5, () => 1000);
      assert.equal(grave.gold, 1000,
          `'영혼의 강' graveDropBonus 2.0 → gold 1000 (실제: ${grave.gold})`);
  });

  test('cycle 246: 일반 지역 사망 시 기본 동작 유지 (회귀 가드)', () => {
      const player = {
          name: 'Test', loc: '슬라임 숲', gold: 1000,
          inv: [
              { name: 'item1', id: 'a' },
              { name: 'item2', id: 'b' },
          ],
      };
      const grave = buildGraveData(player, () => 0.5, () => 1000);
      assert.equal(grave.gold, 500,
          `일반 지역 → gold/2=500 (회귀 가드, 실제: ${grave.gold})`);
  });

  test('cycle 246: 영혼의 강 dropCount 2x', () => {
      const player = {
          name: 'Test', loc: '영혼의 강', gold: 100,
          // 4 items so 2x of 2 dropCount = 4 (cap inv length).
          inv: [
              { name: 'item1', id: 'a' },
              { name: 'item2', id: 'b' },
              { name: 'item3', id: 'c' },
              { name: 'item4', id: 'd' },
          ],
      };
      // random < 0.5 → 1 item default. bonus 2.0 → 2 items.
      const grave = buildGraveData(player, () => 0.4, () => 1000);
      assert.equal(grave.items.length, 2,
          `'영혼의 강' graveDropBonus 2.0 → 2 items (default 1 * 2, 실제: ${grave.items.length})`);
  });

  test('cycle 246: graveDropBonus inv 부족 시 cap', () => {
      const player = {
          name: 'Test', loc: '영혼의 강', gold: 100,
          inv: [{ name: 'item1', id: 'a' }],
      };
      // 1 item × 2.0 = 2이지만 inv 1개라서 1로 cap.
      const grave = buildGraveData(player, () => 0.4, () => 1000);
      assert.equal(grave.items.length, 1,
          `inv 1개 한계 → 1 item cap (실제: ${grave.items.length})`);
  });

  test('cycle 246: 영혼의 강 graveDropBonus 데이터 보존 (회귀 가드)', async () => {
      const { MAPS } = await import('../src/data/maps.js');
      assert.ok(MAPS['영혼의 강'], "'영혼의 강' 지역 데이터 존재");
      assert.equal(MAPS['영혼의 강'].graveDropBonus, 2.0,
          'graveDropBonus 2.0 데이터 회귀 가드');
  });

  test('cycle 246: 빈 inv 시 items 빈 배열 (안전 가드)', () => {
      const player = {
          name: 'Test', loc: '영혼의 강', gold: 100,
          inv: [],
      };
      const grave = buildGraveData(player, () => 0.4, () => 1000);
      assert.deepEqual(grave.items, [], 'inv 비어있을 시 items=[]');
      assert.equal(grave.gold, 100, '빈 inv여도 gold bonus는 적용');
  });
}

// ─── cycle-462-job-change-panel-class-card-player-dropped.test.js ───
{
  /**
   * cycle 462: JobChangePanel `<ClassCard player={player}>` silently dropped attr 정리
   *   (cycle 222-461 silent dead config 시리즈 217번째 — silent UI dropped attribute
   *   cleanup lens, cycle 405 / 461 paired completion).
   *
   * 발견 (1 silently dropped attribute):
   * - src/components/tabs/JobChangePanel.tsx (line 51-57):
   *     <ClassCard
   *         key={job}
   *         jobName={job}
   *         player={player}              ← silently dropped
   *         onSelect={...}
   *         disabled={...}
   *     />
   * - ClassCard 시그니처 (cycle 461 cleanup 후):
   *     const ClassCard = ({ jobName, onSelect, disabled = false }: any) => {...}
   * - 결과: `player` prop이 destructure에 없어 silently dropped. caller가 보내지만
   *   ClassCard 본체에서 read 0건.
   *
   * 패턴 (cycle 222-461 시리즈 217번째):
   * - cycle 405: Codex `compact?: boolean` interface dead — Dashboard pass했으나
   *   silent dropped이라 paired remove.
   * - cycle 461: ClassCard compact prop unreachable cleanup 후, JobChangePanel
   *   callsite도 점검하니 `player` prop이 silently dropped이었음을 추가 발견.
   *
   * 수정 (src/components/tabs/JobChangePanel.tsx):
   * - <ClassCard> JSX에서 player={player} 한 줄 제거.
   *
   * 회귀 가드:
   * - jobName / onSelect / disabled / key prop 보존.
   * - ClassCard 동작 변동 0 (player 본체 read 0건이라 영향 없음).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 462: <ClassCard> 호출에서 player prop 0건', async () => {
      const source = await readSrc('src/components/tabs/JobChangePanel.tsx');
      const idx = source.indexOf('<ClassCard');
      assert.ok(idx >= 0, '<ClassCard> 호출 존재');
      const jsxEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, jsxEnd);
      assert.ok(!/player=\{player\}/.test(jsx), 'player={player} 제거');
      // disabled={player.level < ...}의 player는 expression 내부 active read이므로 보존.
      // prop으로서의 player 전달만 제거됐는지 확인.
      assert.ok(!/^\s*player=\{player\}/m.test(jsx), 'prop player={player} 라인 0건');
  });

  test('cycle 462: 정합성 가드 — ClassCard destructure에 player 없음', async () => {
      const source = await readSrc('src/components/ClassCard.tsx');
      const fnIdx = source.indexOf('const ClassCard =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bplayer\b/.test(sig), 'ClassCard destructure에 player 0건');
  });

  test('cycle 462: jobName / onSelect / disabled prop 보존', async () => {
      const source = await readSrc('src/components/tabs/JobChangePanel.tsx');
      const idx = source.indexOf('<ClassCard');
      const jsxEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, jsxEnd);
      assert.ok(/jobName=\{job\}/.test(jsx), 'jobName 보존');
      assert.ok(/onSelect=\{/.test(jsx), 'onSelect 보존');
      assert.ok(/disabled=\{/.test(jsx), 'disabled 보존');
  });
}

// ─── cycle-563-use-legendary-drop-detector-defaults-batch.test.js ───
{
  /**
   * cycle 563: useLegendaryDropDetector `dispatch = null` + `codex = null`
   *   2 defaults batch unreachable (cycle 222-562 silent dead config 시리즈
   *   303번째 — redundant default annotation 청소 메가 시리즈 56번째).
   *
   * 발견 (2 defaults batch):
   * - src/hooks/useLegendaryDropDetector.ts (line 34):
   *     export const useLegendaryDropDetector = (inv: any, dispatch: any = null,
   *         codex: any = null) => {...};
   * - 호출 사이트 (1 caller):
   *     · GameRoot.tsx:32 — useLegendaryDropDetector(engine.player?.inv,
   *       engine.dispatch, engine.player?.stats?.codex) — 3 args 명시.
   *     · 다른 caller 0건 (test caller 0건).
   * - 결과: dispatch / codex 항상 명시 전달. 두 default 모두 도달 불가.
   *
   * 패턴 (cycle 222-562 시리즈 303번째):
   * - cycle 502-562: default 청소 메가 시리즈 61사이클.
   * - cycle 563: hooks/ 추가 cleanup — cycle 532/534/535/543에 이은 hooks/.
   *
   * 수정 (src/hooks/useLegendaryDropDetector.ts):
   * - signature에서 dispatch: any = null → dispatch: any.
   * - signature에서 codex: any = null → codex: any.
   * - body의 codexRef 처리 + dispatch 호출 보존.
   *
   * 회귀 가드:
   * - 1 production callsite 동작 그대로.
   * - body codexRef / queueRef / dispatch 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 563: useLegendaryDropDetector signature에서 2 defaults 0건', async () => {
      const source = await readSrc('src/hooks/useLegendaryDropDetector.ts');
      const fnIdx = source.indexOf('export const useLegendaryDropDetector');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/dispatch:\s*any\s*=\s*null/.test(sig),
          'useLegendaryDropDetector dispatch default null 제거');
      assert.ok(!/codex:\s*any\s*=\s*null/.test(sig),
          'useLegendaryDropDetector codex default null 제거');
  });

  test('cycle 563: 정합성 가드 — 1 production callsite 보존', async () => {
      const source = await readSrc('src/components/app/GameRoot.tsx');
      assert.ok(/useLegendaryDropDetector\(engine\.player\?\.inv,\s*engine\.dispatch,\s*engine\.player\?\.stats\?\.codex\)/.test(source),
          'GameRoot useLegendaryDropDetector 3 args callsite 보존');
  });

  test('cycle 563: body codexRef / queueRef / dispatch 처리 보존', async () => {
      const source = await readSrc('src/hooks/useLegendaryDropDetector.ts');
      assert.ok(/const codexRef = useRef<any>\(codex\)/.test(source),
          'codexRef useRef(codex) 보존');
      assert.ok(/const queueRef = useRef<any\[\]>\(\[\]\)/.test(source),
          'queueRef useRef<any[]>([]) 보존');
  });

  test('cycle 563: cycle 502-562 회귀 가드 — default 청소 시리즈 보존', async () => {
      const helpers = await readSrc('src/reducers/handlers/helpers.ts');
      assert.ok(!/sanitizeQuickSlots[^=]*slots:\s*any\s*=\s*\[\]/.test(helpers),
          'cycle 562 sanitizeQuickSlots slots default 0건');

      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/export const buildEventPackage[^=]*context:\s*any\s*=\s*\{\}/.test(aiu),
          'cycle 561 buildEventPackage context default 0건');
  });
}
