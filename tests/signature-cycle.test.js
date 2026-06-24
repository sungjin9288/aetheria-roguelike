import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { AT } from '../src/reducers/actionTypes.js';
import { INITIAL_STATE, gameReducer } from '../src/reducers/gameReducer.js';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/**
 * 시그니처(Signature) cycle 테스트 (audit #1 통합 13개)
 */

// ─── cycle-212-signature-pity-preserve.test.js ───
{
  /**
   * cycle 212: ASCEND / RESET_GAME이 signaturePity mercy 카운터 보존
   *   (cycle 75 mercy + cycle 191 META preserve 정합).
   *
   * 발견 (handleDefeat vs ASCEND/RESET 비대칭):
   * - signaturePity (cycle 75): signature 드롭 anti-frustration mercy 카운터.
   *   · 보스 토벌 + signature 미획득 → pity += 1
   *   · signature 드롭 → pity = 0
   *   · getSignaturePityMultiplier(pity) → 다음 보스 signature 확률 step-wise 배율.
   * - handleDefeat: starterState.stats = {...starterState.stats, ...prevStats, ...} →
   *   prevStats spread로 signaturePity 보존 (multi-run mercy 의도와 정합).
   * - 그러나 ASCEND(progressionHandlers.ts) / RESET_GAME(cycle 204)의 stats 보존 list에
   *   signaturePity 미포함 → INITIAL_STATE.stats에 없으므로 reset (undefined).
   *
   * 결과 (mercy 시스템 무력화):
   * - 플레이어가 30 보스 토벌 동안 signature 미획득 → pity=30 (배율 1.9x).
   * - ASCEND → pity=0 → 다음 보스 signature 확률이 base로 강하 → mercy 시스템 작동 차단.
   * - 명시적 anti-frustration 설계 의도 위반.
   *
   * 정합성:
   * - handleDefeat: 보존 ✓ (cycle 191 META preserve와 같은 결).
   * - ASCEND: 보존 필요 (cycle 119 multi-run 카운터 preserve series 합류).
   * - RESET_GAME: 보존 필요 (cycle 204 align).
   *
   * 수정 (src/reducers/handlers/progressionHandlers.ts):
   * - ASCEND stats preserve list에 signaturePity 추가.
   * - RESET_GAME stats preserve list에 동일 추가.
   * - 미정의 시 0 fallback (구형 save 호환, 기본 mercy 1.0x로 시작).
   */

  const buildState = (statsOverrides = {}) => ({
      ...INITIAL_STATE,
      player: {
          ...INITIAL_STATE.player,
          name: 'Test',
          gender: 'male',
          meta: { essence: 0, rank: 0, prestigeRank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 },
          stats: {
              ...INITIAL_STATE.player.stats,
              kills: 100,
              ...statsOverrides,
          },
      },
      grave: null,
      uid: 'test-uid',
      bootStage: 'ready',
  });

  const ASCEND_PAYLOAD = {
      meta: { essence: 100, rank: 1, prestigeRank: 1, bonusAtk: 5, bonusHp: 50, bonusMp: 25 },
      newTitle: '각성자',
  };

  test('cycle 212: ASCEND가 signaturePity mercy 카운터 보존', () => {
      const state = buildState({ signaturePity: 30 });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.signaturePity, 30,
          'signaturePity는 multi-run mercy 카운터 — ASCEND 시 보존 필요 (anti-frustration 설계)');
  });

  test('cycle 212: RESET_GAME이 signaturePity 보존', () => {
      const state = buildState({ signaturePity: 15 });
      const next = gameReducer(state, { type: AT.RESET_GAME });
      assert.equal(next.player.stats.signaturePity, 15);
  });

  test('cycle 212: signaturePity 미정의(구형 save) → 0 fallback', () => {
      const state = buildState({});
      delete state.player.stats.signaturePity;
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      const reset = gameReducer(state, { type: AT.RESET_GAME });
      assert.equal(ascended.player.stats.signaturePity || 0, 0);
      assert.equal(reset.player.stats.signaturePity || 0, 0);
  });

  test('cycle 212: signaturePity 0 (mercy 미적립 상태)는 그대로 0', () => {
      const state = buildState({ signaturePity: 0 });
      const next = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      assert.equal(next.player.stats.signaturePity, 0);
  });

  test('cycle 211/202/119 회귀 가드: 다른 stats 보존 동시 유지', () => {
      const state = buildState({
          signaturePity: 25,
          codexBonusAtk: 10,
          codexBonusDef: 5,
          codexBonusHp: 100,
          kills: 500,
          cosmeticTitles: ['별을 보는 자'],
          synthProtects: 2,
          claimedAchievements: ['ach_test'],
          explores: 100,
      });
      const ascended = gameReducer(state, { type: AT.ASCEND, payload: ASCEND_PAYLOAD });
      // cycle 211
      assert.equal(ascended.player.stats.codexBonusAtk, 10);
      assert.equal(ascended.player.stats.codexBonusDef, 5);
      assert.equal(ascended.player.stats.codexBonusHp, 100);
      // cycle 119
      assert.equal(ascended.player.stats.kills, 500);
      // cycle 188
      assert.deepEqual(ascended.player.stats.cosmeticTitles, ['별을 보는 자']);
      assert.equal(ascended.player.stats.synthProtects, 2);
      // cycle 202
      assert.deepEqual(ascended.player.stats.claimedAchievements, ['ach_test']);
      // cycle 203
      assert.equal(ascended.player.stats.explores, 100);
      // cycle 212
      assert.equal(ascended.player.stats.signaturePity, 25);
  });

  test('cycle 212: handleDefeat preserves signaturePity (이미 정합 — 회귀 가드)', async () => {
      const { CombatEngine } = await import('../src/systems/CombatEngine.js');
      const player = {
          ...INITIAL_STATE.player,
          name: 'Test',
          hp: 0,
          maxHp: 100,
          stats: { ...INITIAL_STATE.player.stats, signaturePity: 12 },
      };
      const result = CombatEngine.handleDefeat(player, INITIAL_STATE.player);
      assert.equal(result.updatedPlayer.stats.signaturePity, 12,
          'handleDefeat은 signaturePity를 ...prevStats spread로 보존 — 회귀 가드');
  });
}

// ─── cycle-269-combat-panel-boss-signature.test.js ───
{
  /**
   * cycle 269: CombatPanel 보스 signature/counterHint UI dispatch 누락 dead config
   *   (cycle 222-268 silent dead config 시리즈 40번째).
   *
   * 발견 (UI dispatch lens):
   * - getEnemyTacticalProfile은 BOSS_BRIEFS의 signature(보스 mechanic 광고) / counterHint(대응 전략) /
   *   role / tier / estimatedHit / estimatedHeavy / phaseTriggered 등 풍부한 fields 반환.
   * - 그러나 CombatPanel.tsx는 tacticalProfile.entryHint/hint/phaseHint 3종만 read하고
   *   나머지 14+ 필드 dispatch 0건. signature, counterHint 등 보스 전술 핵심 정보가
   *   영원히 in-combat UI invisible.
   * - Bestiary는 cycle 245에서 signature/counterHint render했지만, in-combat에선 안 보여 player가
   *   보스 mechanic 잊어버림.
   *
   * 패턴 (cycle 222-268 silent dead config 시리즈 40번째):
   * - cycle 245: BOSS_BRIEFS warningChips/recommendedBuilds Bestiary UI dispatch.
   * - cycle 250: stats.activeSet StatsPanel UI dispatch.
   * - cycle 269: tacticalProfile.signature/counterHint CombatPanel UI dispatch (in-combat lens).
   *
   * 수정 (src/components/tabs/CombatPanel.tsx):
   * - 보스 전술 박스에 signature(기믹) / counterHint(대응) 추가 (조건부 렌더링).
   * - 기존 bossBriefLine (entryHint/hint/phaseHint) 유지.
   *
   * 회귀 가드:
   * - bossBriefLine 동작 유지.
   * - non-boss enemy 시 변화 없음.
   * - signature/counterHint 미정의 보스도 안전 (조건부 렌더링).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 269: CombatPanel이 tacticalProfile.signature read', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.ok(/tacticalProfile\?.signature|tacticalProfile\.signature/.test(source),
          'CombatPanel은 tacticalProfile.signature 접근');
  });

  test('cycle 269: CombatPanel이 tacticalProfile.counterHint read', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.ok(/tacticalProfile\?.counterHint|tacticalProfile\.counterHint/.test(source),
          'CombatPanel은 tacticalProfile.counterHint 접근');
  });

  test('cycle 269: 조건부 렌더링 (signature/counterHint 미정의 시 미표시)', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      // `{tacticalProfile?.signature && ...}` 패턴.
      assert.ok(/tacticalProfile\?\.signature\s*&&/.test(source),
          'signature 조건부 렌더링');
      assert.ok(/tacticalProfile\?\.counterHint\s*&&/.test(source),
          'counterHint 조건부 렌더링');
  });

  test('cycle 269: testid 노출 — 검증 hook', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.ok(/data-testid=['"]combat-boss-signature['"]/.test(source),
          'combat-boss-signature testid');
      assert.ok(/data-testid=['"]combat-boss-counter['"]/.test(source),
          'combat-boss-counter testid');
  });

  test('cycle 269: 기존 bossBriefLine 동작 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/components/tabs/CombatPanel.tsx');
      assert.ok(/bossBriefLine/.test(source), 'bossBriefLine 변수 유지');
      assert.ok(/보스 전술/.test(source), '보스 전술 라벨 유지');
  });
}

// ─── cycle-282-player-signaturepity-dead.test.js ───
{
  /**
   * cycle 282: Player.signaturePity / SignaturePity 인터페이스 dead 필드 cleanup
   *   (cycle 222-281 silent dead config 시리즈 52번째 — cleanup lens 연속).
   *
   * 발견 (top-level vs nested 혼동):
   * - src/types/player.ts Player interface line 155: `signaturePity?: SignaturePity | number`.
   * - 그러나 active signaturePity는 player.stats.signaturePity (nested) — top-level 접근 0건.
   * - SignaturePity 인터페이스 (line 53)는 Player.signaturePity 외 consumer 없음.
   * - 모든 production read: `player?.stats?.signaturePity` (number 형식).
   *
   * 패턴 (cycle 222-281 silent dead config 시리즈 52번째):
   * - cycle 280: PlayerStats 타입 dead 필드 제거.
   * - cycle 281: PlayerMeta 타입 dead 필드 제거.
   * - cycle 282: Player 타입 dead 필드 제거 (cleanup lens 연속).
   *
   * 수정 (src/types/player.ts):
   * - Player interface에서 signaturePity 필드 제거.
   * - SignaturePity interface 제거 (consumer 0건).
   *
   * 회귀 가드:
   * - player.stats.signaturePity dispatch 동작 유지 (cycle 75 mercy 카운터).
   * - getSignaturePityMultiplier / SIGNATURE_PITY constant 동작 유지.
   * - [key: string]: any index signature 유지로 동적 필드 호환.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 282: Player interface에서 signaturePity 제거', async () => {
      const source = await readSrc('src/types/player.ts');
      const playerBlock = source.match(/export interface Player \{[\s\S]+?\n\}/);
      assert.ok(playerBlock, 'Player interface 발견');
      assert.ok(!/signaturePity\?:\s*SignaturePity/.test(playerBlock[0]),
          'Player.signaturePity 제거됨');
  });

  test('cycle 282: SignaturePity interface 제거', async () => {
      const source = await readSrc('src/types/player.ts');
      assert.ok(!/export interface SignaturePity/.test(source),
          'SignaturePity interface 제거됨');
  });

  test('cycle 282: player.stats.signaturePity dispatch 유지 (회귀 가드)', async () => {
      const sources = await Promise.all([
          readSrc('src/utils/adventureGuide.ts'),
          readSrc('src/components/codex/LegendaryCodex.tsx'),
          readSrc('src/hooks/gameActions/exploreActions.ts'),
      ]);
      sources.forEach((src, i) => {
          assert.ok(/player[\?.]+stats[\?.]+signaturePity/.test(src),
              `[file ${i}] player.stats.signaturePity dispatch 유지`);
      });
  });

  test('cycle 282: getSignaturePityMultiplier / SIGNATURE_PITY 유지 (회귀 가드)', async () => {
      const source = await readSrc('src/utils/signaturePity.ts');
      assert.ok(/getSignaturePityMultiplier/.test(source),
          'getSignaturePityMultiplier 함수 유지');
      assert.ok(/SIGNATURE_PITY/.test(source),
          'SIGNATURE_PITY constant 유지');
  });

  test('cycle 280-281 회귀 가드: 이전 cleanup 동작 유지', async () => {
      const source = await readSrc('src/types/player.ts');
      // cycle 299: PlayerStats / PlayerMeta export 제거 (private) → 정의 유지.
      const statsBlock = source.match(/(?:export )?interface PlayerStats[\s\S]+?\n\}/);
      const metaBlock = source.match(/(?:export )?interface PlayerMeta[\s\S]+?\n\}/);
      assert.ok(statsBlock && !/comboCount\?:\s*number;/.test(statsBlock[0]),
          'cycle 280 PlayerStats.comboCount 0건');
      assert.ok(statsBlock && !/discoveries\?:\s*number;/.test(statsBlock[0]),
          'cycle 280 PlayerStats.discoveries 0건');
      assert.ok(metaBlock && !/totalPrestigeAtk\?:/.test(metaBlock[0]),
          'cycle 281 PlayerMeta.totalPrestigeAtk 0건');
  });
}

// ─── cycle-330-signal-badge-signature-tone.test.js ───
{
  /**
   * cycle 330: SignalBadge 'signature' tone class dead 제거 (cycle 310 cascade)
   *   (cycle 222-329 silent dead config 시리즈 99번째 — cleanup lens 연속).
   *
   * 발견 (dead tone class):
   * - src/components/SignalBadge.tsx: TONE_CLASS.signature — gold 팔레트 정의.
   * - cycle 23 시점 FocusPanel `'확률 증폭'` emphasis surface가 유일 consumer였음.
   * - cycle 310 FocusPanel 제거 후 dispatch path 0건. tone class cascade dead.
   *
   * 비교 — 다른 9 tone class는 active:
   * - neutral / recommended / resonance / upgrade / success / warning / danger /
   *   equipped / spotlight 모두 JSX `tone="..."` 사용처 보유.
   *
   * 패턴 (cycle 222-329 silent dead config 시리즈 99번째):
   * - cycle 329: useGameTestApi 3 dead methods 제거.
   * - cycle 330: SignalBadge signature tone cascade dead (cycle 310 paired).
   *
   * 수정 (src/components/SignalBadge.tsx):
   * - TONE_CLASS.signature 키 제거 (4 lines: 주석 + 키-값).
   *
   * 회귀 가드:
   * - 다른 9 tone class 보존.
   * - SignalBadge default tone neutral fallback 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 330: SignalBadge signature tone class 제거', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      // signature 키 정의 제거 (TONE_CLASS 객체에서).
      assert.ok(!/^\s+signature:\s*'border/m.test(source),
          'signature tone class 제거됨');
  });

  test('cycle 330: SignalBadge 9 active tone classes 보존', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      const aliveTones = ['neutral', 'recommended', 'resonance', 'upgrade', 'success', 'warning', 'danger', 'equipped', 'spotlight'];
      aliveTones.forEach((name) => {
          const re = new RegExp(`^\\s+${name}:\\s*'`, 'm');
          assert.ok(re.test(source), `${name} tone class 보존`);
      });
  });

  test('cycle 330: SignalBadge default export 보존', async () => {
      const source = await readSrc('src/components/SignalBadge.tsx');
      assert.ok(/export default SignalBadge/.test(source),
          'SignalBadge default export 보존');
  });

  test('cycle 329 회귀 가드: useGameTestApi 3 dead methods 제거 보존', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/getState:\s*\(\)/.test(source), 'cycle 329 getState 제거 보존');
      assert.ok(!/clearPostCombat:\s*\(\)/.test(source), 'cycle 329 clearPostCombat 제거 보존');
      assert.ok(!/injectAscensionPreview:\s*\(\)/.test(source),
          'cycle 329 injectAscensionPreview 제거 보존');
  });
}

// ─── cycle-358-signature-tone-steel-dead.test.js ───
{
  /**
   * cycle 358: signature tone steel 2 entries dead 정리 (LegendaryDropOverlay + LegendaryCodex)
   *   (cycle 222-357 silent dead config 시리즈 125번째 — cleanup lens 연속).
   *
   * 발견 (2 dead tone entries — same key, 2 components):
   * - LegendaryDropOverlay.tsx TONE_GLOW.steel (3 sub-fields).
   * - LegendaryCodex.tsx TONE_ACCENT.steel (3 sub-fields).
   * - signatureRegistry.json / signatureSets.json 어디에도 tone='steel' 0건.
   *   활성 tone: holy / fire / frost / shadow / arcane / nature / earth / rust 8종만 사용.
   *   steel은 두 lookup 테이블에서 정의됐지만 실 데이터에서 0건이라 unreachable.
   *
   * 패턴 (cycle 222-357 silent dead config 시리즈 125번째):
   * - cycle 357: FALLBACK_EVENT_POOL '시작의 마을' 12 events unreachable dead.
   * - cycle 358: TONE_GLOW.steel / TONE_ACCENT.steel 2 entries unreachable dead.
   *
   * 수정:
   * - src/components/LegendaryDropOverlay.tsx: TONE_GLOW.steel 엔트리 제거.
   * - src/components/codex/LegendaryCodex.tsx: TONE_ACCENT.steel 엔트리 제거.
   *
   * 회귀 가드:
   * - 활성 8 tone (holy/fire/frost/shadow/arcane/nature/earth/rust) 보존.
   * - DEFAULT_GLOW = TONE_GLOW.holy / DEFAULT_TONE_ACCENT = TONE_ACCENT.holy fallback 보존.
   * - meta?.tone lookup의 || fallback 안전망 동일.
   * - equipmentArt.ts TONE_PALETTES.steel (별도 시스템 — 일반 장비) 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 358: TONE_GLOW.steel 0건 (LegendaryDropOverlay)', async () => {
      const source = await readSrc('src/components/LegendaryDropOverlay.tsx');
      const fnStart = source.indexOf('const TONE_GLOW');
      const fnEnd = source.indexOf('const DEFAULT_GLOW');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(!/^\s+steel:/m.test(block),
          'TONE_GLOW에서 steel entry 0건');
  });

  test('cycle 358: TONE_ACCENT.steel 0건 (LegendaryCodex)', async () => {
      const source = await readSrc('src/components/codex/LegendaryCodex.tsx');
      const fnStart = source.indexOf('const TONE_ACCENT');
      const fnEnd = source.indexOf('const CATEGORY_LABEL');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(!/^\s+steel:/m.test(block),
          'TONE_ACCENT에서 steel entry 0건');
  });

  test('cycle 358: 활성 8 tone 보존 (회귀 가드)', async () => {
      const overlay = await readSrc('src/components/LegendaryDropOverlay.tsx');
      const codex = await readSrc('src/components/codex/LegendaryCodex.tsx');
      const activeTones = ['holy', 'fire', 'frost', 'shadow', 'arcane', 'nature', 'earth', 'rust'];
      for (const tone of activeTones) {
          assert.ok(new RegExp(`^\\s+${tone}:`, 'm').test(overlay), `TONE_GLOW.${tone} 보존`);
          assert.ok(new RegExp(`^\\s+${tone}:`, 'm').test(codex), `TONE_ACCENT.${tone} 보존`);
      }
  });

  test('cycle 358: DEFAULT_GLOW / DEFAULT_TONE_ACCENT fallback 보존', async () => {
      const overlay = await readSrc('src/components/LegendaryDropOverlay.tsx');
      const codex = await readSrc('src/components/codex/LegendaryCodex.tsx');
      assert.ok(/DEFAULT_GLOW = TONE_GLOW\.holy/.test(overlay),
          'DEFAULT_GLOW = TONE_GLOW.holy fallback 보존');
      assert.ok(/DEFAULT_TONE_ACCENT = TONE_ACCENT\.holy/.test(codex),
          'DEFAULT_TONE_ACCENT = TONE_ACCENT.holy fallback 보존');
  });

  test('cycle 357 회귀 가드: FALLBACK_EVENT_POOL \'시작의 마을\' 0건 보존', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnStart = source.indexOf('const FALLBACK_EVENT_POOL');
      const fnEnd = source.indexOf('export const pickFallbackEvent');
      const block = source.slice(fnStart, fnEnd);
      assert.ok(!/'시작의 마을':/.test(block),
          'cycle 357 \'시작의 마을\' 0건 보존');
  });
}

// ─── cycle-412-item-icon-signature-tone-ring-steel.test.js ───
{
  /**
   * cycle 412: ItemIcon SIGNATURE_TONE_RING `steel` unreachable 정리
   *   (cycle 222-411 silent dead config 시리즈 173번째 — unreachable lens 회귀, cycle 358 paired completion).
   *
   * 발견 (1 dead lookup entry):
   * - src/components/icons/ItemIcon.tsx SIGNATURE_TONE_RING: 9 키
   *   (holy/fire/frost/shadow/arcane/nature/earth/steel/rust).
   * - lookup 사이트: `SIGNATURE_TONE_RING[getSignatureMetadata(item)?.tone] || SIGNATURE_TONE_RING.holy`.
   * - signatureRegistry.json tones: arcane/earth/fire/frost/holy/nature/rust/shadow 8종 emit —
   *   `steel` 0건.
   * - 결과: SIGNATURE_TONE_RING.steel lookup 절대 hit 안 됨.
   * - cycle 358에서 LegendaryDropOverlay TONE_GLOW.steel + LegendaryCodex
   *   TONE_ACCENT.steel batch 제거 — 이때 ItemIcon 누락. cycle 358 paired completion.
   *
   * 패턴 (cycle 222-411 시리즈 173번째):
   * - cycle 358: TONE_GLOW.steel + TONE_ACCENT.steel batch (2 components).
   * - cycle 411: SIG_SET_TONE.frost / arcane batch (2 components).
   * - cycle 412: SIGNATURE_TONE_RING.steel 정리 — cycle 358 누락분 paired completion.
   *   동일 lens 회귀 — 데이터 정합성 기반.
   *
   * 수정 (src/components/icons/ItemIcon.tsx):
   * - SIGNATURE_TONE_RING에서 `steel` 라인 제거.
   *
   * 회귀 가드:
   * - holy/fire/frost/shadow/arcane/nature/earth/rust 8 tone 보존.
   * - fallback `|| SIGNATURE_TONE_RING.holy` 동작 그대로.
   * - signatureRegistry.json 데이터 무영향.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 412: ItemIcon SIGNATURE_TONE_RING에서 steel 0건', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      const blockStart = source.indexOf('const SIGNATURE_TONE_RING');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+steel:/m.test(block),
          'SIGNATURE_TONE_RING에서 steel 0건');
  });

  test('cycle 412: 활성 8 tone 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      const blockStart = source.indexOf('const SIGNATURE_TONE_RING');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      for (const tone of ['holy', 'fire', 'frost', 'shadow', 'arcane', 'nature', 'earth', 'rust']) {
          const re = new RegExp(`^\\s+${tone}:`, 'm');
          assert.ok(re.test(block), `${tone} tone 보존`);
      }
  });

  test('cycle 412: 정합성 가드 — signatureRegistry.json은 8 tone만 emit (no steel)', async () => {
      const reg = JSON.parse(await readSrc('src/data/signatureRegistry.json'));
      const tones = new Set(Object.values(reg.entries).map((e) => e.tone).filter(Boolean));
      assert.ok(!tones.has('steel'), 'steel tone 0건 (정합성)');
      assert.ok(tones.has('holy') && tones.has('fire'), 'holy/fire 활성 보존');
  });

  test('cycle 411 회귀 가드: SIG_SET_TONE frost/arcane 0건', async () => {
      for (const f of ['src/components/StatsPanel.tsx', 'src/components/EquipmentPanel.tsx']) {
          const source = await readSrc(f);
          const blockStart = source.indexOf('const SIG_SET_TONE');
          const blockEnd = source.indexOf('});', blockStart);
          const block = source.slice(blockStart, blockEnd);
          assert.ok(!/^\s+frost:/m.test(block), `${f} frost 0건 보존`);
          assert.ok(!/^\s+arcane:/m.test(block), `${f} arcane 0건 보존`);
      }
  });
}

// ─── cycle-413-signature-badge-tone-colors-steel.test.js ───
{
  /**
   * cycle 413: SignatureBadge TONE_COLORS `steel` unreachable 정리
   *   (cycle 222-412 silent dead config 시리즈 174번째 — unreachable lens 회귀,
   *   cycle 358 / 412 paired completion).
   *
   * 발견 (1 dead lookup entry):
   * - src/components/icons/SignatureBadge.tsx TONE_COLORS:
   *   8 키 (holy/fire/frost/shadow/arcane/nature/earth/steel).
   * - lookup 사이트: `TONE_COLORS[meta?.tone] || DEFAULT_TONE_COLOR`.
   * - signatureRegistry.json tones: arcane/earth/fire/frost/holy/nature/rust/shadow
   *   8종 emit — `steel` 0건 (정합성 가드).
   * - 결과: TONE_COLORS.steel lookup 절대 hit 안 됨.
   * - cycle 358 / 412 paired completion — TONE_GLOW(LegendaryDropOverlay) /
   *   TONE_ACCENT(LegendaryCodex) / SIGNATURE_TONE_RING(ItemIcon) 모두 steel 정리,
   *   SignatureBadge만 누락분.
   *
   * 패턴 (cycle 222-412 시리즈 174번째):
   * - cycle 358: TONE_GLOW.steel + TONE_ACCENT.steel batch.
   * - cycle 411: SIG_SET_TONE.frost / arcane batch.
   * - cycle 412: SIGNATURE_TONE_RING.steel.
   * - cycle 413: SignatureBadge TONE_COLORS.steel — cycle 358/412 paired completion.
   *
   * 수정 (src/components/icons/SignatureBadge.tsx):
   * - TONE_COLORS에서 `steel` 라인 제거.
   *
   * 회귀 가드:
   * - holy/fire/frost/shadow/arcane/nature/earth 7 tone 보존.
   * - DEFAULT_TONE_COLOR fallback (holy) 동작 그대로.
   * - signatureRegistry.json 데이터 무영향.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 413: SignatureBadge TONE_COLORS에서 steel 0건', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      const blockStart = source.indexOf('const TONE_COLORS');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+steel:/m.test(block),
          'TONE_COLORS에서 steel 0건');
  });

  test('cycle 413: 활성 tone 7종 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      const blockStart = source.indexOf('const TONE_COLORS');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      for (const tone of ['holy', 'fire', 'frost', 'shadow', 'arcane', 'nature', 'earth']) {
          const re = new RegExp(`^\\s+${tone}:`, 'm');
          assert.ok(re.test(block), `${tone} tone 보존`);
      }
  });

  test('cycle 413: 정합성 가드 — signatureRegistry.json은 steel tone 0건', async () => {
      const reg = JSON.parse(await readSrc('src/data/signatureRegistry.json'));
      const tones = new Set(Object.values(reg.entries).map((e) => e.tone).filter(Boolean));
      assert.ok(!tones.has('steel'), 'steel tone 0건');
  });

  test('cycle 412 회귀 가드: ItemIcon SIGNATURE_TONE_RING.steel 0건', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      const blockStart = source.indexOf('const SIGNATURE_TONE_RING');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+steel:/m.test(block),
          'cycle 412 SIGNATURE_TONE_RING.steel 0건 보존');
  });
}

// ─── cycle-426-signature-set-active-mult-restore.test.js ───
{
  /**
   * cycle 426: computeSignatureSetBonus.activeSet에 atkMult/defMult/hpMult 복원
   *   (cycle 222-425 silent dead config 시리즈 186번째 — silent UI 결손 lens
   *   회귀, cycle 396/398 schema 미스매치 패턴).
   *
   * 발견 (silent UI regression — cycle 348 잘못된 cleanup):
   * - cycle 348 cleanup이 `activeSet` 내부의 atkMult/defMult/hpMult 3 필드를
   *   "dead — 부모 return에 동일 필드"라며 제거.
   * - 그러나 StatsPanel.tsx (line 220/228/236)는 `activeSignatureSet.atkMult`
   *   `.defMult` `.hpMult`를 직접 read해서 formatMultDelta로 표시.
   * - statsCalculator (line 367/408)는 `signatureSetBonus.activeSet`을
   *   `stats.activeSignatureSet`로 노출 → StatsPanel은 이 inner object만 read.
   * - 결과: 2 signature 같은 세트 착용 시 ATK/DEF/HP delta가 모두 '—'로 표시
   *   (formatMultDelta(undefined) → '—'). Silent UI 결손.
   *
   * 패턴 (cycle 222-425 시리즈 186번째):
   * - cycle 396: StatsPanel syn.name → syn.label schema 미스매치 fix.
   * - cycle 398: DashboardMobileSummary trait.label → trait.title schema 미스매치 fix.
   * - cycle 426: signatureSetBonus.activeSet 3 필드 schema 정합 복원 — 동일 lens 회귀.
   *
   * 수정 (src/utils/signatureSetBonus.ts):
   * - activeSet에 atkMult / defMult / hpMult 복원.
   * - cycle 348 코멘트 갱신.
   *
   * 회귀 가드:
   * - 부모 return의 atkMult/defMult/hpMult 그대로 (statsCalculator 사용).
   * - activeSet의 다른 필드 (key/name/tone/count/tier/desc) 그대로.
   * - StatsPanel에서 2-set 착용 시 formatMultDelta가 의미 있는 % 표시.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 426: computeSignatureSetBonus 2-set 착용 시 activeSet에 atkMult/defMult/hpMult 노출', async () => {
      const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.ts');
      const equip = {
          weapon: { name: '성검 에테르니아' },
          offhand: { name: '천공 성전' },
          armor: null,
      };
      const result = computeSignatureSetBonus(equip);
      assert.ok(result.activeSet, 'activeSet 객체 노출');
      assert.equal(typeof result.activeSet.atkMult, 'number', 'activeSet.atkMult number');
      assert.equal(typeof result.activeSet.defMult, 'number', 'activeSet.defMult number');
      assert.equal(typeof result.activeSet.hpMult, 'number', 'activeSet.hpMult number');
      assert.equal(result.activeSet.atkMult, result.atkMult, 'activeSet.atkMult === parent.atkMult');
      assert.equal(result.activeSet.defMult, result.defMult, 'activeSet.defMult === parent.defMult');
      assert.equal(result.activeSet.hpMult, result.hpMult, 'activeSet.hpMult === parent.hpMult');
  });

  test('cycle 426: activeSet 다른 필드 (key/name/tone/count/tier/desc) 보존', async () => {
      const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.ts');
      const equip = {
          weapon: { name: '성검 에테르니아' },
          offhand: { name: '천공 성전' },
          armor: null,
      };
      const result = computeSignatureSetBonus(equip);
      assert.ok(result.activeSet);
      assert.equal(typeof result.activeSet.key, 'string', 'key string');
      assert.equal(typeof result.activeSet.name, 'string', 'name string');
      assert.equal(typeof result.activeSet.tone, 'string', 'tone string');
      assert.equal(typeof result.activeSet.count, 'number', 'count number');
      assert.equal(typeof result.activeSet.tier, 'number', 'tier number');
      assert.equal(typeof result.activeSet.desc, 'string', 'desc string');
  });

  test('cycle 426: 1-set 미만 (보너스 없음) 착용 시 activeSet null 그대로', async () => {
      const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.ts');
      const equip = {
          weapon: { name: '성검 에테르니아' },
          offhand: null,
          armor: null,
      };
      const result = computeSignatureSetBonus(equip);
      assert.equal(result.activeSet, null, '1-set만 착용 시 activeSet null');
      assert.equal(result.atkMult, 1, 'parent.atkMult neutral');
  });

  test('cycle 426: StatsPanel formatMultDelta 호환 — 의미 있는 % 표시', async () => {
      const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.ts');
      const equip = {
          weapon: { name: '성검 에테르니아' },
          offhand: { name: '천공 성전' },
          armor: null,
      };
      const result = computeSignatureSetBonus(equip);
      // formatMultDelta(1.10) → "+10%"; formatMultDelta(1.00) → "—"
      // activeSet.atkMult > 1 이면 의미 있는 % 표시 가능.
      assert.ok(result.activeSet.atkMult > 1 || result.activeSet.defMult > 1 || result.activeSet.hpMult > 1,
          '최소 한 개 mult가 1 초과 (실제 보너스)');
  });

  test('cycle 425 회귀 가드: pickFallbackEvent explicit 0건', async () => {
      const source = await readSrc('src/utils/aiEventUtils.ts');
      const fnIdx = source.indexOf('export const pickFallbackEvent');
      const fnEnd = source.indexOf('};', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bexplicit\b/.test(block), 'cycle 425 explicit 변수 0건 보존');
  });
}

// ─── cycle-427-signature-badge-rust-tone-restore.test.js ───
{
  /**
   * cycle 427: SignatureBadge TONE_COLORS에 rust tone 추가 — silent UI 결손 fix.
   *   (cycle 222-426 silent dead config 시리즈 187번째 — silent UI 결손 lens
   *   회귀, cycle 396/398/426 schema 미스매치 패턴).
   *
   * 발견 (silent UI gap — schema 불일치):
   * - signatureRegistry.json은 8 tones emit: arcane/earth/fire/frost/holy/nature/
   *   rust/shadow. '광기의 갑주' 아이템이 tone='rust'.
   * - 다른 signature surface 모두 rust 보유:
   *     · LegendaryDropOverlay TONE_GLOW.rust ✓
   *     · LegendaryCodex TONE_ACCENT.rust ✓
   *     · ItemIcon SIGNATURE_TONE_RING.rust ✓
   * - 그러나 SignatureBadge TONE_COLORS는 7 tone만 (rust 누락):
   *     holy/fire/frost/shadow/arcane/nature/earth.
   *   cycle 413 정리 당시 rust 추가도 같이 처리됐어야 했으나 paired completion 누락.
   * - 결과: 광기의 갑주 등 rust signature 아이템 획득 시 SignatureBadge
   *   `TONE_COLORS[meta.tone]` lookup이 undefined → DEFAULT_TONE_COLOR(holy gold)
   *   fallback. 다른 surface는 rust orange로 표시되는데 badge만 gold 표시.
   *
   * 패턴 (cycle 222-426 시리즈 187번째):
   * - cycle 396: StatsPanel syn.name → syn.label schema 미스매치 fix.
   * - cycle 398: DashboardMobileSummary trait.label → trait.title fix.
   * - cycle 426: signatureSetBonus.activeSet 3 필드 schema 정합 복원.
   * - cycle 427: SignatureBadge TONE_COLORS rust tone 정합 — 동일 lens 회귀.
   *
   * 수정 (src/components/icons/SignatureBadge.tsx):
   * - TONE_COLORS에 rust 엔트리 추가:
   *     rust: { fill: '#d9a56c', glow: 'rgba(217,165,108,0.6)', stroke: '#4a2e16' }
   *   (ItemIcon SIGNATURE_TONE_RING.rust + 다른 entry stroke 패턴 동기).
   *
   * 회귀 가드:
   * - holy/fire/frost/shadow/arcane/nature/earth 7 tone 그대로.
   * - DEFAULT_TONE_COLOR fallback (holy) 동작 그대로 (unmapped tone).
   * - cycle 413 회귀 가드: steel 0건 유지.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 427: SignatureBadge TONE_COLORS에 rust 엔트리 존재', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      const blockStart = source.indexOf('const TONE_COLORS');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(/^\s+rust:/m.test(block), 'TONE_COLORS에 rust 엔트리 존재');
  });

  test('cycle 427: rust 엔트리에 fill/glow/stroke 3 필드 모두 정의', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      const blockStart = source.indexOf('const TONE_COLORS');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      const rustLineMatch = block.match(/^\s+rust:\s*\{[^}]+\}/m);
      assert.ok(rustLineMatch, 'rust 라인 매칭');
      const rustLine = rustLineMatch[0];
      assert.ok(/fill:/.test(rustLine), 'rust.fill 정의');
      assert.ok(/glow:/.test(rustLine), 'rust.glow 정의');
      assert.ok(/stroke:/.test(rustLine), 'rust.stroke 정의');
  });

  test('cycle 427: 활성 7 tone 보존 (회귀 가드)', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      const blockStart = source.indexOf('const TONE_COLORS');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      for (const tone of ['holy', 'fire', 'frost', 'shadow', 'arcane', 'nature', 'earth']) {
          const re = new RegExp(`^\\s+${tone}:`, 'm');
          assert.ok(re.test(block), `${tone} tone 보존`);
      }
  });

  test('cycle 427: 정합성 가드 — signatureRegistry rust tone 아이템 존재', async () => {
      const reg = JSON.parse(await readSrc('src/data/signatureRegistry.json'));
      const rustItems = Object.entries(reg.entries).filter(([, m]) => m.tone === 'rust');
      assert.ok(rustItems.length >= 1, 'rust tone 아이템 1개 이상');
  });

  test('cycle 427: 다른 signature surface와 일관성 — 8 tone 모두 정의 (rust 포함)', async () => {
      const sources = await Promise.all([
          readSrc('src/components/icons/SignatureBadge.tsx'),
          readSrc('src/components/icons/ItemIcon.tsx'),
          readSrc('src/components/LegendaryDropOverlay.tsx'),
          readSrc('src/components/codex/LegendaryCodex.tsx'),
      ]);
      for (const src of sources) {
          // 각 surface는 'rust' 키를 lookup table에 포함해야 함
          assert.ok(/rust:/.test(src), 'surface에 rust 키 존재');
      }
  });

  test('cycle 413 회귀 가드: SignatureBadge TONE_COLORS에서 steel 0건', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      const blockStart = source.indexOf('const TONE_COLORS');
      const blockEnd = source.indexOf('});', blockStart);
      const block = source.slice(blockStart, blockEnd);
      assert.ok(!/^\s+steel:/m.test(block), 'cycle 413 steel 0건 보존');
  });

  test('cycle 426 회귀 가드: signatureSetBonus.activeSet에 atkMult 노출', async () => {
      const { computeSignatureSetBonus } = await import('../src/utils/signatureSetBonus.ts');
      const equip = {
          weapon: { name: '성검 에테르니아' },
          offhand: { name: '천공 성전' },
          armor: null,
      };
      const result = computeSignatureSetBonus(equip);
      assert.equal(typeof result.activeSet?.atkMult, 'number', 'cycle 426 activeSet.atkMult 보존');
  });
}

// ─── cycle-445-signature-pity-step-mult-export-dead.test.js ───
{
  /**
   * cycle 445: SIGNATURE_PITY 객체에서 STEP_MULT 출력 dead 정리
   *   (cycle 222-444 silent dead config 시리즈 203번째 — function output dead field
   *   cleanup lens 회귀, cycle 333-356/443 패턴).
   *
   * 발견 (1 dead exposed property):
   * - src/utils/signaturePity.ts SIGNATURE_PITY:
   *     `Object.freeze({ THRESHOLD, STEP_MULT, CAP })`
   * - 호출 사이트 (consumer) 분석:
   *     · LegendaryCodex.tsx — `SIGNATURE_PITY.THRESHOLD` / `SIGNATURE_PITY.CAP` read.
   *     · production `SIGNATURE_PITY.STEP_MULT` read 0건.
   *     · tests/signature-pity.test.js만 STEP_MULT 어설션.
   * - 내부 사용:
   *     `PITY_STEP_MULT` private const는 getSignaturePityMultiplier 내부에서 사용.
   *     SIGNATURE_PITY 객체로의 노출은 dead.
   *
   * 패턴 (cycle 222-444 시리즈 203번째):
   * - cycle 333-356/443: 함수 출력 dead 필드 cleanup.
   * - cycle 445: SIGNATURE_PITY.STEP_MULT 노출 dead — 동일 lens 회귀 (export object).
   *
   * 수정 (src/utils/signaturePity.ts):
   * - SIGNATURE_PITY 객체에서 STEP_MULT 제거 → THRESHOLD / CAP 2 properties만 노출.
   * - 내부 PITY_STEP_MULT const는 getSignaturePityMultiplier 동작용으로 보존.
   * - tests/signature-pity.test.js의 STEP_MULT 어설션 갱신.
   *
   * 회귀 가드:
   * - getSignaturePityMultiplier 동작 그대로 (PITY_STEP_MULT 내부 사용).
   * - SIGNATURE_PITY.THRESHOLD / .CAP 활성 노출 보존.
   * - LegendaryCodex의 pity status 표시 동작 그대로.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 445: SIGNATURE_PITY 객체에서 STEP_MULT 0건', async () => {
      const source = await readSrc('src/utils/signaturePity.ts');
      const objIdx = source.indexOf('export const SIGNATURE_PITY');
      const objEnd = source.indexOf('});', objIdx);
      const block = source.slice(objIdx, objEnd);
      assert.ok(!/STEP_MULT:/.test(block),
          'SIGNATURE_PITY 객체에 STEP_MULT 노출 0건');
  });

  test('cycle 445: SIGNATURE_PITY.THRESHOLD / .CAP 활성 노출 보존', async () => {
      const { SIGNATURE_PITY } = await import('../src/utils/signaturePity.ts');
      assert.equal(typeof SIGNATURE_PITY.THRESHOLD, 'number', 'THRESHOLD 노출 보존');
      assert.equal(typeof SIGNATURE_PITY.CAP, 'number', 'CAP 노출 보존');
      assert.equal(SIGNATURE_PITY.STEP_MULT, undefined, 'STEP_MULT 미노출');
  });

  test('cycle 445: getSignaturePityMultiplier 동작 보존 (PITY_STEP_MULT 내부 사용)', async () => {
      const { getSignaturePityMultiplier, SIGNATURE_PITY } = await import('../src/utils/signaturePity.ts');
      // pity < THRESHOLD → 1.0
      assert.equal(getSignaturePityMultiplier(SIGNATURE_PITY.THRESHOLD - 1), 1.0);
      // pity == THRESHOLD → 1 + 1 * STEP_MULT (0.15)
      const oneStep = getSignaturePityMultiplier(SIGNATURE_PITY.THRESHOLD);
      assert.ok(oneStep > 1.0 && oneStep < SIGNATURE_PITY.CAP,
          '1-step boost 적용 (STEP_MULT 내부 동작)');
  });

  test('cycle 445: 정합성 가드 — production STEP_MULT 읽기 0건', async () => {
      const { readdir } = await import('node:fs/promises');
      async function* walk(dir) {
          for (const entry of await readdir(dir, { withFileTypes: true })) {
              const fp = path.join(dir, entry.name);
              if (entry.isDirectory()) yield* walk(fp);
              else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
          }
      }
      let reads = 0;
      for await (const fp of walk(path.join(ROOT, 'src'))) {
          const content = await readFile(fp, 'utf8').catch(() => '');
          if (/SIGNATURE_PITY\.STEP_MULT/.test(content)) reads += 1;
      }
      assert.equal(reads, 0, 'src/ 어디서도 SIGNATURE_PITY.STEP_MULT 0건');
  });

  test('cycle 444 회귀 가드: handleMenuAction reset 분기 0건', async () => {
      const source = await readSrc('src/components/Dashboard.tsx');
      const fnIdx = source.indexOf('const handleMenuAction');
      const fnEnd = source.indexOf('};', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/actionId === 'reset'/.test(block),
          'cycle 444 reset 분기 0건 보존');
  });
}

// ─── cycle-466-signature-badge-class-name-unreachable.test.js ───
{
  /**
   * cycle 466: SignatureBadge `className` prop unreachable 정리
   *   (cycle 222-465 silent dead config 시리즈 221번째 — unreachable code path
   *   cleanup lens, cycle 463/464/465 패턴 회귀, icons/ 디렉토리 paired).
   *
   * 발견 (1 prop unreachable):
   * - src/components/icons/SignatureBadge.tsx (line 32):
   *     const SignatureBadge = ({ item, size = 10, className = '' }: any) => {...
   *         className={`pointer-events-none absolute ${className}`.trim()}
   *     }
   * - 호출 사이트 분석 (전체 src/):
   *     · ItemIcon.tsx:129 — item / size만 전달, className 0건.
   *     · 다른 caller 0건 (export default 1건, ItemIcon만 import).
   * - 결과: className은 항상 ''. body의 ${className} 보간은 .trim()으로 빈
   *   문자열이 제거되는 unreachable.
   *
   * 패턴 (cycle 222-465 시리즈 221번째):
   * - cycle 463: ClassIcon cssClass prop unreachable.
   * - cycle 464: ClassIcon showBorder prop unreachable.
   * - cycle 465: MonsterIcon className prop unreachable.
   * - cycle 466: SignatureBadge className prop unreachable — icons/ 디렉토리
   *   paired 회귀 (4 사이클 연속).
   *
   * 수정 (src/components/icons/SignatureBadge.tsx):
   * - destructure에서 className = '' 제거.
   * - body className 템플릿에서 ${className}.trim() 제거 → 정적 'pointer-events-none
   *   absolute' 문자열.
   *
   * 회귀 가드:
   * - item / size prop 보존.
   * - 1 callsite 동작 변동 0.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 466: SignatureBadge destructure에서 className 0건', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      const fnIdx = source.indexOf('const SignatureBadge =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/\bclassName\b/.test(sig), 'destructure에 className 0건');
  });

  test('cycle 466: ${className} 보간 0건', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      assert.ok(!/\$\{className\}/.test(source), '${className} 보간 0건');
  });

  test('cycle 466: 정합성 가드 — ItemIcon callsite className 전달 0건', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      const idx = source.indexOf('<SignatureBadge');
      assert.ok(idx >= 0, '<SignatureBadge> 호출 존재');
      const tagEnd = source.indexOf('/>', idx);
      const jsx = source.slice(idx, tagEnd);
      assert.ok(!/\bclassName\b/.test(jsx), 'callsite className 전달 0건');
  });

  test('cycle 466: item / size prop 보존', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      const fnIdx = source.indexOf('const SignatureBadge =');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(/\bitem\b/.test(sig), 'item 보존');
      // cycle 567: size default 10 cascade 제거됨 (caller가 명시 전달이라 default unreachable).
      //   파라미터 자체는 보존.
      assert.ok(/\bsize\b/.test(sig), 'size 파라미터 보존 (default는 cycle 567에서 제거)');
  });
}

// ─── cycle-567-signature-badge-size-default-unreachable.test.js ───
{
  /**
   * cycle 567: SignatureBadge `size = 10` default unreachable
   *   (cycle 222-566 silent dead config 시리즈 307번째 — redundant default annotation
   *   청소 메가 시리즈 60번째). component prop default cleanup.
   *
   * 발견 (1 default unreachable):
   * - src/components/icons/SignatureBadge.tsx (line 34):
   *     const SignatureBadge = ({ item, size = 10 }: any) => {...};
   * - 호출 사이트 (1 caller):
   *     · ItemIcon.tsx:129 — <SignatureBadge item={item} size={badgeSize} />
   *     · 다른 caller 0건 (test caller 0건).
   * - 결과: size 항상 명시 전달. default 10 도달 불가.
   *
   * 패턴 (cycle 222-566 시리즈 307번째):
   * - cycle 502-566: default 청소 메가 시리즈 65사이클.
   * - cycle 567: components/icons/ private helper — cycle 466 외부 보조 클래스
   *   cleanup에 이은 동일 모듈 추가 cleanup.
   *
   * 수정 (src/components/icons/SignatureBadge.tsx):
   * - signature에서 size = 10 → size.
   * - body의 size 사용처 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (ItemIcon) 동작 그대로.
   * - body hasDedicatedSignatureArt / getSignatureMetadata 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 567: SignatureBadge signature에서 size default 0건', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      const fnIdx = source.indexOf('const SignatureBadge = ');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/size\s*=\s*10/.test(sig),
          'SignatureBadge size default 10 제거');
      assert.ok(/\bsize\b/.test(sig), 'size 파라미터 자체는 보존');
  });

  test('cycle 567: 정합성 가드 — ItemIcon callsite 보존', async () => {
      const source = await readSrc('src/components/icons/ItemIcon.tsx');
      assert.ok(/<SignatureBadge item=\{item\} size=\{badgeSize\} \/>/.test(source),
          'ItemIcon <SignatureBadge> callsite 보존');
  });

  test('cycle 567: body hasDedicatedSignatureArt 처리 보존', async () => {
      const source = await readSrc('src/components/icons/SignatureBadge.tsx');
      assert.ok(/if \(!item \|\| !hasDedicatedSignatureArt\(item\)\) return null/.test(source),
          'hasDedicatedSignatureArt 가드 보존');
      assert.ok(/getSignatureMetadata\(item\)/.test(source),
          'getSignatureMetadata 호출 보존');
  });

  test('cycle 567: cycle 502-566 회귀 가드 — default 청소 시리즈 보존', async () => {
      const ca = await readSrc('src/hooks/gameActions/characterActions.ts');
      assert.ok(!/start: \(name: any, gender:\s*any\s*=\s*'male'/.test(ca),
          "cycle 566 start gender default 'male' 0건");

      const stp = await readSrc('src/components/SkillTreePreview.tsx');
      assert.ok(!/const SkillTreePreview = \({ player, actions\s*=\s*null/.test(stp),
          'cycle 565 SkillTreePreview actions default 0건');
  });
}

// ─── cycle-614-get-signature-item-names-explicit-elimination.test.js ───
{
  /**
   * cycle 614: getSignatureItemNames inv explicit default-elimination
   *   (cycle 222-613 silent dead config 시리즈 354번째 — explicit default-elimination
   *   pattern 6번째 적용).
   *
   * 발견 (1 default reachable → unreachable conversion):
   * - src/hooks/useLegendaryDropDetector.ts (line 24):
   *     const getSignatureItemNames = (inv: any = []) => {
   *         const names: any[] = [];
   *         for (const entry of inv) {...}  // undefined 시 crash 위험
   *         ...
   *     };
   * - 호출 사이트 (1 caller):
   *     · useLegendaryDropDetector.ts:56 — getSignatureItemNames(inv) — 1 arg.
   *       inv는 hook의 첫 param인데 caller (GameRoot)에서 engine.player?.inv
   *       전달 → undefined 가능. 기존 default `[]`가 protective.
   *
   * 패턴 (cycle 222-613 시리즈 354번째):
   * - cycle 502-613: default 청소 메가 시리즈 112사이클.
   * - cycle 614: explicit default-elimination 6번째 (cycle 608/609/611/612/613).
   *   caller에 `|| []` defensive guard 추가 후 default 제거.
   *
   * 수정:
   * - useLegendaryDropDetector.ts:56 — getSignatureItemNames(inv) →
   *   getSignatureItemNames(inv || []).
   * - useLegendaryDropDetector.ts:24 — inv default [] 제거.
   *
   * 회귀 가드:
   * - 1 internal callsite 동작 그대로 (undefined 안전 처리는 || [] guard로
   *   이전).
   * - body for...of 처리 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 614: getSignatureItemNames signature에서 inv default 0건', async () => {
      const source = await readSrc('src/hooks/useLegendaryDropDetector.ts');
      const fnIdx = source.indexOf('const getSignatureItemNames');
      const fnEnd = source.indexOf('=>', fnIdx);
      const sig = source.slice(fnIdx, fnEnd);
      assert.ok(!/inv:\s*any\s*=\s*\[\]/.test(sig),
          'getSignatureItemNames inv default [] 제거');
  });

  test('cycle 614: 정합성 가드 — caller |[] guard 추가', async () => {
      const source = await readSrc('src/hooks/useLegendaryDropDetector.ts');
      assert.ok(/getSignatureItemNames\(inv \|\| \[\]\)/.test(source),
          'getSignatureItemNames(inv || []) defensive guard 명시');
  });

  test('cycle 614: cycle 502-613 회귀 가드 — default 청소 시리즈 보존', async () => {
      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/getTraitProfile = \(player: Player, stats:\s*any\s*=\s*\{\}\)/.test(rp),
          'cycle 613 getTraitProfile stats default 0건');

      const ng = await readSrc('src/utils/nameGenerator.ts');
      assert.ok(!/createRandomMobileName = \(rng:\s*any\s*=\s*Math\.random\)/.test(ng),
          'cycle 611 createRandomMobileName rng default 0건');
  });
}
