# OFFLINE-RETURN-01 — 오프라인 첫 귀환 화면 실패

## 실제 재현

검증 build preview4381의 별도 `offline-sep7` 브라우저에서 실제 UI로 신규 생성했다. 390×844, 이름 자동값, state injection/seed override 없이 Playwright context 네트워크만 offline으로 전환했다.

출정→이야기 발생→이번 원정에서 미루기→이동 지도→시작의 마을 선택까지 UI가 반응했다. 하지만 첫 귀환에서 전역 오류 화면 `게임 화면을 불러오지 못했습니다`가 나타났다. `output/playwright/completion-20260907/offline-return-390x844.png`는 파일명과 달리 **귀환 성공 캡처가 아니라 실패 증거**다. Owner가 직접 열어 확인했다.

콘솔의 결정적 오류는 `TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:4381/assets/ExpeditionDebriefCard-shIHwDJd.js`. `src/components/app/GameRoot.tsx`는 해당 카드를 React.lazy로 첫 표시 때 불러오며 Suspense만 감싼다. 연결이 없으면 chunk 거부가 전역 error boundary에 도달한다. 로컬 네트워크가 끊겨도 이미 시작한 원정에서 안전 귀환 UI를 사용할 수 있어야 하므로 Important로 기록한다.

## 연결 복구 관찰

### 수정 후 일반 경로 재검증

별도 `offline-real-sep7` 프로필, 검증 bundle preview4391의 query 없는 일반 URL에서 신규 생성했다. `e2e/deviceQa` 플래그 및 seed/state 주입 없이 실제 UI action만 사용했다. context offline 후 출정→탐험1→이야기 미루기→마을귀환이 정상 표시됐다.

일반 로컬 저장 `aetheria.game.snapshot.v2.primary`의 envelope/payload를 읽기만 하여 revision5, 마을, summaryId `expedition-1788754544434-1`, HP178, 골드300을 확인했다. 연결 복구·reload 후 revision7에서도 같은 ID/위치/HP/골드를 유지했다. Width/scrollWidth390/390.

Owner는 `output/playwright/completion-20260907/offline-real-return.png`와 `offline-real-restored.png`를 각각 직접 열어 귀환 카드/CTA/기록을 확인했다. 전투0/탐험1, EXP25/골드100, 가장 위험했던 순간178·100%. 오프라인 네트워크 실패 경고는 남지만 수정 전 동적 귀환chunk 예외는 재발하지 않았다.

실제 서버 document를 별도로 읽지 않았으므로 cloud authority 전체/다른기기복구/앱삭제복구를 증명하지 않는다. 일반 저장 경로의 warm-offline 귀환 및 연결 복구 후 reload 증거다. Browser close 완료 후 owned preview93957 Ctrl-C exit130. 사용자 기존 저장 삭제나 설치 없음. 아래는 수정 전 실패 관찰을 보존한 것이다.

setOffline(false) 뒤 reload하면 저장 복원/서버 동기화 안내와 고요한 숲·골드300·HP178/178·EXP25/200·이동 지도 상태로 돌아왔다. `offline-reconnected-390x844.png`도 직접 확인했다. 귀환 직전 상태가 복원된 것이며 귀환 정산 보존 PASS가 아니다. lazy render 실패, save debounce와 서버 동기화 중 무엇이 snapshot 시점에 영향을 줬는지는 추가 조사 대상이다. 이 관찰만으로 cloud conflict 결함이라고 단정하지 않는다.

Console은 ERR_INTERNET_DISCONNECTED22개/ERR_FAILED11개 및 동적 import TypeError1개를 포함한다. Firestore 재연결 경고도 존재한다. 로그 `.playwright-cli/console-2026-09-07T04-03-47-758Z.log`의 인증 query는 문서에 복사하지 않는다.

브라우저는 온라인으로 돌린 뒤 close 완료. 사용자 저장 삭제·코드 수정 없음. E2E handle69777의 실행 source를 바꾸지 않기 위해 구현은 해당 실행 종료 후 한다.

## 다음 수정과 검증

### 구현과 검증 결과

`GameRoot.tsx`의 ExpeditionDebriefCard만 일반 import로 변경했다. 이미 부팅한 게임의 첫 귀환이 추가 JS chunk 다운로드를 요구하지 않도록 하며, 다른 선택 화면의 lazy boundary와 gameplay/save 계산은 바꾸지 않았다.

- 새 `tests/e2e/offline-return.spec.ts` RED59865: 첫 귀환 카드 미표시,8초 timeout. 원본 실패 캡처 `output/playwright/completion-20260907/offline-return-red.png` 보존.
- 첫 수정 후 offline 카드 표시 자체는 통과했으나 reload는 실패했다. 원인은 테스트의 `e2e=1`이 저장을 비활성화한다는 점이며, 이 실패를 production 복원 결함으로 분류하지 않는다. 기존 `deviceQa=toss-first-five`의 격리 저장을 사용하고 저장된 summary ID를 기다리도록 바로잡았다. 생성/선택/귀환은 계속 실제 UI action이며 state injection은 없다.
- GREEN77443:1/1. tsc/lint61329 exit0. 관련 unit13/13.
- 최초 build93900과 integration39150은 같은 dist를 동시에 사용했으므로 결정적 결합 증빙으로 채택하지 않았다. 순차 재실행80012 exit0: build guard PASS, 귀환/직업기록/offline E2E5/5(33.4초). 로그 `/tmp/aetheria-offline-return-{build,integration}-sequential-0907.log`.
- 최초 캡처는 등장 애니메이션 중간이어서 시각 승인에 사용하지 않았다. opacity1 이후 CSS scale 캡처로 변경했고 최종 `offline-return-regression.png`를 직접 열어 확인했다.390×844 카드와 CTA가 화면 안에 보인다.
- 이 결과는 warm-boot offline 귀환 및 isolated QA snapshot reload만 증명한다. Cold offline boot, 실제 Firebase 재연결 정합성, 모든 다른 lazy 화면은 미검증이다.
- 새 source가 추가되었으므로 progression source evidence 및 full/native 검증은 후속 갱신 대상이다. 이전116개E2E는 이 수정 전 증거다. Art4건과 이미지보정 승인 대기는 유지한다. 모든 위 process는 terminal; commit/install/publish 없음.

첫 귀환이라는 core flow가 런타임 chunk 다운로드에 의존하지 않도록 최소 설계를 검토한다. RED는 warm boot 후 offline 첫 귀환에서 카드·마을·summary가 남고 전역 오류가 없는 실제 브라우저 경로로 고정한다. 장기적으로 다른 core transition의 lazy boundary도 같은 위험이 있는지 확인한다. 전체 eager 전환이나 catch로 오류를 숨기는 식의 변경은 하지 않는다. 변경 후 같은 재현, reload, build budget, focused/full 검증을 수행한다.
