# 소스 정규식 가드 분류 (2026-09, Wave 11 Track C4)

## 0. 배경

`tests/*.test.js` 전반에 `readSrc()`로 `src/**` 파일을 읽어 정규식으로 텍스트를 스캔하는
가드가 누적돼 있다. 이 문서는 그 가드들을 **한 번 전수 분류**해, 어떤 것이 남아야 하는
설계 계약이고 어떤 것이 "리팩터가 텍스트 모양을 바꾸면 죽는" 취약한 가짜 가드인지 확정한다.

측정 기준: `grep -c "readSrc(" tests/*.test.js` — 68개 파일에서 소스 텍스트를 읽는
`assert`가 총 3,226건(파일당 여러 `assert`가 한 `readSrc()` 호출을 공유하는 경우가 많아
호출 수 1,745와 assertion 수는 다르다). 분류 대상은 **assertion 단위**다.

## 1. 분류 기준 (3클래스 + 보조 2범주)

- **(a) 부재 불변식 (absence invariant)** — `!/X/.test(source)`류로 "X가 없다"를 확인하는
  가드. 삭제된 코드/파라미터/필드가 되돌아오지 않는지는 동작 테스트로 표현할 수 없다
  (없는 것을 호출해서 실패를 관찰할 방법이 없다). **전환 금지** — 이 클래스가 이 트랙의
  핵심 예외다. 다만 정규식이 *포맷*(줄바꿈/공백/파라미터 순서)을 고정하고 있어서 리팩터가
  포맷만 바꿔도 깨지는 경우는, 정규식이 실제로 지켜야 하는 *식별자*만 남기도록
  robustify(완화)한다.
- **(a-support, "A-support")** — (a) 불변식을 찾기 위한 앵커/인덱스 보조 assertion
  (`fnIdx >= 0`, `matches.length` 같은 "본문을 찾았다"류). 그 자체로 행동 주장이 아니라
  뒤따르는 (a)/(b) 판정을 위한 전제조건이므로 (a)와 함께 취급하고 전환 대상에서 제외한다.
- **(b) 행동을 텍스트로 고정 (behavior-as-text)** — "함수가 호출된다", "값이 쓰인다",
  "폴백이 실행된다" 같은 실제 런타임 동작을 소스 문자열 매칭으로 흉내 낸 가드. 실제
  모듈을 import해서 호출하고 결과를 assert하는 동작 테스트로 **전환 대상**이다.
- **(c) stale/공허 (vacuous)** — 이미 지워진 것을 가드하거나, 타입 어노테이션처럼 런타임에
  지워지는(erased) 정보를 확인하거나, 순환적으로 자기 자신만 참조하는 가드. **삭제 대상**
  — 삭제 시 한 줄 근거를 남긴다.
- **OUT_OF_SCOPE** — `readSrc`를 쓰지만 대상이 아트 에셋 디코딩·네이티브 매니페스트·Toss
  결제 증빙처럼 "텍스트 매칭 자체가 계약"인 특수 케이스. 분류표에는 포함하되 전환/삭제
  판단에서 제외한다(둘 다 아니다).

## 2. 방법론

1. **1차 패스 (자동)** — `acorn` 기반 AST 스캐너로 각 `test()` 블록 안의 `assert.ok`/
   `assert.equal`류 호출을 찾아, 그 조건식이 (i) `readSrc()`로 읽은 문자열에 대한 정규식
   `.test()`/`.match()`인지, (ii) 정규식이 부정(`!`)으로 감싸여 있는지, (iii) 정규식
   내부가 식별자/멤버접근/호출 형태(`deregexify`로 리터럴 이스케이프를 실제 코드 모양에
   가깝게 근사 복원)인지를 판정해 A/A-support/B/C/OUT_OF_SCOPE 초안을 낸다.
2. **2차 패스 (수동 검증, 필수)** — **모든 (b)·(c) 판정을 손으로 다시 읽었다.** 자동 1차
   패스에서 발견된 대표적 오탐과 그 수정:
   - `assert.ok(/regex/.test(x))`의 `.test(` 부분 문자열이 모든 케이스에서 "호출처럼 보임"
     오탐을 만듦 → 정규식 리터럴을 벗겨 내부 패턴만 판정하도록 수정.
   - 정규식 리터럴 소스의 `\.`(백슬래시+점, 실제 점이 아님) 때문에 `BALANCE.`/`SEASON_XP.`
     같은 "값 접근" 키워드 매처가 실패 → 트레일링 dot 요구를 제거.
   - `[A-Z]\w*$` 앵커 없는 타입-식별자 매처가 `appendRewardLogs` 중간의 `RewardLogs`에
     오매칭 → `\b([A-Z]\w*)[\s\\]*$` 워드바운더리로 교정.
   - `CONSTANTS.START_NEXT_EXP` 같은 SCREAMING_SNAKE_CASE 상수가 "타입 전용"으로 오분류
     → 매칭된 식별자에 소문자가 1개 이상 있어야 하고 직전이 `.` 멤버접근이 아니어야 한다는
     조건 추가.
   - 수동 리뷰 중 손으로 잡은 잔여 2건(자동화하지 않고 직접 교정): (1)
     `interface Window { X?: () => T }`류 TS 함수-타입 멤버가 `=>` 포함으로 인해 B로
     오분류, (2) `import('./mod.js').SomeType` 형태가 직전 `.` 때문에 "실제 값 접근"으로
     오분류. 둘 다 실제 `window.X = ...` 대입부가 `src/`에 있어(런타임 동작이 아니라 타입
     선언만 지우면 `tsc --noEmit`이 즉시 잡는다는 것을 grep으로 직접 확인) class-C로 확정.
3. **cycle-500-599.test.js 전환** — (b)로 확정된 405건을 실제 모듈 import + 호출 +
   assert로 전환했다(§4). (a)는 그대로 두되 포맷만 고정하던 1건을 완화했다. 자동분류상
   B로 잡혔던 2개 whole-test가 수동 리뷰로 class-C로 재확정되어 삭제됐다(§5) — 표에는
   최종(수동 확정) 값을 싣는다.

## 3. 파일별 분류 (68개 파일, 전체 3,226 assertion → Wave 12 D4 이후 3,190)

`cycle-*.test.js` 7개 파일은 굵게 표시했다 — 이 트랙에서 **전환 대상은 `cycle-500-599`뿐**이고
나머지 6개는 분류만 하고 그대로 둔다(§15 C4 규칙: "전수 전환을 시도하면 부재 불변식을
잃는다 — (a)는 전환 금지가 이 트랙의 핵심 규칙").

**2026-09 Wave 12 D4 갱신**: class-(c) 39건(`boss-cycle` 5 · `cycle-200-299` 16 ·
`cycle-300-399` 9 · `monsters-cycle` 3 · `player-language-readability` 3 · `signature-cycle` 1 ·
`skills-cycle` 2)을 "실제 consumer가 있는가"로 재검토했다. 36건은 살아있는 consumer가 확인돼
`tsc --noEmit`이 이미 더 강하게 재증명하므로 삭제했다(§8 삭제 로그). `player-language-readability.test.js`의
3건은 재검토 결과 원 표기가 정정 대상으로 판단된다 — 이 파일의 readSrc 스코프 77건을 전수
재검토했으나 "타입 선언이 존재한다"류의 class-C 패턴(나머지 6개 파일에서 확인된 유일한 C
패턴 모양)이 발견되지 않았다. 가장 근접한 후보(`messages.ts`의 `COMBAT_CHAOS_SKILL` 함수
시그니처에 포함된 `(name: string)` 타입 표기)조차 검사의 핵심이 런타임에 호출되는 실제
메시지 템플릿이라 class-B에 더 부합한다. 아래 표는 물리적으로 삭제한 36건만 반영했고,
`player-language-readability.test.js` 행은 원값(C=3)을 그대로 두고 이 각주로 정정 사유를
남긴다 — 세부 재분류(어느 3건이 A/B인지)는 이 트랙의 범위 밖이다(삭제 여부 판단이 목적이며,
삭제 기준을 충족하는 후보가 없으므로 아무것도 지우지 않았다).

| 파일 | A (부재 불변식) | A-support (검증용 보조) | B (행동 전환 대상) | C (stale/공허) | OUT_OF_SCOPE | 합계 |
|---|---:|---:|---:|---:|---:|---:|
| `avatar-cycle.test.js` | 11 | 0 | 16 | 0 | 0 | 27 |
| `balance-inline-literals.test.js` | 7 | 1 | 7 | 0 | 0 | 15 |
| `boss-cycle.test.js` | 5 | 2 | 5 | 0 | 0 | 12 |
| `codex-cycle.test.js` | 20 | 4 | 24 | 0 | 0 | 48 |
| `codex-progression-design.test.js` | 2 | 0 | 7 | 0 | 0 | 9 |
| `combat-focus-mode.test.js` | 0 | 0 | 5 | 0 | 0 | 5 |
| `combat-forecast-readability.test.js` | 3 | 0 | 17 | 0 | 0 | 20 |
| `core-hud-language-readability.test.js` | 0 | 0 | 18 | 0 | 0 | 18 |
| `cycle-067-099.test.js` **(cycle-\*)** | 14 | 1 | 22 | 0 | 0 | 37 |
| `cycle-100-199.test.js` **(cycle-\*)** | 15 | 5 | 50 | 0 | 0 | 70 |
| `cycle-200-299.test.js` **(cycle-\*)** | 78 | 2 | 91 | 0 | 0 | 171 |
| `cycle-300-399.test.js` **(cycle-\*)** | 153 | 4 | 119 | 0 | 0 | 276 |
| `cycle-400-499.test.js` **(cycle-\*)** | 255 | 9 | 202 | 0 | 0 | 466 |
| `cycle-500-599.test.js` **(cycle-\*)** | 267 | 14 | 405 | 0 | 0 | 686 |
| `cycle-600-699.test.js` **(cycle-\*)** | 77 | 3 | 73 | 0 | 0 | 153 |
| `data-migration.test.js` | 44 | 0 | 21 | 0 | 0 | 65 |
| `drop-cycle.test.js` | 7 | 1 | 6 | 0 | 0 | 14 |
| `early-growth-tempo.test.js` | 0 | 0 | 3 | 0 | 0 | 3 |
| `engine-msg-ownership.test.js` | 10 | 0 | 10 | 0 | 0 | 20 |
| `equipment-comparison-single-source.test.js` | 10 | 0 | 11 | 0 | 0 | 21 |
| `equipment-cycle.test.js` | 45 | 2 | 54 | 0 | 0 | 101 |
| `event-choice-presentation.test.js` | 3 | 0 | 13 | 0 | 0 | 16 |
| `expedition-boss-gauge.test.js` | 0 | 2 | 9 | 0 | 0 | 11 |
| `grave-cycle.test.js` | 15 | 0 | 11 | 0 | 0 | 26 |
| `job-change-decision-flow.test.js` | 2 | 0 | 10 | 0 | 0 | 12 |
| `latent-type-bugs.test.js` | 5 | 0 | 9 | 0 | 0 | 14 |
| `loot-cycle.test.js` | 22 | 0 | 16 | 0 | 0 | 38 |
| `map-signature-hints.test.js` | 0 | 0 | 4 | 0 | 0 | 4 |
| `mobile-focus-panel-contrast.test.js` | 0 | 0 | 8 | 0 | 0 | 8 |
| `mobile-overlay-cta-reachability.test.js` | 2 | 0 | 20 | 0 | 0 | 22 |
| `monsters-cycle.test.js` | 24 | 1 | 32 | 0 | 0 | 57 |
| `onboarding-first-session.test.js` | 1 | 0 | 6 | 0 | 0 | 7 |
| `player-language-readability.test.js` | 21 | 0 | 53 | 3† | 0 | 77 |
| `player-surface-language-readability.test.js` | 0 | 0 | 4 | 0 | 0 | 4 |
| `post-combat-decision-readability.test.js` | 2 | 0 | 17 | 0 | 0 | 19 |
| `premium-cycle.test.js` | 2 | 0 | 6 | 0 | 0 | 8 |
| `quests-cycle.test.js` | 42 | 1 | 48 | 0 | 0 | 91 |
| `rarity-presentation-single-source.test.js` | 5 | 0 | 6 | 0 | 0 | 11 |
| `readability-map-signal.test.js` | 3 | 0 | 48 | 0 | 0 | 51 |
| `region-theme.test.js` | 0 | 0 | 5 | 0 | 0 | 5 |
| `relic-choice-decision-readability.test.js` | 2 | 0 | 26 | 0 | 0 | 28 |
| `relics.test.js` | 16 | 0 | 27 | 0 | 0 | 43 |
| `run-summary-reflection-readability.test.js` | 2 | 0 | 28 | 0 | 0 | 30 |
| `shop-cycle.test.js` | 27 | 1 | 22 | 0 | 0 | 50 |
| `signature-adventure-guide-pity.test.js` | 0 | 0 | 1 | 0 | 0 | 1 |
| `signature-boss-hint.test.js` | 0 | 0 | 6 | 0 | 0 | 6 |
| `signature-cycle.test.js` | 28 | 2 | 39 | 0 | 0 | 69 |
| `signature-drop-log.test.js` | 0 | 0 | 7 | 0 | 0 | 7 |
| `signature-drop-sources.test.js` | 0 | 0 | 3 | 0 | 0 | 3 |
| `signature-grave-highlight.test.js` | 0 | 0 | 5 | 0 | 0 | 5 |
| `signature-inventory-highlight.test.js` | 1 | 0 | 0 | 0 | 0 | 1 |
| `signature-move-recommendation.test.js` | 0 | 0 | 1 | 0 | 0 | 1 |
| `signature-pity-feedback.test.js` | 0 | 0 | 7 | 0 | 0 | 7 |
| `signature-pity.test.js` | 0 | 0 | 9 | 0 | 0 | 9 |
| `signature-run-summary.test.js` | 0 | 0 | 3 | 0 | 0 | 3 |
| `signature-sell-protection.test.js` | 0 | 0 | 8 | 0 | 0 | 8 |
| `signature-set-two-hand.test.js` | 0 | 0 | 3 | 0 | 0 | 3 |
| `signature-synthesis-protection.test.js` | 0 | 0 | 2 | 0 | 0 | 2 |
| `skill-growth-design.test.js` | 4 | 0 | 11 | 0 | 0 | 15 |
| `skills-cycle.test.js` | 39 | 0 | 34 | 0 | 0 | 73 |
| `slice-25-item-art-cohesion.test.js` | 0 | 1 | 9 | 0 | 2 | 12 |
| `slice-28-design-system.test.js` | 2 | 0 | 9 | 0 | 0 | 11 |
| `slice-29-feedback-juice.test.js` | 0 | 0 | 13 | 0 | 0 | 13 |
| `slice-30-enemy-hit-feedback.test.js` | 0 | 1 | 10 | 0 | 0 | 11 |
| `slice-31-meter-crit-feedback.test.js` | 0 | 0 | 9 | 0 | 0 | 9 |
| `status-cycle.test.js` | 20 | 0 | 8 | 0 | 0 | 28 |
| `synergies-cycle.test.js` | 2 | 0 | 15 | 0 | 0 | 17 |
| `temporary-sound-disable.test.js` | 6 | 0 | 1 | 0 | 0 | 7 |
| **합계 (68 files)** | **1321** | **57** | **1807** | **3†** | **2** | **3190** |

† `player-language-readability.test.js`의 C=3은 Wave 12 D4 재검토 결과 정정 대상 — 위
각주 참조. 삭제 기준(살아있는 consumer + tsc 재증명)을 충족하는 후보가 발견되지 않아
물리적으로 삭제하지 않았고, 합계에는 여전히 이 3건이 남아 있다.

## 4. `cycle-500-599.test.js` 전환 결과

이 트랙에서 **실제로 편집한 유일한 테스트 파일**이다. 최종 분류(수동 확정 기준):
**A 267 / A-support 14 / B 405 / C 0 / 합계 686** assertion, 250개 `test()` (원본 251개
— B 전환 405건 중 하나(`applyExpGain`)를 기존 블록에서 분리해 새 `test()` 1개로 추가하고,
class-C로 재확정된 whole-test 2개를 삭제해 net -1).

- **전환(B → 행동 테스트)**: 405건 전부. 각 대상 함수는 대부분 `src/utils/*.ts`의
  `export`되지 않은 private 헬퍼였으므로, "가장 가까운 실제 exported wrapper"를 찾아
  그것을 호출해 간접적으로 private 헬퍼의 동작을 검증했다(예: `equipmentUtils.ts`의
  private 슬롯 배치 로직 → exported `getNextEquipmentState`/`getWeaponEquipScore` 호출).
  `CombatEngine.ts`의 믹스인 메서드(`applyExpGain`/`calculateDamage`/`applyEntropyTick`/
  `applyCritMpRestore`/`applyFatalProtection`)는 `CombatEngine.methodName(...)` 형태로만
  호출했다(구조분해 시 내부 `this.` 참조가 깨진다). 컴포넌트 대상은
  `tests/helpers/render.ts`의 `renderStatic`/`makePlayerFixture`로 실제 SSR 렌더 후
  출력 문자열을 assert했다.
- **robustify(포맷 완화, (a) 유지)**: 1건. `TerminalView.tsx`의 파라미터 구조분해
  부재 검사가 줄바꿈/공백 배치까지 고정하고 있어(`!/const TerminalView = \(\{\s*\n\s*logs\s*=\s*\[\]/`)
  실제로 지켜야 하는 식별자만 남기도록 `!/logs\s*=\s*\[\]/`로 완화했다.
- **전환 보류(문서화된 예외)**: 1건 (`cycle 587`, `ControlPanel` 2-callsite 가드). `ControlPanel`은
  게임 전체 navigation/action hub라 실제 렌더에는 engine 전체(수십 개 파생 상태 + 6개
  하위 패널)가 필요해, 이 파일 안에서 안전하게 최소 mock으로 렌더하는 비용이 이득보다
  훨씬 크다고 판단해 소스 텍스트 그대로 두고 코드 주석으로 사유를 남겼다. 향후 별도
  트랙에서 `ControlPanel`용 최소 fixture가 만들어지면 전환 대상이다.
- **잔여 미완료 robustify 스코프 결정**: `TerminalView.tsx` 블록에 `paramName:\s*any\s*=\s*defaultValue`
  형태의 (a) negation이 약 250건 더 있다(같은 "unreachable default parameter" 감사
  시리즈가 이 파일 하나에서 반복 패턴으로 누적된 결과). 이들도 포맷보다는 살짝 더
  넓게 앵커돼 있어 robustify 후보이지만, 전부 손으로 다시 읽고 완화하는 것은 이 트랙의
  스코프(전환 대상은 (b) 405건, (a)는 "robustify where formatting-pinned"이지 "모든 (a)
  재작성"이 아니다)를 벗어난다고 판단해 **의도적으로 손대지 않았다**. 대신 §7에 추가한
  CLAUDE.md 정책이 앞으로 이런 패턴의 *신규* 가드를 막는다. 이 잔여 250건은 기존
  동작에 대해서는 여전히 유효한 (a) 가드이며 허위 통과 상태가 아니다 — 다만 향후
  포맷 변경(예: 개행 스타일 변경)에 불필요하게 깨질 수 있는 residual임을 투명하게
  기록해 둔다.

## 5. 삭제 로그 (class-C, 사유 포함)

1. **`cycle 542 (A2 이관): 두 파라미터 모두 보존`** — `formatEquipmentDelta`의
   `key: EquipmentDeltaKey` / `value: number` 파라미터 타입 어노테이션이 소스에 존재하는지
   확인하던 테스트. 타입은 런타임에 삭제(erase)되어 동작 테스트로도 부재 불변식으로도
   표현할 수 없다. 두 파라미터가 실제로 잘 연결돼 있는지는 바로 다음
   `cycle 542 (A2 이관): body template literal 보존` 테스트가 `formatEquipmentDelta`를
   실제 호출해 이미 증명한다(파라미터 순서/개수가 틀리면 그 호출 자체가 실패하거나
   잘못된 문자열을 만들어 assert가 깨진다) — 삭제해도 커버리지 손실이 없다.
2. **`cycle 594: 활성 Window 타입 보존 (회귀 가드)`** — `render_game_to_text`/
   `__AETHERIA_TEST_API__`/`__AETHERIA_PERF_REGISTRY__` 세 필드의 `interface Window { ... }`
   타입 선언이 소스에 존재하는지 확인하던 테스트(3개 assertion). 타입은 런타임에
   삭제(erase)되므로 동작 테스트로 표현 불가능하고, 세 필드 모두 실제 `window.X = ...`
   대입 사이트가 `src/`에 있음을 grep으로 확인했다(`useGameTestApi.ts:583,2120`,
   `performanceMarks.ts:4`) — 그 대입부의 타입이 선언과 안 맞으면 `tsc --noEmit`이 즉시
   에러를 낸다. `npm run verify`가 이미 이 계약을 이 가드보다 강하게(전체 파일 단위로,
   그리고 실제 타입 검사로) 보장하므로 이 소스 정규식은 공허(vacuous)하다.

## 6. 결함 재도입 스팟체크 (5건, 필수 요구사항)

방법: `src/` 전체를 스크래치 디렉터리로 복사한 뒤 각 항목마다 정확히 원래 가드가
지키려던 동작 하나를 깨는 최소 1-라인 변형을 주입하고, 변형된 복사본을 동적
`import()`로 불러와 전환된 assertion을 그대로 재실행해 실패를 관찰했다(원본 `src/`는
전혀 건드리지 않았다).

| # | 대상 (cycle) | 주입한 결함 | 관찰 결과 |
|---|---|---|---|
| 1 | `cycle 502` `incrementStat` | `+1` → `+2`로 변경 | **실패함(예상대로)** — `incrementStat 호출 1회당 정확히 +1` assert가 `4 !== 5`로 깨짐 |
| 2 | `cycle 505` `grantGold` | `stats.total_gold` 누적 라인 제거 | **실패함(예상대로)** — `total_gold 통계도 누적된다` assert가 `undefined !== 50`으로 깨짐 |
| 3 | `cycle 518` `getWeaponEquipScore`/`getNextEquipmentState` | one-hand 페어 배치에서 main/offhand 슬롯을 swap | **실패함(예상대로)** — `더 강한 무기가 ATK_RATIO가 더 높은 main 슬롯에 배치된다` assert가 깨짐 (더 강한 무기가 offhand로 감) |
| 4 | `cycle 538` `resolveDailyProtocolProgress` | relic shard 전환 임계값 5 → 50으로 변경 | **실패함(예상대로)** — `relicShards 4+1=5 도달 시 relicRoll로 결정론적 유물 전환이 일어난다` assert가 `reward.convertedRelic`이 falsy로 나와 깨짐 |
| 5 | `cycle 568` `ClassIcon.tsx` | `TIER_COLORS[tier] ?? TIER_COLORS[0]` nullish fallback 제거 | **실패함(예상대로)** — `tier 미전달 시 TIER_COLORS[0](#9ca3af) fallback이 실제 렌더된다` assert가 렌더 출력에 `#9ca3af`가 없어 깨짐 |

5건 모두 "결함을 주입하면 전환된 assertion이 실제로 실패한다"를 확인했다 — 전환이
커버리지를 잃지 않았다는 직접 증거다.


## 7. `cycle-*.test.js` 7개 파일 — 전체 assertion 목록 (테스트명 + 클래스 + 근거)

분류만 하고 편집하지 않은 6개 파일(`cycle-067-099`/`cycle-100-199`/`cycle-200-299`/
`cycle-300-399`/`cycle-400-499`/`cycle-600-699`)과, 전환을 마친 `cycle-500-599`(전환 후
최종 상태 기준)를 모두 포함한다. 한 테스트 안에 여러 assertion이 있으면 클래스별 건수를
`A×N` 형태로 합쳐 표시했다.


### `tests/cycle-067-099.test.js`

| 라인 | 테스트 이름 | 클래스 (건수) | 근거 |
|---:|---|---|---|
| 92 | INITIAL_STATE.player.stats에 syntheses: 0 선언 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 100 | StatsPanel: 제작 횟수 row 노출 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 108 | StatsPanel: 합성 횟수 row 노출 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 116 | StatsPanel: 도주 횟수 row 회귀 보존 (cycle 80) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 292 | _shared.ts dead write 제거 — stats.discoveries 누적 제거 | A×1 | negation/absence syntactic pattern |
| 301 | INITIAL_STATE: stats.discoveries 선언 제거 | A×1 | negation/absence syntactic pattern |
| 343 | RunSummaryCard: run-summary-extras testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 351 | RunSummaryCard: run-summary-escape testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 359 | RunSummaryCard: run-summary-discovery testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 367 | RunSummaryCard: extras 섹션은 escapes>0 OR discoveries>0 조건부 (silence-over-noise) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 377 | RunSummaryCard: signaturesAcquired highlight 회귀 보존 (cycle 18) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 519 | actionTypes.ts에 SET_ONBOARDING_DISMISSED 제거됨 | A×1 | negation/absence syntactic pattern |
| 524 | GameState/INITIAL_STATE에 onboardingDismissed 제거됨 | A×1 | negation/absence syntactic pattern |
| 529 | uiHandlers에 SET_ONBOARDING_DISMISSED 핸들러 제거됨 | A×1 | negation/absence syntactic pattern |
| 534 | bootstrapHandlers의 onboardingDismissed merge 라인 제거됨 | A×1 | negation/absence syntactic pattern |
| 539 | useGameEngine에 onboardingDismissed export / dismissOnboarding 제거됨 | A×2 | negation/absence syntactic pattern |
| 545 | useFirebaseSync에 onboardingDismissed 참조 제거됨 | A×1 | negation/absence syntactic pattern |
| 550 | gameUtils.migrateData에 onboardingDismissed boolean coercion 제거됨 | A×1 | negation/absence syntactic pattern |
| 603 | equipmentArt utility는 다른 active consumer가 있어 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 657 | SystemTab의 admin 액션은 별도 경로로 보존됨 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 691 | itemVisuals.ts: IMAGEGEN_OVERLAY_KEYS export 제거됨 | A×1 | negation/absence syntactic pattern |
| 696 | itemVisuals.ts: getEquipmentOverlayAssetKey export 제거됨 | A×1 | negation/absence syntactic pattern |
| 701 | itemVisuals.ts: 다른 active export는 회귀 보존 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 708 | jobOutfitAffinity.ts: getOutfitAffinityTone export 제거됨 | A×1 | negation/absence syntactic pattern |
| 713 | shopRotation.ts: getMaterialShop export 제거됨 | A×1 | negation/absence syntactic pattern |
| 718 | shopRotation.ts: 다른 active export는 회귀 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 752 | INITIAL_STATE.player.stats.maxKillStreak 선언됨 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 757 | combatVictory: stats.maxKillStreak 누적 코드 존재 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 826 | StatsPanel: 최대 연속 처치 row 노출 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 919 | RunSummaryCard: run-summary-streak testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 924 | RunSummaryCard: extras 섹션 조건에 maxKillStreak 포함 | A-support×1, B×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 933 | RunSummaryCard: 기존 escape/discovery chip 회귀 보존 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |

### `tests/cycle-100-199.test.js`

| 라인 | 테스트 이름 | 클래스 (건수) | 근거 |
|---:|---|---|---|
| 102 | StatsPanel: 완료한 발견 여정 row 노출 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 107 | StatsPanel: 완료한 발견 여정 row가 stats.discoveryChains 배열 길이를 읽음 | A-support×1, B×2 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 117 | StatsPanel: 기존 row 회귀 보존 (cycle 80/82/96) | B×4 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 149 | TARGET_ICONS: maxKillStreak entry 등록됨 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 154 | TARGET_ICONS: discoveryChains entry 등록됨 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 159 | maxKillStreak가 전투 분야에 포함됨 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 164 | discoveryChains가 탐험 분야에 포함됨 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 169 | lucide imports: Flame / Link2 추가됨 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 175 | 기존 cycle 79 테마 14종 회귀 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 216 | CombatEngine: player DOT_STATUSES에 bleed 포함 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 661 | CombatPanel: combat-enemy-debuff-chip testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 666 | CombatPanel: enemy.stunnedTurns / cursedTurns / blindTurns / fearTurns 모두 참조 | B×4 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 674 | CombatPanel: enemy.dots 배열 (poison/burn/bleed) 참조 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 679 | CombatPanel: 한국어 라벨 매핑 (기절/저주/실명/공포/독/화상/출혈) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 687 | CombatPanel: 기존 combat-signature-drop-hint testid 회귀 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1034 | migrateData: stats.comboCount default 라인 제거됨 | A×1 | negation/absence syntactic pattern |
| 1042 | migrateData: stats.lowHpWins default 라인 제거됨 (없었음 — 회귀 가드) | A×1 | negation/absence syntactic pattern |
| 1049 | 회귀 보존: combatFlags.comboCount는 active 필드 (DEFAULT_COMBAT_FLAGS에 존재) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1085 | AchievementPanel: achievement-panel root testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1090 | AchievementPanel: dynamic achievement-milestone-{id} testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1095 | AchievementPanel: dynamic achievement-claim-{id} testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1100 | AchievementPanel: cycle 473 paired — 요약 토글 버튼 cascade 제거 보존 | A×1 | negation/absence syntactic pattern |
| 1128 | EventPanel: event-panel root testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1133 | EventPanel: dynamic event-choice-{idx} testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1138 | EventPanel: event-dismiss testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1163 | QuickSlot: dynamic quick-slot-{i} testid 노출 (사용 버튼) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1168 | QuickSlotAssigner: dynamic quick-slot-assign-{i} testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1173 | QuickSlot: quick-slot-unassign testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1196 | TrueEndingScreen: true-ending-screen root testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1201 | TrueEndingScreen: true-ending-confirm 버튼 testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1237 | combatVictory: KILL_STREAK_DECAY_MS 참조 코드 존재 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1246 | combatVictory: lastKillAt 갱신 코드 존재 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1255 | combatVictory: 주입된 currentTime 기반 시간 비교 패턴 존재 | A-support×1, B×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1297 | endgameSettlement: 더 이상 CONSTANTS.PRIMAL_SHARD_DROP_CHANCE 잘못 참조 안 함 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1305 | useInventoryActions: 더 이상 CONSTANTS.DAILY_INVADE_LIMIT 잘못 참조 안 함 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1313 | endgameSettlement: PRIMAL_SHARD_REQUIRED 참조 코드 존재 (>= 1건) | A-support×1 | vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 1319 | endgameSettlement: hardcoded 3 shard 비교가 PRIMAL_SHARD_REQUIRED로 교체됨 | A×2 | negation/absence syntactic pattern |
| 1426 | eventActions: rwd.type === "legendary_item" 분기 추가됨 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1431 | eventActions: legendary_item 분기가 addItemByName 호출 | A-support×1, B×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1439 | 회귀 보존: 기존 5개 reward 타입 분기 유지 (gold/item/relic/combat_bonus/stat_bonus) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1564 | AT 키 dead-code 가드: 모든 AT.X가 src/ 내부 어딘가에서 dispatch 됨 | A-support×1, A×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) negation/absence syntactic pattern |
| 1579 | AT 키 dead-code 가드: 핸들러 등록 키가 모두 AT 정의에 존재 (string typo) | A×1 | negation/absence syntactic pattern |
| 1647 | cycle 176: 모든 CHALLENGE_MODIFIERS id가 src/에서 핸들러 참조됨 | A×1 | negation/absence syntactic pattern |
| 1667 | cycle 176: StatusBar에 blindMap 분기 명시 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1779 | eventChains의 모든 reward.type이 eventActions.ts에서 핸들러 보유 | A×1 | negation/absence syntactic pattern |
| 1800 | cycle 178: eventActions에 info 핸들러 명시 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1944 | cycle 180: exploreUtils.ts에 DB.ITEMS.allItems 잘못된 패턴 없음 (회귀 가드) | A×1 | negation/absence syntactic pattern |
| 2007 | src/ 코드가 DB.ITEMS.<unknown_key>를 호출하지 않음 (화이트리스트 가드) | A×1 | negation/absence syntactic pattern |
| 2092 | cycle 182: chain reward cap에 maxInv 우선 사용 (Wave 4 N1: exploreFlow.ts 소유) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2099 | cycle 182: src/utils/adventureGuide.ts inventoryCap 변수 도입 | B×1, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern |
| 2349 | cycle 194: combatBossHandlers에 prestige_points 분기 없음 (회귀 가드) | A×1 | negation/absence syntactic pattern |

### `tests/cycle-200-299.test.js`

| 라인 | 테스트 이름 | 클래스 (건수) | 근거 |
|---:|---|---|---|
| 2030 | cycle 250: StatsPanel가 stats.activeSet을 render | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2036 | cycle 250: StatsPanel가 activeSet.desc를 표시 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2044 | cycle 250: StatsPanel가 activeSet.prefix 또는 동등 식별자 표시 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2051 | cycle 250: activeSet null/undefined 시 미표시 (silence over noise) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2059 | cycle 250: activeSignatureSet block 동작 유지 (회귀 가드) | B×2 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2066 | cycle 250: items.ts sets 데이터 보존 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2084 | cycle 261 후속: claimWeeklyMission hook은 식별자만 전달한다 | B×3, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (3) negation/absence syntactic pattern |
| 2095 | cycle 261: claimSeasonReward 신규 액션 정의 | B×4, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime / (3) negation/absence syntactic pattern |
| 2111 | cycle 261: SeasonPassPanel이 actions.claimSeasonReward 사용 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2117 | cycle 261 후속: CLAIM_SEASON_REWARD reducer 권한 경계 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2134 | cycle 263: critical 로그 타입이 CombatEngine에서 사용 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2454 | cycle 266: GameRoot가 liveConfig.announcement render | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2460 | cycle 266: 빈 announcement 시 미표시 (조건부 렌더링) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2467 | cycle 266: announcement 배너가 testid 노출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2473 | cycle 265 회귀 가드: seasonEvent 배너 동작 유지 | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2518 | cycle 268: getRunBuildProfile의 secondary 필드 정의 제거 | A×1 | negation/absence syntactic pattern |
| 2540 | cycle 268: buildProfile.tags 컴포넌트 dispatch 유지 (회귀 가드) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2548 | cycle 267 회귀 가드: skillLabel 0건 유지 | A×1 | negation/absence syntactic pattern |
| 2643 | cycle 270: CombatPanel display 변화 없음 (회귀 가드) | B×5 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2697 | cycle 271: getClassBuildIdentity export 제거 | A×1 | negation/absence syntactic pattern |
| 2703 | cycle 271: getClassBuildCompatibility export 제거 | A×1 | negation/absence syntactic pattern |
| 2709 | cycle 271: getClassBuildBonus export 제거 | A×1 | negation/absence syntactic pattern |
| 2715 | cycle 271: getRunDiagnostics export 제거 | A×1 | negation/absence syntactic pattern |
| 2721 | cycle 271: active exports 유지 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2740 | cycle 271: 다른 consumer 변화 없음 (회귀 가드) | A×1 | negation/absence syntactic pattern |
| 2782 | cycle 274: combatVictory가 victoryResult.leveledUp 감지 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2788 | cycle 274: combatVictory가 addStoryLog("levelUp", ...) 호출 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2794 | cycle 274: levelUp payload에 level 포함 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2800 | cycle 274: aiService levelUp 템플릿 정의 유지 (회귀 가드) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2806 | cycle 272-273 회귀 가드: 이전 sponsored dispatch 동작 유지 | B×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2851 | cycle 275: combatAttack가 addStoryLog("ruinRecap", ...) 호출 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2857 | cycle 275: combatItem이 addStoryLog("ruinRecap", ...) 호출 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2863 | cycle 275: ruinRecap payload에 name + level 포함 | B×3 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2878 | cycle 275: aiService ruinRecap 템플릿 정의 유지 (회귀 가드) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2884 | cycle 272-274 회귀 가드: 이전 sponsored dispatch 동작 유지 | B×3 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2896 | cycle 275: 기존 death dispatch 유지 (회귀 가드) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2939 | cycle 277: ASCEND meta build에서 totalPrestige 3 필드 제거 | A×3 | negation/absence syntactic pattern |
| 2946 | cycle 277: INITIAL_STATE.player.meta에서 totalPrestige 제거 | A×1 | negation/absence syntactic pattern |
| 2951 | cycle 277: migrateData에서 totalPrestige 정규화 제거 | A×1 | negation/absence syntactic pattern |
| 2956 | cycle 277: bonusAtk/Hp/Mp 활성 필드 유지 (회귀 가드) | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2967 | cycle 277: ASCEND prestigeRank / essence / titles 동작 유지 (회귀 가드) | B×5 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3013 | cycle 278: statsCalculator에서 killStreakTier 필드 제거 | A×1 | negation/absence syntactic pattern |
| 3019 | cycle 278: killStreak raw count 필드 유지 (회귀 가드) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3025 | cycle 278: computeKillStreakBonus 내부 계산 동작 유지 (회귀 가드) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3117 | cycle 278 회귀 가드: killStreakTier 0건 유지 | A×1 | negation/absence syntactic pattern |
| 3159 | cycle 280: Stats 타입에서 comboCount 제거 (CombatFlags의 동명 필드는 유지) | C×1, A×1 | (1) type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not / (2) negation/absence syntactic pattern |
| 3169 | cycle 280: Stats 타입에서 discoveries 제거 | A×1 | negation/absence syntactic pattern |
| 3175 | cycle 280: combatFlags.comboCount 동작 유지 (회귀 가드) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3181 | cycle 280 후속: buildRunSummary가 회차별 discoveries snapshot 사용 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3187 | cycle 280: Stats 인터페이스 다른 필드 유지 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3201 | cycle 278-279 회귀 가드: 이전 cleanup 동작 유지 | A×4 | negation/absence syntactic pattern |
| 3241 | cycle 281: PlayerMeta에서 totalPrestigeAtk 제거 | C×1, A×1 | (1) type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not / (2) negation/absence syntactic pattern |
| 3249 | cycle 281: PlayerMeta에서 totalPrestigeHp / Mp 제거 | C×1, A×2 | (1) type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not / (2) negation/absence syntactic pattern |
| 3258 | cycle 281: PlayerMeta active 필드 유지 (회귀 가드) | C×1, B×1 | (1) type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3270 | cycle 277 회귀 가드: totalPrestige runtime 0건 유지 | A×1 | negation/absence syntactic pattern |
| 3319 | cycle 284: types/item.ts ItemType 는 string 단순 alias가 아니다 | A×1, C×1, B×1 | (1) negation/absence syntactic pattern / (2) type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not / (3) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3329 | cycle 284: types/map.ts MapType 제거 | A×1 | negation/absence syntactic pattern |
| 3335 | cycle 284: GameMap.isSignatureZone 제거 | A×1 | negation/absence syntactic pattern |
| 3341 | cycle 284: 활성 GameMap 필드 유지 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3351 | cycle 280-283 회귀 가드: 이전 cleanup 동작 유지 | B×2, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern |
| 3398 | cycle 287: INITIAL_SEASON_PASS export 제거 | A×1 | negation/absence syntactic pattern |
| 3404 | cycle 287: SEASON_XP / SEASON_TIER_XP / SEASON_REWARDS active exports 유지 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3413 | cycle 287: INITIAL_STATE.player.seasonPass inline 정의 유지 (회귀 가드) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3427 | cycle 285-286 회귀 가드: 이전 cleanup 동작 유지 | A×2 | negation/absence syntactic pattern |
| 3469 | cycle 288: 5 dead exports 제거 | A×1 | negation/absence syntactic pattern |
| 3478 | cycle 288: DEFAULT_TONE_KEY export 제거 (private const) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3486 | cycle 288: active exports 유지 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3504 | cycle 285-287 회귀 가드: 이전 cleanup 동작 유지 | A×3 | negation/absence syntactic pattern |
| 3543 | cycle 289: CLASS_BUILD_IDENTITIES export 제거 | A×1 | negation/absence syntactic pattern |
| 3549 | cycle 289: traits.ts 파일 크기 단축 (~145 lines 감소) | A-support×1 | vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 3556 | cycle 289: ARCHETYPE_LABELS / TRAIT_DEFINITIONS / ELEMENT_TO_STATUS active exports 유지 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3572 | cycle 271 회귀 가드: 4 dead exports cleanup 유지 | A×4 | negation/absence syntactic pattern |
| 3584 | cycle 285-288 회귀 가드: 이전 cleanup 동작 유지 | A×2 | negation/absence syntactic pattern |
| 3619 | cycle 290: applyItemPrefix options 매개변수 제거 | A×2 | negation/absence syntactic pattern |
| 3627 | cycle 290: applyItemPrefix BALANCE.ITEM_PREFIX_CHANCE 직접 사용 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3633 | cycle 290: CombatEngine.loot.ts 3 호출 사이트가 transaction RNG를 전달 | A-support×1, B×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3650 | cycle 289 회귀 가드: CLASS_BUILD_IDENTITIES 0건 유지 | A×1 | negation/absence syntactic pattern |
| 3685 | cycle 291: updateStats export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3693 | cycle 291: getWeaponEquipScore export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3701 | cycle 291: incrementStat / getEquipmentProfile active export 유지 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3718 | cycle 290 회귀 가드: applyItemPrefix options 0건 유지 | A×1 | negation/absence syntactic pattern |
| 3751 | cycle 292: normalizeText export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3759 | cycle 292: aiEventUtils active exports 유지 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3775 | cycle 291 회귀 가드: 2 private downgrade 유지 | A×2 | negation/absence syntactic pattern |
| 3809 | cycle 293: getAllItems export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3817 | cycle 293: findItemByName active export 유지 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3830 | cycle 292 회귀 가드: normalizeText private 유지 | A×1 | negation/absence syntactic pattern |
| 3865 | cycle 294: 3 exports 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3876 | cycle 294: itemVisuals active exports 유지 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3893 | cycle 293 회귀 가드: getAllItems private 유지 | A×1 | negation/absence syntactic pattern |
| 3929 | cycle 295: 4 type exports 제거 (private) | A×4 | negation/absence syntactic pattern |
| 3937 | cycle 295: 4 type 정의 자체는 유지 (private) | C×4 | type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not |
| 3945 | cycle 295: getJobOutfitAffinity / getJobSetCatalog active export 유지 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3959 | cycle 294 회귀 가드: itemVisuals 3 private 유지 | A×2 | negation/absence syntactic pattern |
| 3995 | cycle 296: getSynthesisOutputs export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4003 | cycle 296: synthesisUtils active exports 유지 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4020 | cycle 295 회귀 가드: jobOutfitAffinity 4 type private 유지 | A×2 | negation/absence syntactic pattern |
| 4057 | cycle 297: getExploreState export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4065 | cycle 297: explorationPacing active exports 유지 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4081 | cycle 296 회귀 가드: getSynthesisOutputs private 유지 | A×1 | negation/absence syntactic pattern |
| 4121 | cycle 298: item.ts 4 type exports 제거 (private) | A×4 | negation/absence syntactic pattern |
| 4129 | cycle 298: monster.ts BossMonster export 제거 (private) | A×1, C×1 | (1) negation/absence syntactic pattern / (2) type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not |
| 4135 | cycle 298: Item / Monster 유니온 정의 유지 | C×2 | type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not |
| 4142 | cycle 298: ConsumableItem / EquipSlots / MonsterBase active export 유지 | C×3 | type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not |
| 4150 | cycle 297 회귀 가드: getExploreState private 유지 | A×1 | negation/absence syntactic pattern |
| 4188 | cycle 299: 8 sub-interface exports 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4199 | cycle 299: Player active export 유지 | C×1 | type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not |
| 4205 | cycle 298 회귀 가드: 5 type private 유지 | A×2 | negation/absence syntactic pattern |

### `tests/cycle-300-399.test.js`

| 라인 | 테스트 이름 | 클래스 (건수) | 근거 |
|---:|---|---|---|
| 46 | cycle 301: ActionType type alias는 죽은 채로 남지 않는다 (W7-Y2 도출 alias) | C×1, B×1 | (1) type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 55 | cycle 301: gameStates.ts GameState type alias 제거 | A×1 | negation/absence syntactic pattern |
| 61 | cycle 301: AT / GS const export 유지 (회귀 가드) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 68 | cycle 301: gameReducer.ts GameState export 유지 (state shape — 다른 의미) | C×1 | type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not |
| 74 | cycle 299 회귀 가드: player.ts 8 sub-interfaces private 유지 | A×1 | negation/absence syntactic pattern |
| 111 | cycle 302: ACTION_PRESENTATION dead export 제거 | A×1 | negation/absence syntactic pattern |
| 117 | cycle 302: ACTION_KIND_TO_BUTTON active export 유지 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 123 | cycle 302: TYPE_COLORS re-export 제거 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 131 | cycle 302: SkillTypeIcon default export 유지 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 137 | cycle 301 회귀 가드: reducer type alias 정리 유지 | C×1, A×1 | (1) type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not / (2) negation/absence syntactic pattern |
| 177 | cycle 303: isE2ERuntime export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 185 | cycle 303: measurePerf export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 193 | cycle 303: isMockRuntime / measurePerfOnce active export 유지 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 207 | cycle 302 회귀 가드: ACTION_PRESENTATION dead 유지 | A×1 | negation/absence syntactic pattern |
| 248 | cycle 304: DB wrapper LOOT_TABLE / DROP_TABLES key 제거 | A×2 | negation/absence syntactic pattern |
| 254 | cycle 304: DB wrapper LOOT_TABLE / DROP_TABLES import 제거 | A×2 | negation/absence syntactic pattern |
| 279 | cycle 303 회귀 가드: 2 utils private 유지 | A×2 | negation/absence syntactic pattern |
| 318 | cycle 307: useGameEngine 반환 객체 top-level leaderboard 제거 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 328 | cycle 307: useGameEngine actions 내부 leaderboard 유지 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 335 | cycle 307: SystemTab actions.leaderboard 경로 사용 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 341 | cycle 306 회귀 가드: state.version 제거 유지 | A×1 | negation/absence syntactic pattern |
| 385 | cycle 308: 5 dead surface 제거 | A×5 | negation/absence syntactic pattern |
| 395 | cycle 308: trackCall / onSlowResponse / THRESHOLD_MS 활성 유지 | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 402 | cycle 308: aiService trackCall 사용 보존 (회귀 가드) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 415 | cycle 307 회귀 가드: useGameEngine top-level leaderboard 제거 유지 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 465 | cycle 309: CONSTANTS.REMOTE_CONFIG_ENABLED 제거 | A×1 | negation/absence syntactic pattern |
| 471 | cycle 309: constants.ts에 REMOTE_CONFIG_ENABLED 키 정의 제거 | A×1 | negation/absence syntactic pattern |
| 478 | cycle 309: 다른 system 파일 영향 없음 (회귀 가드) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 487 | cycle 308 회귀 가드: LatencyTracker 5 dead surface 제거 유지 | A×2 | negation/absence syntactic pattern |
| 554 | cycle 310: FocusPanelHeader 별개 컴포넌트 활성 보존 (회귀 가드) | B×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 615 | cycle 311: adventureGuide.ts (다른 파일) 보존 (회귀 가드) | B×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 668 | cycle 312: WEAPON_PLACEMENTS export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 676 | cycle 312: OFFHAND_PLACEMENTS export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 684 | cycle 312: getWeaponPlacement / getOffhandPlacement active export 유지 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 746 | cycle 314: moveActions deps 구조분해에서 addStoryLog 제거 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 755 | cycle 314: moveActions void addStoryLog 자가-suppress 라인 제거 | A×1 | negation/absence syntactic pattern |
| 762 | cycle 314: moveActions move 액션 활성 보존 (회귀 가드) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 770 | cycle 314: characterActions / exploreActions / quest receipt의 addStoryLog 활성 사용 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 785 | cycle 313 회귀 가드: QuestRewardChips private 유지 | A×1 | negation/absence syntactic pattern |
| 825 | cycle 315: createMoveActions 시그니처 (deps)만 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 834 | cycle 315: createAscensionActions 시그니처 (deps)만 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 843 | cycle 315: useGameActions 호출 사이트 1-arg로 갱신 (TypeScript strict) | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 854 | cycle 315: 다른 gameAction factory는 shared 활성 사용 보존 (회귀 가드) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 863 | cycle 314 회귀 가드: moveActions addStoryLog 제거 유지 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 899 | cycle 316: addItemToInventory export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 907 | cycle 316: addItemByName active export 유지 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 921 | cycle 315 회귀 가드: moveActions / ascensionActions 1-arg 시그니처 유지 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 959 | cycle 317: EMPTY_TEMP_BUFF export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 967 | cycle 317: playerStateUtils active exports 유지 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 986 | cycle 316 회귀 가드: addItemToInventory private 유지 | A×1 | negation/absence syntactic pattern |
| 1022 | cycle 318: getPoolKeyByLocation export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1030 | cycle 318: aiEventUtils active exports 유지 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1046 | cycle 317 회귀 가드: EMPTY_TEMP_BUFF private 유지 | A×1 | negation/absence syntactic pattern |
| 1082 | cycle 319: runProfileUtils.ts unused Monster / Player import 제거 | A×2 | negation/absence syntactic pattern |
| 1090 | cycle 319: runProfileUtils.ts barrel re-export 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1096 | cycle 319: player.ts ConsumableItem import 제거 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1104 | cycle 319: Player interface 필드 보존 (회귀 가드) | B×1, C×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not |
| 1110 | cycle 318 회귀 가드: getPoolKeyByLocation private 유지 | A×1 | negation/absence syntactic pattern |
| 1148 | cycle 321: equipmentUtils.ts Player type import 제거 | A×1 | negation/absence syntactic pattern |
| 1154 | cycle 321: Codex.tsx BALANCE / MSG imports 제거 | A×2 | negation/absence syntactic pattern |
| 1162 | cycle 321: CombatEngine.ts LOOT_TABLE / DROP_TABLES imports 제거 | A×2 | negation/absence syntactic pattern |
| 1170 | cycle 321: messages.ts DB import 제거 | A×1 | negation/absence syntactic pattern |
| 1176 | cycle 321: codex 파일들의 unused imports 제거 | A×4 | negation/absence syntactic pattern |
| 1191 | cycle 320 회귀 가드: CHANGELOG batch 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1227 | cycle 322: 주요 컴포넌트의 unused React default 제거 | A×1 | negation/absence syntactic pattern |
| 1245 | cycle 322: jsx-runtime 자동 import (tsconfig "jsx": "react-jsx") | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1251 | cycle 322: React.X 사용하는 파일은 React import 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1272 | cycle 321 회귀 가드: 8 files unused imports 정리 보존 | A×2 | negation/absence syntactic pattern |
| 1305 | cycle 323: exploreUtils.ts Monster type import 제거 | B×3, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern / (3) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1316 | cycle 323: SkillTreePreview.tsx RefreshCw import 제거 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 1324 | cycle 323: Codex.tsx Shield icon import 제거 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 1332 | cycle 322 회귀 가드: React default 정리 보존 | A×1 | negation/absence syntactic pattern |
| 1370 | cycle 324: firebase.ts app export 제거 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 1379 | cycle 324: firebase.ts app const 정의 유지 (private) | B×3 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1389 | cycle 324: auth / db / hasFirebaseConfig export 유지 | B×4 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1398 | cycle 323 회귀 가드: 3 leftover unused imports 정리 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1412 | cycle 324 회귀 가드: firebase app export 제거 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1449 | cycle 326: getRemainingCalls 메서드 제거 | A×1 | negation/absence syntactic pattern |
| 1455 | cycle 326: TokenQuotaManager 활성 메서드 보존 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1464 | cycle 326: aiService TokenQuotaManager 호출 보존 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1505 | cycle 327: JOB_TYPICAL_LOADOUT export 제거 | A×1 | negation/absence syntactic pattern |
| 1511 | cycle 327: avatar-sprite-priority.test.js JOB_TYPICAL_LOADOUT import 제거 | A×1 | negation/absence syntactic pattern |
| 1517 | cycle 327: avatarSpriteCandidates active exports 유지 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1533 | cycle 326 회귀 가드: TokenQuotaManager.getRemainingCalls 제거 보존 | A×1 | negation/absence syntactic pattern |
| 1574 | cycle 329: 3 dead methods 제거 | A×3 | negation/absence syntactic pattern |
| 1584 | cycle 329: active test API methods 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1593 | cycle 329: smoke-gameplay.mjs script 호출 보존 (회귀 가드) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1601 | cycle 328 회귀 가드: BossPhase private 유지 | A×1 | negation/absence syntactic pattern |
| 1638 | cycle 331: getAdventureGuidance emphasis 필드 0개 (11개 모두 제거) | A×1 | negation/absence syntactic pattern |
| 1645 | cycle 331: getAdventureGuidance 다른 필드 보존 (회귀 가드) | A-support×2 | vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 1666 | cycle 330 회귀 가드: SignalBadge signature tone 제거 보존 | A×1 | negation/absence syntactic pattern |
| 1702 | cycle 332: getAdventureGuidance secondaryAction 0개 (11개 모두 제거) | A×1 | negation/absence syntactic pattern |
| 1710 | cycle 332: mpRatio 변수 getAdventureGuidance에서 제거 | A×1 | negation/absence syntactic pattern |
| 1717 | cycle 332: getMoveRecommendations의 mpRatio 보존 (line 138) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1734 | cycle 331 회귀 가드: emphasis 제거 보존 | A×1 | negation/absence syntactic pattern |
| 1773 | cycle 333: getMoveRecommendations 출력에 4 dead 필드 0건 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1822 | cycle 332 회귀 가드: getAdventureGuidance secondaryAction 0건 | A×1 | negation/absence syntactic pattern |
| 1859 | cycle 335: getMapPacingProfile note 필드 0건 (5회 모두 제거) | A×1 | negation/absence syntactic pattern |
| 1890 | cycle 334 회귀 가드: getQuestTracker / getExplorationForecast dead 필드 정리 보존 | A×2 | negation/absence syntactic pattern |
| 1930 | cycle 336: getPostCombatAnalysis hpRatio / mpRatio 출력 0건 | A×2 | negation/absence syntactic pattern |
| 1956 | cycle 336: PostCombatCard 사용 보존 (회귀 가드) | B×3, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern |
| 1964 | cycle 335 회귀 가드: getMapPacingProfile.note 5회 제거 보존 | A×1 | negation/absence syntactic pattern |
| 2001 | cycle 337: getEnhanceAvailability return에서 materialCount 0건 | A×1 | negation/absence syntactic pattern |
| 2035 | cycle 336 회귀 가드: getPostCombatAnalysis hpRatio/mpRatio 0건 보존 | A×1 | negation/absence syntactic pattern |
| 2071 | cycle 338: validateSynthesis 성공 return에서 type 필드 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2105 | cycle 337 회귀 가드: getEnhanceAvailability materialCount 0건 | A×1 | negation/absence syntactic pattern |
| 2144 | cycle 339: getSynthesisGroups rarity 필드 0건 | A×1 | negation/absence syntactic pattern |
| 2150 | cycle 339: getItemRarity import cascade 제거 | A×1 | negation/absence syntactic pattern |
| 2172 | cycle 338 회귀 가드: validateSynthesis type 0건 보존 | A×1 | negation/absence syntactic pattern |
| 2217 | cycle 342: top-level dead 필드 0건 | A×2 | negation/absence syntactic pattern |
| 2224 | cycle 342: weapon/offhand/armor dead 필드 0건 | A×3 | negation/absence syntactic pattern |
| 2232 | cycle 342: getItemIconAssetKey import cascade 제거 | A×1 | negation/absence syntactic pattern |
| 2255 | cycle 341 회귀 가드: getEquipmentArtProfile dead 필드 0건 | A×1 | negation/absence syntactic pattern |
| 2292 | cycle 343: applyDynamicDifficulty 반환에서 diffLabel 0건 | A×1 | negation/absence syntactic pattern |
| 2299 | cycle 343: scaled에서 _diffLabel / _diffScore 0건 | A×2 | negation/absence syntactic pattern |
| 2322 | cycle 342 회귀 가드: deriveCharacterAppearance dead 필드 정리 보존 | A×1 | negation/absence syntactic pattern |
| 2361 | cycle 344: buildRunSummary buildTags 출력 0건 | A×1 | negation/absence syntactic pattern |
| 2368 | cycle 344: useGameEngine.ts buildProfile.tags AI snapshot dispatch 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2393 | cycle 343 회귀 가드: applyDynamicDifficulty 3 dead diff metadata 정리 보존 | A×1 | negation/absence syntactic pattern |
| 2433 | cycle 345: scoreTag 시그니처에서 desc 제거 | B×1, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern |
| 2443 | cycle 345: scoreTag 출력에 desc 0건 | A×1 | negation/absence syntactic pattern |
| 2449 | cycle 345: 8 호출 사이트에서 desc 문자열 인자 제거 | A×1 | negation/absence syntactic pattern |
| 2473 | cycle 344 회귀 가드: buildRunSummary buildTags 0건 보존 | A×1 | negation/absence syntactic pattern |
| 2511 | cycle 346: getJobOutfitAffinity totalSlots 출력 0건 | A×1 | negation/absence syntactic pattern |
| 2518 | cycle 346: OutfitAffinity interface totalSlots 필드 제거 | C×1, A×1 | (1) type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not / (2) negation/absence syntactic pattern |
| 2537 | cycle 345 회귀 가드: scoreTag desc 매개변수 0건 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2597 | cycle 348: 부모 return의 atkMult/defMult/hpMult 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2614 | cycle 347 회귀 가드: scoreQuest score → _sortKey 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2653 | cycle 349: getSignatureSetProgress return에 members 0건 | A×2 | negation/absence syntactic pattern |
| 2663 | cycle 349: 내부 const members / equippedMembers 보존 (회귀 가드) | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2721 | cycle 351: getTraitProfile 3 redundant override 0건 | A×3 | negation/absence syntactic pattern |
| 2732 | cycle 351: spread + bonus / skill 명시 override 보존 (회귀 가드) | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2752 | cycle 350 회귀 가드: CHANGELOG batch 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2789 | cycle 355: getDailyDeals return에 discount 0건 | A×1 | negation/absence syntactic pattern |
| 2811 | cycle 354 회귀 가드: getTraitLootHint score/label/traitName 0건 보존 | A×3 | negation/absence syntactic pattern |
| 2851 | cycle 356: OPERATION_META summary 0건 (5 lane 모두 제거) | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 2862 | cycle 356: OPERATION_META label/emphasis 5 lane 보존 (회귀 가드) | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2895 | cycle 355 회귀 가드: getDailyDeals discount 0건 보존 | A×1 | negation/absence syntactic pattern |
| 2937 | cycle 357: FALLBACK_EVENT_POOL에서 '시작의 마을' 키 0건 | A×1 | negation/absence syntactic pattern |
| 2950 | cycle 357: explore 가드 회귀 보존 (START_LOCATION 차단) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2956 | cycle 356 회귀 가드: OPERATION_META summary 0건 보존 | A×1 | negation/absence syntactic pattern |
| 2998 | cycle 361: JOB_AFFINITY_NAMES 그림자주군 (공백 제거) 0건 | A×1 | negation/absence syntactic pattern |
| 3008 | cycle 361: JOB_AFFINITY_NAMES '그림자 주군' (정식) 키 보존 (회귀 가드) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3017 | cycle 361: JOB_AFFINITY_NAMES 14 활성 직업 키 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3046 | cycle 359 회귀 가드: ELEMENT_FILTERS 불/얼음/화염속성 0건 보존 | A×3 | negation/absence syntactic pattern |
| 3088 | cycle 362: JOB_STYLE_MAP hairStyle 0건 (15회 모두 제거) | A×1 | negation/absence syntactic pattern |
| 3098 | cycle 362: 활성 5 필드 보존 (회귀 가드) | A-support×1 | vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 3129 | cycle 361 회귀 가드: JOB_AFFINITY_NAMES 그림자주군 0건 보존 | A×1 | negation/absence syntactic pattern |
| 3170 | cycle 364: eventChains.ts reward.itemType 0건 | A×1 | negation/absence syntactic pattern |
| 3177 | cycle 364: eventChains.ts reward.tier 0건 | A×1 | negation/absence syntactic pattern |
| 3245 | cycle 365: eventChains.ts outcome.chainId 0건 | A×1 | negation/absence syntactic pattern |
| 3285 | cycle 364 회귀 가드: eventChain reward itemType/tier 0건 보존 | A×2 | negation/absence syntactic pattern |
| 3329 | cycle 368: prophecy_stone threshold default 0건 | A×1 | negation/absence syntactic pattern |
| 3336 | cycle 368: quest 62 threshold default 0건 | A×1 | negation/absence syntactic pattern |
| 3343 | cycle 368: blood_moon threshold 0.25 보존 (default와 다름) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3350 | cycle 368: quest 63/75 threshold 보존 (default와 다름) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3358 | cycle 367 회귀 가드: maps boss: false 0건 보존 | A×2 | negation/absence syntactic pattern |
| 3399 | cycle 369: ItemBase export → private downgrade | A×1, C×1 | (1) negation/absence syntactic pattern / (2) type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not |
| 3407 | cycle 369: Item / EquipSlots / ConsumableItem export 보존 (회귀 가드) | C×3 | type-only syntax (erased at runtime) — redundant with tsc --noEmit if the type is live, dead-export lint territory if not |
| 3415 | cycle 368 회귀 가드: prophecy_stone threshold 0건 보존 | A×1 | negation/absence syntactic pattern |
| 3459 | cycle 371: maps.ts safe-zone eventChance: 0 0건 | A×1 | negation/absence syntactic pattern |
| 3466 | cycle 371: 6 safe-zone 맵 정의 보존 (type: 'safe') | A-support×1 | vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 3529 | cycle 389: computeKillStreakBonus 반환에서 tierIdx 필드 제거 | A×1 | negation/absence syntactic pattern |
| 3538 | cycle 389: tierIdx 변수는 atkBonus/critBonus 계산용으로 유지 (회귀 가드) | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3567 | cycle 388 회귀 가드: migrateData killStreak normalization 0건 보존 | A×1 | negation/absence syntactic pattern |
| 3610 | cycle 391: DEFAULT_COMBAT_FLAGS export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3618 | cycle 391: playerStateUtils 활성 export 유지 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3642 | cycle 390 회귀 가드: cycle 389 computeKillStreakBonus.tierIdx 0건 보존 | A×1 | negation/absence syntactic pattern |
| 3691 | cycle 395: WEAPONLESS_ADVENTURER_SPRITES 정의 0건 | A×1 | negation/absence syntactic pattern |
| 3697 | cycle 395: JOB_SPRITE_SLUG_MAP `그림자 주군` (공백 포함) 키 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3730 | cycle 394 회귀 가드: RELIC_SYNERGIES id 0건 보존 | A×1 | negation/absence syntactic pattern |
| 3771 | cycle 397: 업적 분야에서 abyssFloor 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3790 | cycle 397: AchievementPanel 19 entry 보존 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3804 | cycle 396 회귀 가드: StatsPanel syn.label fix 보존 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3853 | cycle 398: DashboardMobileSummary trait.label 0건 (silent undefined 제거) | A×1 | negation/absence syntactic pattern |
| 3859 | cycle 398: DashboardMobileSummary trait.title 사용 (fix 검증) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3884 | cycle 397 회귀 가드: achievement category abyssFloor 0건 | A×1 | negation/absence syntactic pattern |
| 3929 | cycle 399: QuickSlotProps에서 onAssign / onUnassign 0건 | A×2 | negation/absence syntactic pattern |
| 3940 | cycle 399: QuickSlotProps 활성 필드 보존 (cycle 494가 dense cascade로 정리) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3953 | cycle 399: QuickSlotAssigner onAssign 동작 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3959 | cycle 398 회귀 가드: trait.label silent gate fix 보존 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |

### `tests/cycle-400-499.test.js`

| 라인 | 테스트 이름 | 클래스 (건수) | 근거 |
|---:|---|---|---|
| 47 | cycle 401: DashboardProps에서 mobile 0건 | A×1 | negation/absence syntactic pattern |
| 56 | cycle 401: MobileGameLayout Dashboard JSX에서 mobile prop 0건 | A×1 | negation/absence syntactic pattern |
| 65 | cycle 401: DashboardProps 활성 필드 보존 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 78 | slice 37: Dashboard는 단일 모험 기록 화면만 소유한다 | A×3 | negation/absence syntactic pattern |
| 88 | cycle 400 회귀 가드: cycle 399 QuickSlotProps onAssign 0건 | A×1 | negation/absence syntactic pattern |
| 141 | cycle 402: PostCombatCardProps에서 mobile 0건 | A×1 | negation/absence syntactic pattern |
| 150 | cycle 402: IntroScreenProps에서 mobile 0건 | A×1 | negation/absence syntactic pattern |
| 159 | cycle 402: GameRoot.tsx PostCombatCard JSX에서 mobile prop 0건 | A×1 | negation/absence syntactic pattern |
| 168 | cycle 402: App.tsx IntroScreen JSX에서 mobile prop 0건 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 176 | cycle 402: PostCombatCard 활성 action props 보존 (회귀 가드) | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 188 | cycle 401 회귀 가드: DashboardProps mobile 0건 | A×1 | negation/absence syntactic pattern |
| 243 | cycle 403: CraftingPanelProps에서 mobileFocused 0건 | A×1 | negation/absence syntactic pattern |
| 252 | cycle 403: JobChangePanelProps에서 mobileFocused 0건 | A×1 | negation/absence syntactic pattern |
| 261 | cycle 403: ControlPanel CraftingPanel/JobChangePanel JSX에서 mobileFocused prop 0건 | A-support×2, A×2 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) negation/absence syntactic pattern |
| 284 | cycle 402 회귀 가드: PostCombatCard / IntroScreen mobile 0건 | A×2 | negation/absence syntactic pattern |
| 338 | cycle 404: TerminalViewProps에서 stats 0건 | A×1 | negation/absence syntactic pattern |
| 347 | cycle 404: MobileGameLayout TerminalView JSX에서 stats prop 0건 | A-support×1, A×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) negation/absence syntactic pattern |
| 357 | cycle 404: TerminalView 활성 props 보존 (cycle 496/497 cascade로 추가 정리됨) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 372 | cycle 404: fullStats 변수 보존 (Dashboard / 기타 사용) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 380 | cycle 403 회귀 가드: CraftingPanel / JobChangePanel mobileFocused 0건 | A×2 | negation/absence syntactic pattern |
| 428 | cycle 406: useGameEngine actions에서 setAiThinking 0건 | A×1 | negation/absence syntactic pattern |
| 434 | cycle 406: 다른 setter 보존 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 443 | cycle 406: AT.SET_AI_THINKING reducer handler 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 449 | cycle 405 회귀 가드: Codex compact 0건 | A×1 | negation/absence syntactic pattern |
| 495 | cycle 407: formatRewardParts에서 essence/relicShard 분기 0건 | A×2 | negation/absence syntactic pattern |
| 506 | cycle 407: formatRewardParts 활성 분기 보존 (회귀 가드) | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 516 | cycle 407: 오늘의 임무 보상 표시는 reducer 지급 결과를 사용 | B×3 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 525 | cycle 407: 정합성 가드 — quests/achievements는 essence/relicShard 0건 | A×2 | negation/absence syntactic pattern |
| 540 | cycle 406 회귀 가드: useGameEngine setAiThinking 0건 | A×1 | negation/absence syntactic pattern |
| 580 | cycle 408: HEADGEAR_PLACEMENTS export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 588 | cycle 408: BODY_PLACEMENTS export 제거 (private) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 596 | cycle 408: anchorPoints 활성 export 유지 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 623 | cycle 312 회귀 가드: WEAPON_PLACEMENTS / OFFHAND_PLACEMENTS private 보존 | A×2 | negation/absence syntactic pattern |
| 631 | cycle 407 회귀 가드: formatRewardParts essence/relicShard 0건 | A×2 | negation/absence syntactic pattern |
| 680 | cycle 409: getTraitItemResonance return에서 reasons 0건 | A×2 | negation/absence syntactic pattern |
| 692 | cycle 409: 활성 출력 필드 보존 (score/label/summary) | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 702 | cycle 409: 함수 내부 reasons 사용 보존 (회귀 가드) | B×3 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 733 | cycle 408 회귀 가드: HEADGEAR / BODY PLACEMENTS private 보존 | A×2 | negation/absence syntactic pattern |
| 780 | cycle 411: StatsPanel SIG_SET_TONE에서 frost / arcane 0건 | A×2 | negation/absence syntactic pattern |
| 791 | cycle 411: EquipmentPanel SIG_SET_TONE에서 frost / arcane 0건 | A×2 | negation/absence syntactic pattern |
| 802 | cycle 411: 활성 tone 4종 보존 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 815 | cycle 411: 정합성 가드 — signatureSets.json은 4 tone만 emit | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 825 | cycle 410 회귀 가드: getTraitItemResonance.reasons 0건 | A×1 | negation/absence syntactic pattern |
| 876 | cycle 414: ICON_PATHS equipment-style 16 키 0건 | A×1 | negation/absence syntactic pattern |
| 890 | cycle 414: 활성 12 키 보존 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 903 | cycle 414: ICON_PATHS lookup + fallback 동작 보존 (회귀 가드) | B×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 911 | cycle 413 회귀 가드: SignatureBadge TONE_COLORS.steel 0건 | A×1 | negation/absence syntactic pattern |
| 954 | cycle 415: getWeeklySpecial return에서 isWeeklySpecial 0건 | A×1 | negation/absence syntactic pattern |
| 987 | cycle 414 회귀 가드: ICON_PATHS sword 0건 | A×1 | negation/absence syntactic pattern |
| 1030 | cycle 416: ACTION_BUTTONS에서 tag / detail 0건 | A×2 | negation/absence syntactic pattern |
| 1041 | cycle 416: ACTION_BUTTONS 활성 필드 보존 (회귀 가드) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1052 | cycle 416: ACTION_BUTTONS 4 entry 보존 (attack/skill/item/escape) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1063 | cycle 416: compactMetaEntries 배열은 cycle 485 cascade로 제거됨 (paired 보존) | A×1 | negation/absence syntactic pattern |
| 1071 | cycle 415 회귀 가드: getWeeklySpecial isWeeklySpecial 0건 | A×1 | negation/absence syntactic pattern |
| 1113 | cycle 418: AetherMark SIZE_MAP에서 sm 0건 | A×1 | negation/absence syntactic pattern |
| 1122 | cycle 418: 활성 사이즈 보존 (md/lg) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1133 | cycle 418: fallback 보존 (회귀 가드) — cycle 432가 default size 제거 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1141 | cycle 418: 정합성 가드 — AetherMark consumers 모두 md/lg만 사용 | B×2, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern |
| 1150 | cycle 417 회귀 가드: SLOT_CONFIG icon 0건 | A×1 | negation/absence syntactic pattern |
| 1191 | cycle 419: SignalBadge SIZE_CLASS에서 md/lg 0건 | A×2 | negation/absence syntactic pattern |
| 1200 | cycle 419: sm 사이즈 보존 (활성) | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1208 | cycle 419: fallback 보존 (회귀 가드) — cycle 433이 default size 제거 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1218 | cycle 419: 정합성 가드 — SignalBadge size="md" / size="lg" 호출 0건 | A×2 | negation/absence syntactic pattern |
| 1238 | cycle 418 회귀 가드: AetherMark SIZE_MAP.sm 0건 | A×2 | negation/absence syntactic pattern |
| 1282 | cycle 423: ControlPanel sidebarLabel 0건 | A×1 | negation/absence syntactic pattern |
| 1288 | cycle 423: 활성 필드 보존 (label / key / icon / onClick) | B×4 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1298 | cycle 423: renderActionButton destructure 정합성 가드 — sidebarLabel 미destructure | A×1 | negation/absence syntactic pattern |
| 1307 | cycle 422 회귀 가드: MonsterIcon 골렘 includes 1건만 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1351 | cycle 424: EXACT_ICON_CATEGORY_BY_TYPE에서 undefined 엔트리 0건 | A×1 | negation/absence syntactic pattern |
| 1359 | cycle 424: 활성 type 매핑 10종 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1371 | cycle 424: `\|\| misc` fallback 보존 → recipes 등 type 부재 아이템 동일 동작 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1396 | cycle 423 회귀 가드: ControlPanel sidebarLabel 0건 | A×1 | negation/absence syntactic pattern |
| 1443 | cycle 425: pickFallbackEvent에서 `FALLBACK_EVENT_POOL[loc]` 직접 lookup 0건 | A×1 | negation/absence syntactic pattern |
| 1452 | cycle 425: `explicit` 변수 잔존 0건 | A×1 | negation/absence syntactic pattern |
| 1461 | cycle 425: poolKey / basePool 활성 path 보존 | B×3 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1484 | cycle 424 회귀 가드: EXACT_ICON_CATEGORY_BY_TYPE undefined 0건 | A×1 | negation/absence syntactic pattern |
| 1527 | cycle 428 후속: 반복 reward chip helper를 제거하고 정확한 보상 요약을 재사용 | A×1, B×2 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1534 | cycle 427 회귀 가드: SignatureBadge TONE_COLORS rust 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1579 | cycle 432: AetherMark destructure에서 default size 값 제거 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1588 | cycle 432: 2 호출자 모두 size 명시 전달 (정합성 가드) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1595 | cycle 432: className cycle 493 cascade로 prop 자체 제거 | A×1 | negation/absence syntactic pattern |
| 1605 | cycle 432: SIZE_MAP fallback 보존 (방어용) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1619 | cycle 431 회귀 가드: AvatarEquipmentOverlay default layer 0건 | A×1 | negation/absence syntactic pattern |
| 1665 | cycle 433: SignalBadge destructure에서 default tone / size 제거 | A×2, B×2 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1676 | cycle 433: className cycle 501 cascade로 prop 자체 제거 (children / rest 보존) | A×1, B×2 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1688 | cycle 433: SIZE_CLASS / TONE_CLASS fallback 방어용 보존 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1698 | cycle 433: 정합성 가드 — SignalBadge 호출 수 ≤ size="..." 매칭 수 | A-support×1, B×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1733 | cycle 419 회귀 가드: SIZE_CLASS md/lg 0건 | A×2 | negation/absence syntactic pattern |
| 1742 | cycle 432 회귀 가드: AetherMark default size 0건 | A×1 | negation/absence syntactic pattern |
| 1785 | cycle 435: makeBattleRecord 본체에서 ts 필드 0건 | A×2 | negation/absence syntactic pattern |
| 1794 | cycle 435: 활성 필드 (result / hpRatio) 보존 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1816 | cycle 435: 정합성 가드 — battle.ts read 0건 (전체 src/) | A×1 | negation/absence syntactic pattern |
| 1834 | cycle 434 회귀 가드: EquipmentAvatarPreview defaults 0건 | A×2 | negation/absence syntactic pattern |
| 1883 | cycle 436: getDailyDeals 본체에서 isDailyDeal 0건 | A×1 | negation/absence syntactic pattern |
| 1905 | cycle 436: 정합성 가드 — production isDailyDeal read 0건 | A×1 | negation/absence syntactic pattern |
| 1922 | cycle 415 회귀 가드: getWeeklySpecial 마커 할당 0건 | A×1 | negation/absence syntactic pattern |
| 1930 | cycle 435 회귀 가드: makeBattleRecord ts 0건 | A×1 | negation/absence syntactic pattern |
| 1970 | cycle 437: EventPanel mobileFocused cycle 489 cascade로 prop 자체 제거 | A×1 | negation/absence syntactic pattern |
| 1977 | cycle 437: ControlPanel <EventPanel> mobileFocused 전달 cascade 제거 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 1984 | cycle 436 회귀 가드: getDailyDeals isDailyDeal 0건 | A×1 | negation/absence syntactic pattern |
| 2028 | cycle 439: handleEventChoice 본체에서 timestamp 0건 | A×1 | negation/absence syntactic pattern |
| 2036 | cycle 439: 활성 필드 (event / choice / outcome) 보존 | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2046 | cycle 439: 정합성 가드 — history.timestamp / entry.timestamp read 0건 | A×1 | negation/absence syntactic pattern |
| 2066 | cycle 438 회귀 가드: codex 엔트리 obtainedAt 0건 | A×1 | negation/absence syntactic pattern |
| 2110 | cycle 441: FocusPanelHeader destructure에서 default backLabel 제거 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2119 | cycle 441: 보존 default — meta/titleClassName/bleedClassName 그대로 | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2131 | cycle 441: 정합성 가드 — 5 호출자 모두 backLabel 명시 전달 | A-support×1, B×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2154 | cycle 439 회귀 가드: handleEventChoice timestamp 0건 | A×1 | negation/absence syntactic pattern |
| 2202 | cycle 442: getMapProgressState return에서 visited 필드 0건 | A×1 | negation/absence syntactic pattern |
| 2212 | cycle 442: 내부 const visited 보존 (state 계산용) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2232 | cycle 442: 정합성 가드 — production .visited read 0건 | A×1 | negation/absence syntactic pattern |
| 2252 | cycle 441 회귀 가드: FocusPanelHeader default backLabel 0건 | A×1 | negation/absence syntactic pattern |
| 2379 | cycle 442 회귀 가드: getMapProgressState visited 출력 0건 | A×1 | negation/absence syntactic pattern |
| 2430 | slice 37: Dashboard 마을 메뉴 핸들러 0건 | A×1 | negation/absence syntactic pattern |
| 2435 | slice 37: 마을 핵심 행동은 ControlPanel에서 직접 연다 | B×7 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2446 | slice 37: Dashboard 중복 마을 행동 목록 0건 | A×1 | negation/absence syntactic pattern |
| 2451 | slice 37: 새 여정 초기화는 설정 탭에서만 노출한다 | B×6 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2513 | cycle 446: buildRuntimePalette return에서 4 dead 필드 0건 | A×4 | negation/absence syntactic pattern |
| 2598 | cycle 447: deriveCharacterAppearance.palette에서 5 dead 필드 0건 | A×5 | negation/absence syntactic pattern |
| 2634 | cycle 447: 정합성 가드 — production palette dead 필드 read 0건 | A×1 | negation/absence syntactic pattern |
| 2702 | cycle 448: ELEMENT_COLOR_MAP에서 '물리' 엔트리 0건 | A×1 | negation/absence syntactic pattern |
| 2710 | cycle 448: 활성 6 키 보존 (화염/냉기/어둠/빛/자연/대지) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2721 | cycle 448: 정합성 가드 — items.ts에 elem='물리' 0건 | A×1 | negation/absence syntactic pattern |
| 2789 | cycle 449: PHYSICAL_ELEMENTS 정의 0건 | A×1 | negation/absence syntactic pattern |
| 2795 | cycle 449: MAGIC_JOBS 활성 path 보존 | B×2 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2802 | cycle 449: 정합성 가드 — items.ts에 elem='물리' / 'physical' 0건 | A×1 | negation/absence syntactic pattern |
| 2838 | cycle 448 회귀 가드: ELEMENT_COLOR_MAP 물리 0건 | A×1 | negation/absence syntactic pattern |
| 2892 | cycle 452: ${...} destructure에서 default compact 제거 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2902 | cycle 452: 정합성 가드 — Dashboard 6 panel 호출 존재 | A-support×1 | vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 2912 | cycle 451 회귀 가드: GravePanel default compact 0건 | A×1 | negation/absence syntactic pattern |
| 2955 | cycle 453: 전체 직업 matrix용 nodes / edges / buildTree 0건 | A×2 | negation/absence syntactic pattern |
| 2961 | cycle 453: 현재 직업의 직접 다음 계보만 읽는다 | B×2, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime / (3) negation/absence syntactic pattern |
| 2968 | cycle 453: tier 4 고정 grid 대신 focused route를 사용한다 | A×1, B×2 | (1) negation/absence syntactic pattern / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2975 | cycle 452 회귀 가드: Dashboard 6 panel default compact 0건 | A×1 | negation/absence syntactic pattern |
| 3017 | cycle 455: synthetic node description copy 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3023 | cycle 455: 정합성 가드 — legacy node.desc / data.desc read 0건 | A×2 | negation/absence syntactic pattern |
| 3029 | cycle 455: job name / tier / requirement 활성 read 보존 | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3036 | cycle 453 회귀 가드: full matrix 대신 direct route contract 보존 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3058 | cycle 456: renderResetControl helper cycle 486 cascade로 제거 보존 | A×1 | negation/absence syntactic pattern |
| 3100 | cycle 457: <CombatPanel> 호출에서 compact={false} / dense={false} 0건 | A-support×1, A×2 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) negation/absence syntactic pattern |
| 3110 | cycle 457: 정합성 가드 — mobile prop 보존 | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3121 | cycle 457: CombatPanel destructure에 compact / dense 0건 (cycle 485 cascade 보존) | A×2 | negation/absence syntactic pattern |
| 3176 | cycle 461: ClassCard destructure에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 3184 | cycle 461: if (compact) 분기 0건 | A×2 | negation/absence syntactic pattern |
| 3193 | cycle 461: 정합성 가드 — JobChangePanel callsite compact 전달 0건 | A×1 | negation/absence syntactic pattern |
| 3201 | cycle 461: jobName / onSelect / disabled prop 보존 | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3252 | cycle 463: ClassIcon destructure에서 cssClass 0건 | A×1 | negation/absence syntactic pattern |
| 3260 | cycle 463: body 템플릿에서 ${cssClass} 보간 0건 | A×2 | negation/absence syntactic pattern |
| 3266 | cycle 463: 정합성 가드 — 4 callsite cssClass 전달 0건 | A-support×1, A×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) negation/absence syntactic pattern |
| 3284 | cycle 463: className(jobName 별칭) / size / tier 보존 | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3338 | cycle 464: ClassIcon destructure에서 showBorder 0건 | A×1 | negation/absence syntactic pattern |
| 3346 | cycle 464: showBorder 참조 / ternary 가지 0건 | A×1, B×2 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3354 | cycle 464: 정합성 가드 — 4 callsite showBorder 명시 0건 | A×1 | negation/absence syntactic pattern |
| 3370 | cycle 464: className(jobName 별칭) / size / tier 보존 | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3430 | cycle 467: eyebrow / archiveLabel 기본값 0건 | A×2 | negation/absence syntactic pattern |
| 3439 | cycle 467: 정합성 가드 — 5 callsite eyebrow 명시 전달 | A-support×1, B×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3457 | cycle 467: cycle 441 회귀 가드 — backLabel 기본값 0건 | A×1 | negation/absence syntactic pattern |
| 3465 | cycle 467: title / onBack / rightSlot / archiveTestId 활성 기본값 보존 | B×4 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3518 | cycle 469: pacingProfile fallback \|\| getMapPacingProfile 0건 | A×1 | negation/absence syntactic pattern |
| 3524 | cycle 469: getMapPacingProfile import 제거 | A×1 | negation/absence syntactic pattern |
| 3529 | cycle 469: 정합성 가드 — producer는 항상 valid profile 반환 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3537 | cycle 469: getDiscoveryOdds import / pacingProfile read 보존 | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3591 | cycle 471: desktopArchiveCompact const 0건 | A×2 | negation/absence syntactic pattern |
| 3599 | cycle 471: 정합성 가드 — Dashboard 핵심 props 보존 | B×3 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3607 | cycle 471: cycle 452 회귀 가드 — 6 panel default compact 0건 | A×1 | negation/absence syntactic pattern |
| 3663 | cycle 472: MapNavigator destructure에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 3671 | cycle 472: showAllMaps state + ternary 0건 | A×2 | negation/absence syntactic pattern |
| 3677 | cycle 472: 본체 compact 참조 0건 | A×1 | negation/absence syntactic pattern |
| 3682 | cycle 472: 정합성 가드 — Dashboard callsite compact 0건 | A×1 | negation/absence syntactic pattern |
| 3690 | cycle 472: player / grave / stats / selectedMapName 보존 | B×4 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3749 | cycle 473: AchievementPanel destructure에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 3757 | cycle 473: interface에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 3765 | cycle 473: cascade dead 0건 (showAll/summary/hidden/showSummaryView) | A×4 | negation/absence syntactic pattern |
| 3773 | cycle 473: 본체 compact 참조 0건 | A×1 | negation/absence syntactic pattern |
| 3778 | cycle 473: 정합성 가드 — Dashboard <AchievementPanel> compact 전달 0건 | A×1 | negation/absence syntactic pattern |
| 3786 | cycle 473: player / actions / 진행·여정 핵심 로직 보존 | B×5 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3845 | cycle 475: StatsPanel destructure에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 3853 | cycle 475: interface에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 3861 | cycle 475: cascade dead 0건 (showAllStats / hasExpandableSections / topKillPreview) | A×3 | negation/absence syntactic pattern |
| 3868 | cycle 475: 본체 compact 참조 0건 | A×1 | negation/absence syntactic pattern |
| 3873 | cycle 475: 정합성 가드 — Dashboard <StatsPanel> compact 전달 0건 | A×1 | negation/absence syntactic pattern |
| 3881 | cycle 475: player / stats / topKills / passive 핵심 로직 보존 | B×4 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3935 | cycle 477: SystemTab destructure에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 3943 | cycle 477: interface에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 3951 | cycle 477: cascade dead 0건 (showAllSystem / showSystemSummary) | A×2 | negation/absence syntactic pattern |
| 3957 | cycle 477: 본체 compact 참조 0건 | A×1 | negation/absence syntactic pattern |
| 3962 | cycle 477: 정합성 가드 — Dashboard <SystemTab> compact 전달 0건 | A×1 | negation/absence syntactic pattern |
| 3970 | cycle 477: player / actions / stats / runtime / qaReadout / leaderboard 보존 | B×5 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4019 | cycle 478: BuildAdvicePanel destructure에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 4027 | cycle 478: interface에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 4035 | cycle 478: 본체 compact 참조 0건 | A×1 | negation/absence syntactic pattern |
| 4040 | cycle 478: 정합성 가드 — Dashboard <BuildAdvicePanel> compact 전달 0건 | A×1 | negation/absence syntactic pattern |
| 4048 | cycle 478: player / open 토글 / 추천 유물 핵심 로직 보존 | B×4 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4106 | cycle 482: SmartInventory destructure에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 4114 | cycle 482: interface에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 4122 | cycle 482: cascade dead 0건 | A×6 | negation/absence syntactic pattern |
| 4132 | cycle 482: 본체 compact 참조 0건 | A×1 | negation/absence syntactic pattern |
| 4137 | cycle 482: 정합성 가드 — Dashboard <SmartInventory> compact 전달 0건 | A×1 | negation/absence syntactic pattern |
| 4146 | cycle 482: player / actions / quickSlots 핵심 로직 보존 | B×4, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern |
| 4158 | cycle 482: cycle 471 cascade 완료 — Dashboard 11 panel 모두 cascade 정리됨 | A×1 | negation/absence syntactic pattern |
| 4215 | cycle 483: ArchiveTabButton destructure에서 dense / iconOnly 0건 | A×2 | negation/absence syntactic pattern |
| 4224 | cycle 483: 본체 dense / iconOnly 참조 0건 | A×2 | negation/absence syntactic pattern |
| 4230 | slice 37: 단일 ArchiveTabButton 렌더에서 dense / iconOnly 전달 0건 | B×1, A×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 4240 | cycle 483: icon / label / active / onClick / compact / rail / testId / badge prop 보존 | B×8 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4299 | cycle 484: DashboardFallback destructure에서 summary 0건 | A×1 | negation/absence syntactic pattern |
| 4307 | cycle 484: DashboardFallback 본체에서 summary ternary 0건 | A×1 | negation/absence syntactic pattern |
| 4315 | cycle 484: 정합성 가드 — DashboardFallback callsite summary 전달 0건 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 4322 | cycle 484 후속: 모험 기록 CTA는 원정 준비에 통합하고 핵심 계약을 보존 | A×1, B×3 | (1) negation/absence syntactic pattern / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4386 | cycle 485: CombatPanel destructure에서 compact / dense 0건 | A×2 | negation/absence syntactic pattern |
| 4395 | cycle 485: interface에서 compact / dense 0건 | A×2 | negation/absence syntactic pattern |
| 4404 | cycle 485: 본체 compact / dense / compactMetaEntries 참조 0건 | A×3 | negation/absence syntactic pattern |
| 4411 | cycle 485: 정합성 가드 — ControlPanel <CombatPanel> compact / dense 전달 0건 | A×2 | negation/absence syntactic pattern |
| 4420 | cycle 485: player / actions / enemy / stats / isAiThinking / mobile prop 보존 | B×6 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4483 | cycle 486: ControlPanel mobileFocused cycle 489 cascade로 prop 자체 제거 | A×1 | negation/absence syntactic pattern |
| 4490 | cycle 486: renderResetControl helper / 2 unreachable 블록 0건 | A×3 | negation/absence syntactic pattern |
| 4497 | cycle 486: confirmReset state cascade dead 0건 | A×1 | negation/absence syntactic pattern |
| 4502 | cycle 486: line 181 EVENT 분기 ternary 첫 가지 inline (mobile-focused class) | B×1, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern |
| 4512 | cycle 486: MobileGameLayout 2 callsite mobileFocused cycle 489 cascade로 제거 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 4522 | cycle 486: core 구조 보존 (renderActionButton / coreButtons / GS 분기 등) | B×4 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4576 | cycle 489: EventPanel destructure에서 mobileFocused 0건 | A×1 | negation/absence syntactic pattern |
| 4584 | cycle 489: interface에서 mobileFocused 0건 | A×1 | negation/absence syntactic pattern |
| 4592 | cycle 489: 본체 mobileFocused / overlayPanelClass 참조 0건 | A×2 | negation/absence syntactic pattern |
| 4598 | cycle 489: 정합성 가드 — ControlPanel <EventPanel> mobileFocused 전달 0건 | A×1 | negation/absence syntactic pattern |
| 4606 | cycle 489: ControlPanel mobileFocused prop 완전 cascade 제거 | A×2 | negation/absence syntactic pattern |
| 4619 | cycle 489: currentEvent / actions / panelBody 핵심 로직 보존 | B×4 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4668 | cycle 493: AetherMark destructure에서 className 0건 | A×1 | negation/absence syntactic pattern |
| 4676 | cycle 493: body ${className} 보간 0건 | A×1 | negation/absence syntactic pattern |
| 4681 | cycle 493: 정합성 가드 — 2 callsite className 전달 0건 | B×2, A×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 4693 | cycle 493: size prop 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4701 | cycle 493: cycle 418/432 회귀 가드 — SIZE_MAP md/lg + 본체 동작 보존 | B×3 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4746 | cycle 494: QuickSlot destructure에서 dense 0건 | A×1 | negation/absence syntactic pattern |
| 4754 | cycle 494: QuickSlot 본체 dense 참조 0건 | A×1 | negation/absence syntactic pattern |
| 4762 | cycle 494: QuickSlot interface에서 dense 0건 | A×1 | negation/absence syntactic pattern |
| 4770 | cycle 494: QuickSlotAssigner destructure에서 compact 0건 | A×1 | negation/absence syntactic pattern |
| 4778 | cycle 494: QuickSlotAssigner 본체 compact 참조 0건 | A×1 | negation/absence syntactic pattern |
| 4785 | cycle 494: 핵심 props 보존 | B×7 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4852 | cycle 496: TerminalView destructure에서 className / toolbarLeft 0건 | A×2 | negation/absence syntactic pattern |
| 4861 | cycle 496: interface에서 className / toolbarLeft 0건 | A×2 | negation/absence syntactic pattern |
| 4870 | cycle 496: body ${className} 보간 + {toolbarLeft} 렌더 0건 | A×2 | negation/absence syntactic pattern |
| 4876 | cycle 496: 정합성 가드 — MobileGameLayout <TerminalView> className/toolbarLeft 0건 | A×2 | negation/absence syntactic pattern |
| 4885 | cycle 496: 핵심 props 보존 (cycle 497이 autoFocusInput/showInput 추가 정리) | B×4 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4947 | cycle 497: TerminalView destructure에서 autoFocusInput / showInput 0건 | A×2 | negation/absence syntactic pattern |
| 4956 | cycle 497: interface에서 autoFocusInput / showInput 0건 | A×2 | negation/absence syntactic pattern |
| 4965 | cycle 497: 본체 autoFocusInput / showInput / footerInput / showFooter 참조 0건 | A×5 | negation/absence syntactic pattern |
| 4974 | cycle 497: 정합성 가드 — MobileGameLayout 두 명시 attr 제거 | A×2 | negation/absence syntactic pattern |
| 4983 | cycle 497: 핵심 props / 본체 로직 보존 | B×4 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |

### `tests/cycle-500-599.test.js`

| 라인 | 테스트 이름 | 클래스 (건수) | 근거 |
|---:|---|---|---|
| 98 | cycle 501: SignalBadge destructure에서 className 0건 | A×1 | negation/absence syntactic pattern |
| 106 | cycle 501: body ${className} 보간 0건 | A×1 | negation/absence syntactic pattern |
| 111 | cycle 501: 정합성 가드 — 모든 SignalBadge 호출자에 className 명시 전달 0건 | A-support×1, A×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) negation/absence syntactic pattern |
| 189 | cycle 502: incrementStat signature에서 amount 0건 | A×1 | negation/absence syntactic pattern |
| 197 | cycle 502: body amount 참조 0건 | A×1, B×2 | (1) negation/absence syntactic pattern / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 212 | cycle 502: 정합성 가드 — economy reducer callsite는 amount를 전달하지 않는다 | B×3, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 227 | cycle 502: updateStats 호출 / Player 타입 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 275 | cycle 503: consumeInventoryItemByName signature에서 count default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 284 | cycle 503: 정합성 가드 — equipment reducer callsite 3 args | B×4 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 300 | cycle 503: body 동작 보존 (filter / removed / nextInventory) | B×5, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (3) negation/absence syntactic pattern |
| 313 | cycle 503: cycle 502 회귀 가드 — incrementStat amount 0건 | A×1 | negation/absence syntactic pattern |
| 366 | cycle 504: 지급 전 완료를 추측하는 helper 0건 | A×1 | negation/absence syntactic pattern |
| 372 | cycle 504: 3 hook의 중복 완료 로그 wrapper 0건 | A×1 | negation/absence syntactic pattern |
| 384 | cycle 504: 정합성 가드 — 모든 hook은 진행 action만 전달 | A×1, A-support×2 | (1) negation/absence syntactic pattern / (2) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 403 | cycle 504: 본체 동작 보존 — amount 사용 + missions filter | B×3, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern |
| 471 | cycle 505: grantGold signature에서 amount default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 480 | cycle 505: body defensive guard 보존 | B×5 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 496 | cycle 505: 정합성 가드 — 모든 grantGold 호출자가 2 args 전달 | A-support×1 | vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 513 | cycle 505: cycle 502/503/504 회귀 가드 — 이전 default 정리 보존 | A×3 | negation/absence syntactic pattern |
| 573 | cycle 506: getEnhanceAvailability signature에서 gold / inventory default 0건 | A×2, B×2 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 584 | cycle 506: 정합성 가드 — 강화 소비 3곳은 공용 preview를 명시 인자로 사용 | A-support×1 | vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 597 | cycle 506: body canEnhance / affordable 분기 보존 | B×7 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 615 | cycle 506: cycle 502-505 회귀 가드 — 이전 default 정리 보존 | A×4 | negation/absence syntactic pattern |
| 673 | cycle 507: getNarrativeEventChance signature defaults 0건 | A×4 | negation/absence syntactic pattern |
| 684 | cycle 507: getQuietExplorationChance signature defaults 0건 | A×2 | negation/absence syntactic pattern |
| 693 | cycle 507: 정합성 가드 — 모든 callsite 명시 전달 | B×3, A-support×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 718 | cycle 507: body 동작 보존 | B×5 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 733 | cycle 507: cycle 502-506 회귀 가드 — 이전 정리 보존 | A×2 | negation/absence syntactic pattern |
| 782 | cycle 509: getAdventureGuidance signature에서 runtimeState default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 791 | cycle 509: 정합성 가드 — ControlPanel callsite 4 args (gameState 명시 전달) | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 805 | cycle 509: body runtimeState 분기 보존 | B×4, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime / (3) negation/absence syntactic pattern |
| 820 | cycle 509: cycle 502-508 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 870 | cycle 512: getArmorStyleFromItem signature에서 fallback default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 879 | cycle 512: 정합성 가드 — 모든 callsite fallback 명시 전달 | A-support×1, B×2 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 899 | cycle 512: body keyword 분기 / fallback return 보존 | B×10 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 915 | cycle 512: cycle 502-511 회귀 가드 — util default 청소 시리즈 보존 | A×1 | negation/absence syntactic pattern |
| 962 | cycle 515: advanceExploreState signature에서 stats / outcome default 0건 | A×2, B×2 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 973 | cycle 515: 정합성 가드 — _shared.ts callsite 2 args 명시 전달 보존 | B×2, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 985 | cycle 515: body switch outcome 분기 + getExploreState 호출 보존 | B×6, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime / (3) negation/absence syntactic pattern |
| 1003 | cycle 515: cycle 502-514 회귀 가드 — util default 청소 시리즈 보존 | A×3 | negation/absence syntactic pattern |
| 1055 | cycle 516: getEnhanceRequirement signature에서 currentLevel default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1064 | cycle 516: 정합성 가드 — internal + test callsite 동작 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1075 | cycle 516: body nullish fallback 보존 | B×3, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 1088 | cycle 516: cycle 502-515 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1138 | cycle 517: getArmorBodyStyle signature에서 fallback default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1147 | cycle 517: 정합성 가드 — internal callsite 보존 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1157 | cycle 517: body return fallback / getArmorStyleFromItem 호출 보존 | B×3 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1171 | cycle 517: 외부 wrapper getEquipmentArtProfile fallbackArmorStyle default 보존 (cycle 513) | B×2 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1181 | cycle 517: cycle 502-516 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1233 | cycle 518: getWeaponEquipScore signature에서 slot default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1242 | cycle 518: 정합성 가드 — 2 internal callsite 보존 (main / offhand 명시) | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1258 | cycle 518: body getWeaponAttackValue / getWeaponCritBonus slot 전달 보존 | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1269 | cycle 518: cycle 291 export downgrade 보존 (private const 유지) | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1277 | cycle 518: cycle 502-517 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1325 | cycle 519: getMapLevel signature에서 playerLevel default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1334 | cycle 519: 정합성 가드 — internal callsite 보존 | B×3 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1350 | cycle 519: body (playerLevel \|\| 1) defensive 가드 보존 (N3: minLv 체인은 제거) | B×4, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern / (3) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1374 | cycle 519: cycle 502-518 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1424 | cycle 521: hashText signature에서 value default '' 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1433 | cycle 521: mixHex signature에서 ratio default 0.5 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1442 | cycle 521: 정합성 가드 — 5 internal callsite 보존 | B×5 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1459 | cycle 521: body 동작 보존 | B×4 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1475 | cycle 521: cycle 502-519 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1524 | cycle 522: toInt signature에서 fallback default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1533 | cycle 522: 정합성 가드 — 모든 internal callsite가 fallback을 명시한다 | A-support×1, B×2, A×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) positive check on a call/value/lookup/template/class that is exercised at runtime / (3) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (4) negation/absence syntactic pattern |
| 1561 | cycle 522: body ternary 처리 보존 | B×2, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 1577 | cycle 522: cycle 502-521 회귀 가드 — util default 청소 시리즈 보존 | A×3 | negation/absence syntactic pattern |
| 1628 | cycle 525: hashString signature에서 value default '' 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1637 | cycle 525: classifyChoice signature에서 choiceText default '' 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1647 | cycle 525: 정합성 가드 — internal + test callsite 보존 | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1661 | cycle 525: body 동작 보존 | B×4 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1682 | cycle 525: cycle 502-524 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1736 | cycle 526: toPercent signature에서 value default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1745 | cycle 526: 정합성 가드 — 3 internal callsite 보존 | B×6 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1761 | cycle 526: body Math.round/template 보존 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1770 | cycle 526: cycle 502-525 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1826 | cycle 527: dedupeChoices signature에서 choices default [] 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1836 | cycle 527: normalizeOutcomes signature에서 3 defaults 0건 | A×3 | negation/absence syntactic pattern |
| 1849 | cycle 527: 정합성 가드 — 2 internal callsite 보존 | B×5 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1870 | cycle 527: body Array.isArray + forEach 가드 보존 | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1892 | cycle 527: cycle 502-526 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1944 | cycle 528: pickBestOneHandPair signature에서 2 defaults 0건 | A×2, B×2 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1957 | cycle 528: 정합성 가드 — internal callsite 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1972 | cycle 528: body filter/forEach/getWeaponEquipScore 호출 보존 | B×5 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1992 | cycle 528: cycle 502-527 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 2045 | cycle 529: softenColor signature에서 alpha default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2055 | cycle 529: 정합성 가드 — internal callsite 보존 | B×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2067 | cycle 529: body hex 가드 + rgba template 보존 | B×4 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2082 | cycle 529: cycle 502-528 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 2134 | cycle 532: buildClassVitals signature에서 meta default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2144 | cycle 532: 정합성 가드 — 2 callsite 보존 | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2159 | cycle 532: body defensive guard 보존 | B×5 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2175 | cycle 532: cycle 502-531 회귀 가드 — util default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 2229 | cycle 536: applyExpGain signature에서 expGained default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2255 | cycle 536: 정합성 가드 — 4 production callsite 보존 | B×5 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2275 | cycle 536: body level-up loop / visualEffect 처리 보존 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2286 | cycle 536: cycle 502-535 회귀 가드 — util/component/hook default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 2345 | cycle 537: calculateDamage signature에서 options default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2356 | cycle 537: 정합성 가드 — 2 internal callsite 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2363 | cycle 537: destructuring inner defaults 보존 | B×7 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2384 | cycle 537: cycle 502-536 회귀 가드 — util/component/hook/system default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 2406 | cycle 538: resolveDailyProtocolProgress signature에서 amount default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2416 | cycle 538: 정합성 가드 — production + test callsite 보존 | B×3, A-support×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (3) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2443 | cycle 538: body 동작 보존 | B×3 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2456 | cycle 538: cycle 502-537 회귀 가드 — util/component/hook/system default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 2503 | cycle 539: callProxy signature에서 2 defaults 0건 | A×2 | negation/absence syntactic pattern |
| 2514 | cycle 539: 정합성 가드 — 2 internal callsite 보존 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2529 | cycle 539: body setTimeout / LatencyTracker.trackCall 처리 보존 | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2557 | cycle 539: cycle 502-538 회귀 가드 — util/component/hook/system/reducer default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 2615 | cycle 542 (A2 이관): 델타 포맷 헬퍼 signature에 default 0건 | A-support×1, A×2 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) negation/absence syntactic pattern |
| 2631 | cycle 542 (A2 이관): 정합성 가드 — 델타 조각 생성 callsite 보존 | B×6, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 2654 | cycle 542 (A2 이관): body template literal 보존 | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2664 | cycle 542: cycle 502-541 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 2710 | cycle 543: synthesize signature에서 useProtect default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2719 | cycle 543: 정합성 가드 — CraftingPanel callsite 보존 | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2733 | cycle 543: body validation / signature guard 보존 | B×5 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2751 | cycle 543: cycle 502-542 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 2800 | cycle 544: scoreTag signature에서 reasons default [] 0건 | A×1 | negation/absence syntactic pattern |
| 2809 | cycle 544: hasAnyJob signature에서 jobs default [] 0건 | A×1 | negation/absence syntactic pattern |
| 2818 | cycle 544: 정합성 가드 — 15 internal callsite 보존 | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2833 | cycle 544: body 동작 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 2847 | cycle 544: cycle 502-543 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 2898 | cycle 545: pickFallbackEvent signature에서 2 defaults 0건 | A×2 | negation/absence syntactic pattern |
| 2909 | cycle 545: getQuestReason signature에서 targetMaps default 0건 | A×1 | negation/absence syntactic pattern |
| 2918 | cycle 545: 정합성 가드 — pickFallbackEvent RNG + getQuestReason callsite 보존 | B×6 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2945 | cycle 545: body 동작 보존 | B×4 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 2964 | cycle 545: cycle 502-544 회귀 가드 — default 청소 시리즈 보존 | A×3 | negation/absence syntactic pattern |
| 3013 | cycle 547: applyEntropyTick signature에서 activeSynergies default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3024 | cycle 547: 정합성 가드 — 2 internal + test callsite 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3042 | cycle 547: body turnCount / relics 처리 보존 | B×4 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3059 | cycle 547: cycle 502-546 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 3107 | cycle 548: applyCritMpRestore signature에서 2 defaults 0건 | A×2 | negation/absence syntactic pattern |
| 3118 | cycle 548: 정합성 가드 — 2 internal callsite 보존 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3130 | cycle 548: body crit_mp_regen 분기 + getEffectiveMaxMp 보존 | B×4 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3147 | cycle 548: cycle 502-547 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 3206 | cycle 553: applyFatalProtection signature에서 3 defaults 0건 | A×3 | negation/absence syntactic pattern |
| 3219 | cycle 553: activeSynergies default 보존 (reachable, partial cleanup) | B×2 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3239 | cycle 553: 정합성 가드 — production + internal + test callsite 보존 | B×5 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3261 | cycle 553: cycle 502-552 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 3310 | cycle 554: getExploreState signature에서 stats default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3320 | cycle 554: 정합성 가드 — 5 internal callsite 보존 | B×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3328 | cycle 554: body stats?.exploreState 가드 보존 (undefined 안전) | B×4 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3341 | cycle 554: cycle 502-553 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 3391 | cycle 556: 일반 보상 formatter default 0건 | A×1 | negation/absence syntactic pattern |
| 3399 | cycle 556: 정합성 가드 — 일반 보상 callsite와 일일 지급 formatter 보존 | B×5, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern / (3) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3419 | cycle 556: body exp/gold와 실제 essence/item 분기 보존 | B×5, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (3) negation/absence syntactic pattern |
| 3436 | cycle 556: cycle 502-555 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 3484 | cycle 557: 2 defaults 0건 | A×2 | negation/absence syntactic pattern |
| 3497 | cycle 557: 정합성 가드 — production callsite 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3511 | cycle 557: body clampRatio + headline 분기 보존 | B×5 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3524 | cycle 557: cycle 502-556 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 3574 | cycle 559: getEnemyTacticalProfile signature에서 stats default 0건 | A×1 | negation/absence syntactic pattern |
| 3583 | cycle 559: 정합성 가드 — production + test callsite 보존 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3594 | cycle 559: cycle 270 stats dead notation 보존 | B×3 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3608 | cycle 559: cycle 502-558 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 3656 | cycle 561: buildEventPackage signature에서 context default 0건 | A×1 | negation/absence syntactic pattern |
| 3665 | cycle 561: buildProceduralOutcome signature에서 outer + inner defaults 0건 | A×2 | negation/absence syntactic pattern |
| 3676 | cycle 561: 정합성 가드 — 4 callsite 보존 | B×5 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3702 | cycle 561: cycle 502-560 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 3754 | cycle 562: sanitizeQuickSlots signature에서 2 defaults 0건 | A×2 | negation/absence syntactic pattern |
| 3765 | cycle 562: 정합성 가드 — 2 production callsite 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3781 | cycle 562: body defensive guards 보존 | B×3 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3792 | cycle 562: cycle 502-561 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 3838 | cycle 564: withVariant signature에서 overrides default 0건 | A×1 | negation/absence syntactic pattern |
| 3847 | cycle 564: 정합성 가드 — 10 internal callsite 보존 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 3859 | cycle 564: body variant ternary + nullish coalescing 보존 | B×4 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3872 | cycle 564: cycle 502-563 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 3922 | cycle 566: start action signature에서 3 defaults 0건 | A×3 | negation/absence syntactic pattern |
| 3935 | cycle 566: 정합성 가드 — IntroScreen callsite 보존 | B×5 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 3958 | cycle 566: body Array.isArray defensive guard 보존 | B×5 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 3984 | cycle 566: cycle 502-565 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4031 | cycle 568: ClassIcon signature에서 2 defaults 0건 | A×2 | negation/absence syntactic pattern |
| 4042 | cycle 568: 정합성 가드 — ClassIcon callsite와 canonical 선택 portrait 보존 | B×6 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4064 | cycle 568: body TIER_COLORS nullish fallback 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4076 | cycle 568: cycle 502-567 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4131 | slice 37: Dashboard signature에서 삭제된 화면 분기와 불필요 defaults 0건 | A×6 | negation/absence syntactic pattern |
| 4148 | release core: dead inventory spotlight props are absent | A×1 | negation/absence syntactic pattern |
| 4154 | slice 37: MobileGameLayout은 단일 Dashboard 화면 계약만 전달한다 | B×2, A×2 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern |
| 4167 | cycle 572: cycle 502-571 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4216 | cycle 574: SmartInventory signature에서 3 defaults 0건 | A×3 | negation/absence syntactic pattern |
| 4229 | release core: Dashboard passes only live SmartInventory props | B×2, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern / (3) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4248 | release core: SmartInventory dead spotlight body is absent | A×1 | negation/absence syntactic pattern |
| 4254 | cycle 574: cycle 502-573 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4300 | cycle 575: CombatPanel signature에서 3 defaults 0건 | A×3 | negation/absence syntactic pattern |
| 4313 | cycle 575: 정합성 가드 — ControlPanel callsite 보존 | B×2 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4326 | cycle 575: body enemy 분기 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4333 | cycle 575: cycle 502-574 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4384 | cycle 576: TerminalView signature에서 logs default 0건 | A×1 | negation/absence syntactic pattern |
| 4393 | cycle 576: 정합성 가드 — MobileGameLayout callsite 보존 | B×2 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4405 | cycle 576: cycle 502-575 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4456 | cycle 578: 3 inventory defaults 0건 | A×1 | negation/absence syntactic pattern |
| 4468 | cycle 578: 정합성 가드 — 다수 callsite 보존 | B×5 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4486 | cycle 578: body defensive guards 보존 | A-support×1, A×2 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) negation/absence syntactic pattern |
| 4495 | cycle 578: cycle 502-577 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4547 | cycle 579: getMoveRecommendations signature에서 maps default 0건 | A×1 | negation/absence syntactic pattern |
| 4556 | cycle 579: 정합성 가드 — 다수 callsite 보존 | B×2, A-support×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 4574 | cycle 579: cycle 502-578 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4617 | cycle 581: QuickSlot signature에서 slots default 0건 | A×1 | negation/absence syntactic pattern |
| 4626 | cycle 581: 정합성 가드 — TerminalView callsite 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4640 | cycle 581: cycle 502-580 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4685 | cycle 582: ClassCard signature에서 disabled default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4695 | cycle 582: 정합성 가드 — JobChangePanel callsite 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4707 | cycle 582: cycle 502-581 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4752 | cycle 584: JobChangePanel signature에서 onOpenArchiveConsole default 0건 | A×1 | negation/absence syntactic pattern |
| 4761 | cycle 584: 정합성 가드 — ControlPanel callsite 보존 | B×2 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 4774 | cycle 584: cycle 502-583 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4833 | cycle 585: ItemIcon signature에서 size default 0건 | A×1 | negation/absence syntactic pattern |
| 4842 | cycle 585: 3 reachable defaults 보존 (partial cleanup) | B×3, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (3) negation/absence syntactic pattern |
| 4861 | cycle 585: 정합성 가드 — sample callsites 보존 | B×2, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern |
| 4877 | cycle 585: cycle 502-584 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4927 | cycle 587: ControlPanel signature에서 3 defaults 0건 | A×3 | negation/absence syntactic pattern |
| 4937 | cycle 587: 정합성 가드 — 2 MobileGameLayout callsite 보존 | B×4 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 4952 | cycle 587: cycle 502-586 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 4997 | cycle 588: CraftingPanel signature에서 onOpenArchiveConsole default 0건 | A×1 | negation/absence syntactic pattern |
| 5006 | cycle 588: 정합성 가드 — ControlPanel callsite 보존 | B×2 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 5018 | cycle 588: cycle 502-587 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 5068 | cycle 591: addCombatDigestLogs signature에서 5 defaults 0건 | A×5 | negation/absence syntactic pattern |
| 5080 | cycle 591: 정합성 가드 — combatVictory callsite 보존 | B×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 5095 | cycle 591: body summaryParts / MSG.COMBAT_DIGEST 처리 보존 | B×4 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 5112 | cycle 591: cycle 502-590 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 5165 | cycle 592: handleVictoryOutcome signature에서 2 defaults 0건 | A×2 | negation/absence syntactic pattern |
| 5176 | cycle 592: 정합성 가드 — reducer transaction callsite 보존 | B×1, A-support×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 5195 | cycle 592: body CombatEngine.handleVictory liveConfig 전달 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 5201 | cycle 592: cycle 502-591 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 5253 | cycle 593: window.advanceTime 정의 제거 | A×1 | negation/absence syntactic pattern |
| 5259 | cycle 593: delete window.advanceTime cleanup도 paired removal | A×1 | negation/absence syntactic pattern |
| 5265 | cycle 593: cycle 329 dead methods 회귀 가드 | A×3 | negation/absence syntactic pattern |
| 5275 | cycle 593: active methods 보존 (smoke/perf 스크립트 사용) | B×4 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 5283 | cycle 593: cycle 502-592 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 5331 | cycle 594: vite-env.d.ts Window interface에서 advanceTime 타입 0건 | A×1 | negation/absence syntactic pattern |
| 5345 | cycle 594: cycle 593 정의 제거 보존 | A×1 | negation/absence syntactic pattern |
| 5391 | cycle 595 후속: claimSeasonReward는 보상 식별자인 tier만 전달한다 | B×1, A×1 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) negation/absence syntactic pattern |
| 5399 | cycle 595 후속: SeasonPassPanel도 tier만 전달한다 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 5405 | cycle 595 후속: 성공 안내는 reducer의 실제 지급 결과에서만 생성한다 | B×3, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern / (3) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 5425 | cycle 595: cycle 502-594 회귀 가드 — default/dead 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 5471 | cycle 596: getCodexProgress signature에서 2 defaults 0건 | A×2 | negation/absence syntactic pattern |
| 5482 | cycle 596: getChainEventForLoc signature에서 progress default 0건 | A×1 | negation/absence syntactic pattern |
| 5488 | cycle 596: 정합성 가드 — production + test callsite 보존 | B×5 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 5507 | cycle 596: cycle 502-595 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 5552 | cycle 598: getTraitFeaturedItems signature에서 3 defaults 0건 | A×3 | negation/absence syntactic pattern |
| 5565 | cycle 598: 정합성 가드 — 2 callsite 보존 | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 5584 | cycle 598: body (items \|\| []) defensive guard + sort 보존 | B×2, A×2 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime / (3) negation/absence syntactic pattern |
| 5599 | cycle 598: cycle 502-597 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 5646 | cycle 599: getMapPacingProfile signature에서 mapData default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 5656 | cycle 599: 정합성 가드 — 4 callsite 보존 | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 5672 | cycle 599: body !mapData guard 보존 (undefined 안전) | B×3 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 5681 | cycle 599: cycle 502-598 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |

### `tests/cycle-600-699.test.js`

| 라인 | 테스트 이름 | 클래스 (건수) | 근거 |
|---:|---|---|---|
| 48 | cycle 601: performSynthesis signature에서 2 defaults 0건 | A×2 | negation/absence syntactic pattern |
| 59 | cycle 601: 정합성 가드 — reducer deterministic synthesis callsite 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 65 | cycle 601: cycle 502-600 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 118 | cycle 603: summarizeHistory signature에서 history default 0건 | A×1 | negation/absence syntactic pattern |
| 127 | cycle 603: getRecentEventSet signature에서 history default 0건 | A×1 | negation/absence syntactic pattern |
| 136 | cycle 603: limit defaults 보존 (reachable, partial cleanup) | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 151 | cycle 603: body Array.isArray guard 보존 (undefined 안전) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 157 | cycle 603: cycle 502-602 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 208 | cycle 605: seedEnhanceScenario signature에서 4 defaults 0건 | A×4 | negation/absence syntactic pattern |
| 223 | cycle 605: 정합성 가드 — scripts/smoke-gameplay 3 callsite 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 229 | cycle 605: body preservedInventory / seededMaterials 처리 보존 | B×2 | (1) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 237 | cycle 605: cycle 502-604 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 285 | cycle 606: generateEvent signature에서 3 defaults 0건 | A×3 | negation/absence syntactic pattern |
| 298 | cycle 606: 정합성 가드 — exploreActions callsite 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 305 | cycle 606: body isMockRuntime / pickFallbackEvent 보존 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 312 | cycle 606: cycle 502-605 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 356 | cycle 607: uniqueList signature에서 values default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 364 | cycle 607: 정합성 가드 — internal callsite 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 370 | cycle 607: body new Set / filter 처리 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 376 | cycle 607: cycle 502-606 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 423 | cycle 608: applyName signature에서 dismissKeyboard default 0건 | A×1 | negation/absence syntactic pattern |
| 432 | cycle 608: 정합성 가드 — 2 callsite 명시 (false/true) | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 442 | cycle 608: cycle 502-607 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 487 | cycle 611: createRandomMobileName signature에서 rng default 0건 | A×1 | negation/absence syntactic pattern |
| 493 | cycle 611: 정합성 가드 — IntroScreen 2 callsite Math.random 명시 추가 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 501 | cycle 611: test callsite 보존 (deterministic rng) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 507 | cycle 611: cycle 502-610 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 554 | cycle 612: getRunBuildProfile signature에서 stats default 0건 | A×1 | negation/absence syntactic pattern |
| 563 | cycle 612: 정합성 가드 — caller가 계산된 stats 또는 명시 fallback 전달 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 573 | cycle 612: cycle 502-611 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 617 | cycle 615: sanitizeValue signature에서 depth default 0건 | A×1 | negation/absence syntactic pattern |
| 626 | cycle 615: 정합성 가드 — top-level caller 0 명시 추가 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 633 | cycle 615: body recursion (depth + 1) 보존 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 644 | cycle 615: cycle 502-614 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 690 | cycle 616: safeText signature에서 fallback default 0건 | A×1 | negation/absence syntactic pattern |
| 699 | cycle 616: 정합성 가드 — active callsite는 fallback을 명시하고 dead spotlight 호출은 제거 | B×2, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 709 | cycle 616: cycle 502-615 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 757 | cycle 617: safeList signature에서 fallback default 0건 | A×1 | negation/absence syntactic pattern |
| 766 | cycle 617: 정합성 가드 — active item caller는 fallback을 명시하고 dead spotlight 호출은 제거 | B×1, A×1 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) negation/absence syntactic pattern |
| 774 | cycle 617: '[choice]' caller (currentEvent.choices) 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 780 | cycle 617: cycle 502-616 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 821 | cycle 618: getProtocolWeekKey signature에서 date default 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 829 | cycle 618: 정합성 가드 — caller new Date() 명시 추가 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 836 | cycle 618: cycle 502-617 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 882 | cycle 619: getToneKey signature에서 slot default 'weapon' 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 891 | cycle 619: 6 callsite slot 명시 보존 | B×4 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 900 | cycle 619: cycle 502-618 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 948 | cycle 621 (A2 이관): 델타 포맷 헬퍼 signature에 default '' 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 956 | cycle 621 (A2 이관): 접미사는 단일 맵에서만 결정된다 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 964 | cycle 621: cycle 502-620 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1007 | cycle 622: trackCall signature에서 callType default 'ai' 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1015 | cycle 622: aiService callsite trackLabel 인자 보존 (cycle 539) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1022 | cycle 622: trackCall body slow-response 처리 보존 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1030 | cycle 622: cycle 502-621 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1073 | cycle 623: countLowHpWins signature에서 threshold default 0.2 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1082 | cycle 623: 3 callsite threshold 명시 보존 | B×2 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1092 | cycle 623: countLowHpWins body recentBattles filter 보존 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1100 | cycle 623: cycle 502-622 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1148 | cycle 624: handleVictory signature에서 passiveBonus/liveConfig defaults 0건 | A×2, B×1 | (1) negation/absence syntactic pattern / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1159 | cycle 624: production callsite 4 args 명시 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1165 | cycle 624: handleVictory body liveConfig/passiveBonus 처리 보존 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1175 | cycle 624: cycle 502-623 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1217 | cycle 625: generateStory signature에서 uid default 'anonymous' 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1225 | cycle 625: useGameEngine generateStory callsite uid 명시 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1231 | cycle 625: generateStory body callProxy uid 처리 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1238 | cycle 625: cycle 502-624 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1290 | cycle 626: renderActionButton signature outer defaults 0건 | A×2 | negation/absence syntactic pattern |
| 1298 | cycle 626: renderActionButton signature 파라미터 보존 (default 없이) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1307 | cycle 626: 모든 callsite가 (button, '', {})를 명시 | A-support×1, B×1 | (1) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1315 | cycle 626: body extraClass / hideLabel 처리 보존 | B×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1323 | cycle 626: cycle 502-625 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1366 | cycle 627: COMBAT_ATTACK_DETAIL signature에서 tags default [] 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1376 | cycle 627: CombatEngine callsite 5 args 명시 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1383 | cycle 627: COMBAT_ATTACK_DETAIL body tags.length / join 처리 보존 | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1389 | cycle 627: cycle 502-626 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1436 | cycle 628: commitExploreOutcome signature에서 transformPlayer default null 0건 | A×1, B×2 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime / (3) positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1455 | cycle 628: 7 callsite null 명시 추가 (2026-07: 다수 callsite가 mapData 3번째 인자 추가로 갱신) | B×3, A-support×2 | (1) positive check on a call/value/lookup/template/class that is exercised at runtime / (2) vacuity/anchor-found guard (index or match-count bound), not itself a behaviour claim |
| 1485 | cycle 628: combat 2-arg callsite 보존 (line 168) | B×1 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1493 | cycle 628: body transformPlayer function 처리 보존 | B×1 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1499 | cycle 628: cycle 502-627 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |
| 1541 | cycle 632: getTraitItemResonance signature에서 player default null 0건 | A×1, B×1 | (1) negation/absence syntactic pattern / (2) hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1550 | cycle 632: 3 callsite 명시 보존 | B×3 | positive check on a call/value/lookup/template/class that is exercised at runtime |
| 1562 | cycle 632: body switch 처리 보존 | B×2 | hand-reviewed: bare identifier/attribute/label that is rendered or invoked at runtime |
| 1571 | cycle 632: cycle 502-631 회귀 가드 — default 청소 시리즈 보존 | A×2 | negation/absence syntactic pattern |

## 8. Wave 12 D4 — class-(c) 39건 재검토 및 삭제 로그

§0-§7이 분류한 class-(c) 39건을 "삭제해도 `tsc --noEmit`이 같은 사실을 더 강하게
재증명하는가"로 재검토했다. 기준은 라벨이 아니라 **살아있는 consumer 존재 여부** —
consumer가 있으면 그 consumer의 타입 체크가 이미 이 가드보다 강한 증거이므로 삭제하고,
consumer가 0건이면 `tsc`가 재증명할 대상이 없으므로 보존한다. 7개 파일에서 39건 중
**36건을 삭제**했다(모두 consumer 확인됨). 나머지 3건(`player-language-readability.test.js`)은
재검토 결과 class-(c) 패턴 자체가 성립하지 않는 것으로 판단해 — 즉 "consumer 0건이라
보존"이 아니라 "애초에 이 트랙이 삭제 대상으로 삼는 '타입 선언 존재 확인' 모양이 아니다"로
정정한다(§3 각주 참조). 아래는 실제로 삭제한 36건의 근거다.

### `tests/boss-cycle.test.js` (5건 전부 삭제)

| 원 테스트 (수정 후 라인) | 삭제한 assertion | consumer |
|---|---|---|
| cycle 328: BossPhase export 제거 (private) | `assert.ok(/interface BossPhase\b/...)` | `src/types/monster.ts:74-75,109-110` `phase2?/phase3?: BossPhase` 필드 |
| cycle 328: phase2 / phase3 필드 타입 보존 (테스트 전체 삭제) | `phase2\?:\s*BossPhase` / `phase3\?:\s*BossPhase` | 위와 동일 + `CombatEngine.enemyAI.ts`의 `.threshold`/`.name` 광범위 접근 |
| cycle 328: monster.ts active export 유지 (테스트 전체 삭제) | `export interface MonsterBase` / `export type Monster` | `MonsterBase`: `src/utils/exploreUtils.ts` import; `Monster`: src/ 37개 파일 |

### `tests/cycle-200-299.test.js` (16건 전부 삭제)

| 원 테스트 | 삭제한 assertion | consumer |
|---|---|---|
| cycle 280: Stats 타입에서 comboCount 제거 | `statsBlockMatch` 발견 확인 | `src/types/player.ts:531` `stats?: PlayerStats;` |
| cycle 281: PlayerMeta에서 totalPrestigeAtk 제거 | `metaBlock` 발견 확인 | `src/types/player.ts:545` `meta?: PlayerMeta;` |
| cycle 281: PlayerMeta에서 totalPrestigeHp/Mp 제거 | `metaBlock` 발견 확인 (중복) | 위와 동일 |
| cycle 281: PlayerMeta active 필드 유지 | `metaBlock` 발견 확인 (중복) | 위와 동일 |
| cycle 284: ItemType은 string 단순 alias가 아니다 | `union` 발견 확인 | `src/types/item.ts:33` `type?: ItemType;` + ShopPanel/CraftingPanel/useGameTestApi 등 9개 파일 |
| cycle 295: 4 type 정의 자체는 유지 (테스트 전체 삭제) | AffinityTier/AffinityBonus/OutfitAffinity/ItemLike 존재 확인 4건 | `src/utils/jobOutfitAffinity.ts` 내부 전원 실사용(파라미터/상수/반환형) |
| cycle 298: monster.ts BossMonster export 제거 | `interface BossMonster` 정의 확인 | `src/types/monster.ts:113` `Monster = MonsterBase \| BossMonster` |
| cycle 298: Item / Monster 유니온 정의 유지 (테스트 전체 삭제) | `export type Item =` / `export type Monster =` | Item: 71개 파일, Monster: 37개 파일 |
| cycle 298: ConsumableItem/EquipSlots/MonsterBase 유지 (테스트 전체 삭제) | 3개 export 존재 확인 | ConsumableItem: item.ts의 Item 유니온; EquipSlots: 11개 파일; MonsterBase: exploreUtils.ts |
| cycle 299: Player active export 유지 (테스트 전체 삭제) | `export interface Player` 존재 확인 | src/ 146개 파일 |

### `tests/cycle-300-399.test.js` (9건 전부 삭제)

| 원 테스트 | 삭제한 assertion | consumer |
|---|---|---|
| cycle 301: ActionType type alias는 죽은 채로 남지 않는다 | `export type ActionType = keyof ActionPayloadMap;` 존재 확인 | `src/reducers/gameReducer.ts` `HandlerMap`의 `[K in ActionType]?` (같은 테스트의 다음 assert가 이미 검증) |
| cycle 301: gameReducer.ts GameState export 유지 (테스트 전체 삭제) | `export interface GameState` 존재 확인 | src/ 30개 파일 |
| cycle 301 회귀 가드: reducer type alias 정리 유지 | ActionType 존재 확인 (중복) | 위와 동일 |
| cycle 319: Player interface 필드 보존 | `equip\?:\s*EquipSlots` 확인 | `EquipSlots`: 11개 파일 |
| cycle 346: OutfitAffinity interface totalSlots 필드 제거 | `block` 발견 확인 | jobOutfitAffinity.ts 내부 실사용 |
| cycle 369: ItemBase export → private downgrade | `interface ItemBase` 정의 확인 | `src/types/item.ts:132` `Item = EquipmentItem \| ConsumableItem \| ItemBase` |
| cycle 369: Item/EquipSlots/ConsumableItem export 보존 (테스트 전체 삭제) | 3개 export 존재 확인 | Item: 71개 파일, EquipSlots: 11개 파일, ConsumableItem: item.ts Item 유니온 (cycle 298 가드와 중복) |

### `tests/monsters-cycle.test.js` (3건 전부 삭제)

세 테스트(cycle 283: MonsterBase/BossPhase/BossMonster 각 dead 필드 제거) 모두 "인터페이스
블록을 찾았다"는 앵커 assert(`assert.ok(baseBlock/phaseBlock/bossBlock, ...)`)만 삭제했고,
뒤따르는 필드-부재(class A) assertion은 그대로 둔다. consumer는 위 boss-cycle/cycle-200-299
항목과 동일(MonsterBase → exploreUtils.ts, BossPhase → monster.ts 필드 + CombatEngine.enemyAI.ts,
BossMonster → Monster 유니온).

### `tests/signature-cycle.test.js` (1건 삭제)

cycle 282: Player interface에서 signaturePity 제거 — `playerBlock` 발견 확인(`export interface
Player` 매칭) 삭제. consumer: src/ 146개 파일.

### `tests/skills-cycle.test.js` (2건 삭제, 테스트 전체)

cycle 565: SkillTreePreviewProps typed actions interface 보존 — `SkillActions` interface 존재
+ `actions?: SkillActions` 필드 타입 확인 2건 모두 삭제(테스트 전체). consumer:
`src/components/SkillTreePreview.tsx` 내부(line 19 선언 → line 27 필드 타입, private type).

### 보류: `tests/player-language-readability.test.js` (3건, 삭제하지 않음)

이 파일의 readSrc 스코프 77개 assertion(§0 기준 — `MSG.*`/`getFirstVisitReward` 실호출
기반 2개 테스트는 스코프 밖) 전수를 재검토했다. 나머지 6개 파일의 class-(c)는 예외 없이
"인터페이스/타입 선언이 소스에 존재한다"는 모양이었지만, 이 파일에는 그런 패턴이 전혀
없다 — 모든 assertion이 실제 렌더되는/네게이션되는 한국어 UI 문구·testid·JSX 속성
검사다. 가장 근접한 후보인 `messages.ts`의 `COMBAT_CHAOS_SKILL: (name: string) => ...`
정규식(타입 표기 `(name: string)`을 문자 그대로 포함)조차, 검사의 실질은 런타임에
호출되는 메시지 템플릿 문자열이라 class-B(행동 전환 대상)에 더 부합하고, 이마저 1건뿐이라
3건에 못 미친다. **삭제 기준을 충족하는 candidate가 없어 아무것도 지우지 않았다** — 원
분류표의 C=3은 이 트랙에서 정정 대상으로 보고하며(§3 각주), 정확한 A/B 재배분은 이
트랙의 스코프(삭제 여부 판단) 밖이라 손대지 않았다.
