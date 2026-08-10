# Task 10 Class Journey UI Evidence

Date: 2026-08-10 KST

## Player outcome

- 원정 귀환 화면은 해당 원정의 직업, 대표 지역과 보스, 선택한 스킬 분기, 새 시그니처 장비를 story와 다음 행동보다 먼저 보여 준다.
- 전직 화면은 선택한 직업의 누적 발자국을 대표 기술 바로 아래에서 보여 주며, 기록이 없는 직업은 첫 원정을 권한다.
- 이 요약은 `ClassJourneyRecord`와 `ExpeditionSummary`를 읽기만 한다. 닫기, 다시 열기, 직업 선택 전환은 ledger sequence를 바꾸지 않는다.
- 기록의 독립 누적 배열을 하나의 원정처럼 합치지 않는다. 정확히 일치하는 summary만 `대표 원정`, 직업 누적 기록은 `남긴 발자국`으로 표시한다.
- 대표 원정은 그 summary에 저장된 분기를 사용한다. 누적 기록의 최신 분기가 달라도 과거 선택을 현재 원정에 잘못 붙이지 않는다.

## RED to GREEN

- RED: 두 focused E2E spec에 journey copy와 sequence contract를 먼저 추가했다. 기존 구현은 `class-journey-summary` selector가 없어 첫 귀환 시나리오에서 실패했고, 기존 milestone과 패배 흐름은 그대로 통과했다.
- GREEN: `npx playwright test tests/e2e/expedition-debrief.spec.ts tests/e2e/job-change-design.spec.ts --reporter=list` → `8/8` PASS, 57.9s.
- Independent review에서 찾은 stale boss 결합, legacy job 오귀속, 누락 category 추천, exact 분기 오귀속, 비현실적인 직업·장비·vitals fixture를 모두 수정했다. 누적 record의 `기절 배시`와 대표 summary의 `강화 배시`를 의도적으로 다르게 seed해 두 화면의 authority 차이를 회귀로 고정했다.

## Full verification

- Independent review APPROVE 뒤 최종 bytes에서 `npm run verify:full`을 다시 실행해 type-check, lint, unit `3726/3726`, build guard, desktop smoke, mobile smoke, E2E shard `49/49 + 45/45` PASS를 확인했다.
- Desktop smoke 종료 중 기존 `browser.close timeout` 안내가 한 번 있었지만 mobile smoke와 두 E2E shard가 이어서 완주했다.
- `npm run mobile:doctor` → toolchain PASS. Apple Distribution identity와 Android release keystore는 기존 environment blocker로 유지.
- `npm run cap:sync` → Android/iOS/Web sync PASS, `git status --short -- android ios` output 없음.
- `git diff --check` → PASS.

## Mobile visual evidence

- `task-10-expedition-debrief-mobile.png`
  - SHA-256 `837e240f74b89eaf688bbbe3acbfd1aaabf9a3efafaa1f95c024c9919867e003`
  - 390×844 CSS viewport의 debrief element capture. Production class-vitals 계산을 거친 전사 Lv20이 고요한 숲에서 출발해 신성한 호수의 고대 호수의 수호신을 만난 흐름, 대표 원정의 강화 배시, 성검 에테르니아, primary action이 한 scroll flow에서 읽힌다.
- `task-10-job-journey-mobile.png`
  - SHA-256 `d141d5725e18e059745ccfd48477b075b467eb0efc3699b356903b30d336ec34`
  - 390×844 CSS viewport의 selected-job decision capture. 누적 최신 발견인 기절 배시를 포함한 발자국 3줄, 다음 계보, 설명, 48px 이상 확정 CTA가 가로 clipping 없이 보인다.

두 캡처는 original size로 직접 확인했다. 문구 겹침, 내부 horizontal overflow, 잘린 primary action은 발견되지 않았다. 새 native archive는 만들지 않았으며 최신 native artifact는 변경하지 않았다.
