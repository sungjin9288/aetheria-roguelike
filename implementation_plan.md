# Implementation Plan

## Status
- Date: 2026-03-17
- State: Implemented and verified

## Scope
- P0: `lowHpWins` 복구 및 `primaryAction` 실행 연결
- P1: `Dashboard.jsx` 분리 리팩토링
- P2: 성향 공명 UI 보강, 보스 브리핑 한 줄 요약

## Verified Findings
1. `implementation_plan.md`는 기존에 없었고, 이번 점검 기준으로 새로 생성했습니다.
2. `lowHpWins`는 `recentBattles`로 쓰기 경로가 바뀐 뒤 읽기 경로가 그대로 남아 있어 성향/퀘스트 판정에서 0으로 고정될 수 있었습니다.
3. `ControlPanel.jsx`는 추천 강조만 있고 추천 행동을 직접 실행하는 CTA가 없었습니다.
4. `Dashboard.jsx`는 진행/집중/장비/성향 패널 정의까지 한 파일에 들어 있어 분리 우선순위가 높았습니다.
5. `QuestBoardPanel`에는 이미 `getTraitQuestResonance` 배지가 있었고, `SmartInventory`에는 같은 수준의 성향 공명 배지가 없었습니다.

## Implementation Order
1. `recentBattles` 기반 `lowHpWins` 계산 헬퍼 추가
2. 저체력 퀘스트를 threshold 기반으로 동기화
3. 위험 성향 판정에서 새 헬퍼 사용
4. `ControlPanel` 추천 행동 CTA 추가
5. `Dashboard` 패널 분리
6. `SmartInventory` 공명 배지 추가
7. `CombatPanel` 보스 브리핑 한 줄 추가

## Outcome
- `lowHpWins`를 더 이상 legacy 카운터에만 의존하지 않고 `recentBattles.hpRatio` 기준으로 계산하도록 복구했습니다.
- `ControlPanel` 추천 행동은 실제 실행 가능한 CTA 버튼으로 연결했습니다.
- `Dashboard.jsx`는 `FocusPanel`, `DashboardPanels`로 분리해 본문 기준 501줄까지 줄였습니다.
- `SmartInventory`에는 성향 공명 배지를, `CombatPanel`에는 보스 전술 한 줄 요약을 추가했습니다.

## Files
- `src/systems/DifficultyManager.js`
- `src/utils/questProgress.js`
- `src/utils/runProfileUtils.js`
- `src/utils/adventureGuideActions.js`
- `src/components/ControlPanel.jsx`
- `src/components/Dashboard.jsx`
- `src/components/dashboard/DashboardPanels.jsx`
- `src/components/dashboard/FocusPanel.jsx`
- `src/components/SmartInventory.jsx`
- `src/components/tabs/CombatPanel.jsx`

## Verification
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `./scripts/local-playtest.sh`
