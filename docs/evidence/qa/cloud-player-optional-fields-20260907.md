# Cloud save optional-field regression

## 재현과 원인

새로운 격리 Playwright 세션에서 실제 신규 생성 버튼을 눌렀다. Firestore `setDoc`이 `player.deferredEventChainSteps`의 undefined 값으로 실패했다. Optional 원정 필드는 reducer의 정상 초기화/복원 과정에서 undefined가 될 수 있지만 useFirebaseSync는 live player를 그대로 spread하여 전송했다. 같은 문제가 adventureRelicBonuses에도 적용된다. Quota permission warning은 별도 기존 경로이며 이 수정으로 해결됐다고 주장하지 않는다.

## 수정

`buildCloudPlayerSnapshot`은 위 두 필드가 비어 있으면 cloud payload에서만 null로 표현한다. 값이 있는 경우 보존하고 live player를 변경하지 않는다. merge:true에서 필드를 생략하면 서버의 예전 값이 남을 수 있으므로 명시적 null을 쓴다. LOAD_DATA의 기존 normalization은 null을 빈 원정 상태로 복원한다. Gameplay 수치·local save schema·cloud revision 판정·Firestore rules는 변경하지 않았다.

## 검증

- 신규 API 없는 RED exit1 후 구현. `cloud-player-snapshot`, `event-chain-deferral`, `adventure-relic-lifetime` focused51/51 PASS.
- `npx tsc --noEmit` PASS, `npm run lint` PASS, `git diff --check` PASS.
- 동일 격리 세션의 실제 UI로 reload→첫 출정→탐험→이야기 미루기→이동→마을 귀환. QA fixture나 reducer 강제 주입 없이 수행했다.
- `getDocFromServer`로 해당 테스트 세션의 서버 저장을 직접 읽음:
  - 고요한 숲 revision5: deferred=null, relicBonuses=null.
  - 미루기 후 revision7: deferred={lost_wizard:0}, relicBonuses=null.
  - 시작의 마을 귀환 revision9: deferred=null, relicBonuses=null.
- 최초 서버조회 보조코드는 Vite query 없는 Firebase 모듈을 중복 로드해 doc type mismatch로 실패했다. 실제 앱 import의 동일 query 모듈을 사용한 조회가 위 결과를 반환했다. 이 실패는 저장 실패가 아니라 검수 코드 모듈 불일치다.
- `output/playwright/completion-20260907/cloud-player-{deferred,returned}-390x844.png` 두 장을 owner가 직접 확인했다. 귀환 시 viewport/scrollWidth390/390. 전투0/탐험1/원정귀환 확인이며 첫 전투나 전체 fresh 성장 완료로 확대하지 않는다.
- Develop-web-game client71052 exit0, `cloud-player-client/shot-0.png` owner 확인. 해당 추가 캡처는 boot loading 화면이므로 게임 진입 성공 증거로 쓰지 않는다.

## 상태와 한계

직접 플레이로 생성된 별도 익명 테스트 저장에 정상 autosave가 수행됐고 서버 읽기로 확인했다. 기존 사용자 저장은 열거나 덮어쓰지 않았으며 테스트 저장을 삭제하지 않았다. UID는 문서에 기록하지 않는다. Browser fresh-owner-sep7과 task-owned dev16342는 종료했다.

전체 Goal의 full/native gate는 미완료다. 별도 진행 중인 대지의 심판 아트 통합2건과 source evidence 갱신이 남아 있어 v5의 이전 PASS를 이번 저장 변경의 PASS로 재사용하지 않는다. 배포·앱 설치·commit/push 없음.
