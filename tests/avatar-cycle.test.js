import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/**
 * 아바타(Avatar) cycle 테스트 (audit #1 통합 3개)
 */

// ─── cycle-363-avatar-anchors-shoulder-dead.test.js ───
{
  /**
   * cycle 363: AVATAR_ANCHORS shoulder_l / shoulder_r 2 unreachable anchors 정리
   *   (cycle 222-362 silent dead config 시리즈 129번째 — cleanup lens 연속).
   *
   * 발견 (2 dead anchor entries):
   * - anchorPoints.ts AVATAR_ANCHORS 9 anchors 정의: head_top / head_center /
   *   shoulder_l / shoulder_r / torso_center / back_anchor / hand_front / hand_back / feet.
   * - 활성 anchor (placement 함수 호출에서 사용): head_top / head_center / torso_center /
   *   back_anchor / hand_front / hand_back / feet 7종.
   * - shoulder_l / shoulder_r — placement 함수에서 anchor로 사용 0건. AVATAR_ANCHORS
   *   정의만 있고 placement / anchor 매핑 없음.
   * - tests/anchor-points.test.js도 7 anchor (shoulder 제외)만 검증.
   *
   * 패턴 (cycle 222-362 silent dead config 시리즈 129번째):
   * - cycle 362: JOB_STYLE_MAP hairStyle 15회 dead.
   * - cycle 363: AVATAR_ANCHORS shoulder_l / shoulder_r 2 unreachable anchors.
   *
   * 수정 (src/utils/anchorPoints.ts):
   * - AVATAR_ANCHORS에서 shoulder_l / shoulder_r 2 entries 제거.
   *
   * 회귀 가드:
   * - 활성 7 anchor (head_top / head_center / torso_center / back_anchor /
   *   hand_front / hand_back / feet) 보존.
   * - tests/anchor-points.test.js 통과 (7 anchor 검증).
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 363: AVATAR_ANCHORS shoulder_l / shoulder_r 0건', async () => {
      const source = await readSrc('src/utils/anchorPoints.ts');
      const fnStart = source.indexOf('AVATAR_ANCHORS');
      const fnEnd = source.indexOf('// ──', fnStart + 1);
      const block = source.slice(fnStart, fnEnd);
      assert.ok(!/shoulder_l:/.test(block), 'AVATAR_ANCHORS에서 shoulder_l 0건');
      assert.ok(!/shoulder_r:/.test(block), 'AVATAR_ANCHORS에서 shoulder_r 0건');
  });

  test('cycle 363: AVATAR_ANCHORS 활성 7 anchor 보존 (회귀 가드)', async () => {
      const { AVATAR_ANCHORS } = await import('../src/utils/anchorPoints.js');
      const expected = ['head_top', 'head_center', 'torso_center', 'back_anchor',
                        'hand_front', 'hand_back', 'feet'];
      for (const name of expected) {
          assert.ok(AVATAR_ANCHORS[name], `${name} anchor 보존`);
          assert.equal(typeof AVATAR_ANCHORS[name].x, 'number', `${name}.x number`);
          assert.equal(typeof AVATAR_ANCHORS[name].y, 'number', `${name}.y number`);
      }
  });

  test('cycle 363: AVATAR_ANCHORS shoulder anchors 제거됐음', async () => {
      const { AVATAR_ANCHORS } = await import('../src/utils/anchorPoints.js');
      assert.equal(AVATAR_ANCHORS.shoulder_l, undefined, 'shoulder_l undefined');
      assert.equal(AVATAR_ANCHORS.shoulder_r, undefined, 'shoulder_r undefined');
  });

  test('cycle 362 회귀 가드: JOB_STYLE_MAP hairStyle 0건 보존', async () => {
      const source = await readSrc('src/utils/characterAppearance.ts');
      const fnStart = source.indexOf('const DEFAULT_JOB_STYLE');
      const fnEnd = source.indexOf('const ELEMENT_COLOR_MAP');
      const block = source.slice(fnStart, fnEnd);
      const matches = block.match(/hairStyle:/g) || [];
      assert.equal(matches.length, 0, 'cycle 362 hairStyle 0건 보존');
  });
}

// ─── cycle-499-pixel-character-avatar-redundant-defaults.test.js ───
{
  /**
   * cycle 499: PixelCharacterAvatar 5 redundant defaults cleanup
   *   (cycle 222-498 silent dead config 시리즈 250번째 — redundant default annotation
   *   cleanup lens, cycle 451-452/467 패턴 회귀).
   *
   * 발견 (5 redundant defaults):
   * - src/components/PixelCharacterAvatar.tsx (line 43-53):
   *     · player = null      ← 2/2 callsite pass player
   *     · size = 'sm'        ← 2/2 callsite pass size ("sm"/"lg")
   *     · className = ''     ← 2/2 callsite pass "shrink-0"
   *     · dataTestId = null  ← 2/2 callsite pass dataTestId
   *     · label = '캐릭터 외형' ← 2/2 callsite pass label
   * - 호출 사이트 분석 (2 callsite):
   *     · StatusBar.tsx — player/size="sm"/interactive/onClick/dataTestId/
   *       label/className="shrink-0".
   *     · EquipmentPanel.tsx — player/appearance/size="lg"/dataTestId/label/
   *       className="shrink-0"/showEnhanceBadge=false.
   *     · 5 props 모두 명시 전달이라 default 도달 불가.
   *     · 활성 default 보존: providedAppearance / onClick / interactive /
   *       showEnhanceBadge (호출자 부분 누락 path).
   *
   * 패턴 (cycle 222-498 시리즈 250번째):
   * - cycle 451-452/467: 콜러가 항상 명시 전달하는 기본값 annotation 정리.
   * - cycle 499: PixelCharacterAvatar 5 redundant defaults — 동일 lens.
   *
   * 수정 (src/components/PixelCharacterAvatar.tsx):
   * - destructure에서 player = null / size = 'sm' / className = '' /
   *   dataTestId = null / label = '캐릭터 외형' default 제거.
   * - 활성 default (providedAppearance / onClick / interactive / showEnhanceBadge) 보존.
   *
   * 회귀 가드:
   * - 본체 동작 그대로.
   * - 2 callsite 명시 전달 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test('cycle 499: PixelCharacterAvatar 5 redundant default 제거', async () => {
      const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
      const fnIdx = source.indexOf('const PixelCharacterAvatar = ({');
      const fnEnd = source.indexOf('}: any', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(!/player\s*=\s*null/.test(block), 'player default 제거');
      assert.ok(!/size\s*=\s*'sm'/.test(block), 'size default 제거');
      assert.ok(!/className\s*=\s*''/.test(block), 'className default 제거');
      assert.ok(!/dataTestId\s*=\s*null/.test(block), 'dataTestId default 제거');
      assert.ok(!/label\s*=\s*'캐릭터 외형'/.test(block), 'label default 제거');
  });

  test('cycle 499: 활성 default 보존 — providedAppearance / onClick / interactive / showEnhanceBadge', async () => {
      const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
      const fnIdx = source.indexOf('const PixelCharacterAvatar = ({');
      const fnEnd = source.indexOf('}: any', fnIdx);
      const block = source.slice(fnIdx, fnEnd);
      assert.ok(/providedAppearance\s*=\s*null/.test(block), 'providedAppearance default 보존');
      assert.ok(/onClick\s*=\s*null/.test(block), 'onClick default 보존');
      assert.ok(/interactive\s*=\s*false/.test(block), 'interactive default 보존');
      assert.ok(/showEnhanceBadge\s*=\s*true/.test(block), 'showEnhanceBadge default 보존');
  });

  test('cycle 499: 정합성 가드 — 2 callsite 명시 전달', async () => {
      const sb = await readSrc('src/components/StatusBar.tsx');
      const sbCall = sb.match(/<PixelCharacterAvatar[\s\S]*?\/>/);
      assert.ok(sbCall, 'StatusBar PixelCharacterAvatar 호출 발견');
      const reqs = ['player', 'size', 'dataTestId', 'label', 'className'];
      for (const f of reqs) {
          assert.ok(new RegExp(`\\b${f}=`).test(sbCall[0]), `StatusBar callsite에 ${f} 명시 전달`);
      }

      const ep = await readSrc('src/components/EquipmentPanel.tsx');
      const epCall = ep.match(/<PixelCharacterAvatar[\s\S]*?\/>/);
      assert.ok(epCall, 'EquipmentPanel PixelCharacterAvatar 호출 발견');
      for (const f of reqs) {
          assert.ok(new RegExp(`\\b${f}=`).test(epCall[0]), `EquipmentPanel callsite에 ${f} 명시 전달`);
      }
  });

  test('cycle 499: 본체 핵심 로직 보존', async () => {
      const source = await readSrc('src/components/PixelCharacterAvatar.tsx');
      assert.ok(/SIZE_MAP\[size\]/.test(source), 'SIZE_MAP[size] lookup 보존');
      assert.ok(/FRAME_TONE_CLASS/.test(source), 'FRAME_TONE_CLASS 보존');
      assert.ok(/showEnhanceBadge/.test(source), 'showEnhanceBadge 본체 사용 보존');
      assert.ok(/spriteCandidates/.test(source), 'spriteCandidates 보존');
  });
}

// ─── cycle-604-seed-avatar-scenario-preset-default-unreachable.test.js ───
{
  /**
   * cycle 604: seedAvatarScenario `preset = 'paladin-plate'` default unreachable
   *   (cycle 222-603 silent dead config 시리즈 340번째 — redundant default annotation
   *   청소 메가 시리즈 추가, useGameTestApi.ts).
   *
   * 발견 (1 default unreachable):
   * - src/hooks/useGameTestApi.ts (line 319):
   *     seedAvatarScenario: (preset: any = 'paladin-plate') => {
   *         const scenario = avatarScenarioMap[preset];
   *         if (!scenario) return false;
   *         ...
   *     }
   * - 호출 사이트:
   *     · scripts/smoke-gameplay.mjs:305 — seedAvatarScenario?.(preset.id) — 1 arg
   *       명시 (preset.id from avatarPresets array iteration).
   *     · 다른 caller 0건 (src/, tests/ 모두).
   * - 결과: preset 항상 명시 전달. default 'paladin-plate' 도달 불가.
   *
   * 패턴 (cycle 222-603 시리즈 340번째):
   * - cycle 502-603: default 청소 메가 시리즈 102사이클.
   * - cycle 604: useGameTestApi.ts cleanup. cycle 593의 dead exposure pivot
   *   (window.advanceTime 제거)와 동일 모듈 추가 cleanup.
   *
   * 수정 (src/hooks/useGameTestApi.ts):
   * - preset = 'paladin-plate' → preset.
   * - body의 avatarScenarioMap[preset] / scenario null 가드 보존.
   *
   * 회귀 가드:
   * - 1 production callsite (scripts/smoke-gameplay.mjs) 동작 그대로.
   * - body avatarScenarioMap lookup / scenario null 분기 보존.
   */

  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const ROOT = path.join(HERE, '..');
  const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

  test("cycle 604: seedAvatarScenario signature에서 preset default 0건", async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(!/seedAvatarScenario:\s*\(preset:\s*any\s*=\s*'paladin-plate'\)/.test(source),
          "seedAvatarScenario preset default 'paladin-plate' 제거");
      assert.ok(/seedAvatarScenario:\s*\(preset:\s*any\)/.test(source),
          'seedAvatarScenario 파라미터 자체는 보존');
  });

  test('cycle 604: 정합성 가드 — scripts/smoke-gameplay callsite 보존', async () => {
      const source = await readSrc('scripts/smoke-gameplay.mjs');
      assert.ok(/window\.__AETHERIA_TEST_API__\?\.seedAvatarScenario\?\.\(value\)/.test(source),
          'smoke-gameplay seedAvatarScenario(preset.id) callsite 보존');
  });

  test('cycle 604: body avatarScenarioMap / scenario null 가드 보존', async () => {
      const source = await readSrc('src/hooks/useGameTestApi.ts');
      assert.ok(/const scenario = avatarScenarioMap\[preset\]/.test(source),
          'avatarScenarioMap[preset] lookup 보존');
      assert.ok(/if \(!scenario\) return false/.test(source),
          '!scenario null 가드 보존');
  });

  test('cycle 604: cycle 502-603 회귀 가드 — default 청소 시리즈 보존', async () => {
      const aiu = await readSrc('src/utils/aiEventUtils.ts');
      assert.ok(!/summarizeHistory = \(history: any\[\]\s*=\s*\[\]/.test(aiu),
          'cycle 603 summarizeHistory history default 0건');

      const rp = await readSrc('src/utils/runProfile.ts');
      assert.ok(!/getTraitLootHint = \(items: any\[\]\s*=\s*\[\]/.test(rp),
          'cycle 602 getTraitLootHint items default 0건');
  });
}
