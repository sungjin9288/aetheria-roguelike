# S5 중후반 대표 fixture 검증

## Endgame 실제 UI 경로

`node --import tsx output/s5-endgame-direct.ts` 최종 실행60222 exit0, `/tmp/aetheria-s5-endgame-settled.log`. 별도 Chromium context/390×844/dev4430의 기존 `true-ending-journey` QA fixture를 사용했다. Fresh 캐릭터·production save는 건드리지 않았다.

실행 순서: 마왕 전투 → 실제 공격 → 원시의 신 접근 → 저장/reload → 원시의 신 처치 → 진엔딩 → 저장/reload → 명시적 NEW GAME+ → 저장/reload. 최종 레벨1/prestigeRank4/heart0/endgame receipt 동일, pageError0, 가로overflow0을 확인했다. 네 안정된 화면을 owner가 각각 열었다:

- `output/playwright/s5-endgame-demon-king-settled-390x844.png`: 보스 설명·권장 대응·공격/기술/아이템/도망 버튼 배치.
- `output/playwright/s5-endgame-primal-boss-settled-390x844.png`: 원시의 신17600HP, 3phase 설명, 맹공 준비40%·회복 여지 안내와 행동 버튼이 화면 안에 공존.
- `output/playwright/s5-endgame-ending-settled-390x844.png`: 진엔딩 본문·누적 기록·NEW GAME+ 확정 읽기 가능.
- `output/playwright/s5-endgame-new-game-plus-settled-390x844.png`: 복원 후 모험가Lv1과 출발 가능한 원정 준비.

첫 실행80327은 transaction assertion은 통과했지만 screenshot 일부가 fade-in/overlay 퇴장 도중이었다. 원본 `s5-endgame-*-390x844.png`를 보존하고 시각 PASS에서 제외했다. Capture helper가 유한 animation completion, root/ancestor opacity 및 legendary overlay 제거를 기다리도록 교정한 후 최종 실행했다. Production UI를 수정하지 않았다.

**통제 한계:** 시작 마왕은1HP이고 다음 공격에 seed1/2를 사용했다. 원시의 신은 화면 접근과 reload를 확인한 뒤 기존 QA API로1HP로 낮췄다. 이 검증은 endgame 접근/전환/저장 계약과 화면의 증거이며 Lv75 자연 성장·보스 난이도·17600HP 전투 승리의 증거가 아니다. Duplicate confirmation과 Class Journey/settings/sentinel 보존은 별도 현재 full의 `true-ending-new-game-plus.spec.ts`3개 시나리오가 담당한다.

## 전직·퀘스트·세트 범위

현재 dark full26974의 E2E117 PASS와 아래 source를 대조하고, 해당 실행이 생성한 화면(09-08 15:35–15:37)을 owner가 직접 열었다.

- `tests/e2e/job-change-design.spec.ts`: Lv1 locked preview, 선택과 확정 분리, 실제 모험가→마법사 전환, Class Journey 표시·sequence 보존. `playtest-artifacts/job-change-design/mobile-job-change-{overview,decision}.png`에서 세 후보, 역할 비교, 계보와 명시적 확정 버튼 확인. 스크롤 panel 캡처이지 전체 내용을 한 viewport에 넣었다는 주장이 아니다.
- `tests/e2e/quest-reward.spec.ts`: 수락·수령 중복 입력 정산, 포기 취소/확정, 추천 임무→원정 준비→목적지 이동. `playtest-artifacts/mobile-quest-expedition/quest-board-compact.png`의 추천3개 판단 정보와 `active-bounty-compact.png`의 호수의 신전/보상16EXP24gold/진행0/8을 확인했다. 후자는 element crop이다.
- 세트·1H/2H/shield/focus 장착/교체/저장: `game-completion-equipment-direct-20260908.md`, 추가 대검 적용은 `../art/dark-greatsword-adoption-20260908.md`.

따라서 S5의 **대표 중후반 fixture에서 전직·세트·보스 안내·퀘스트·endgame 접근**은 증거가 있다. 모든143개 임무·18개 직업의 장기간 자연 성장이나 전체 조합 플레이 완료로 확대하지 않는다. S5 fresh 첫레벨업/새장비판단, 실제background/foreground, iPhone foreground/디자인 및 전체 S3/S6 요구사항은 별도 미완료다.

이번 변경은 QA script와 증거 문서뿐이며 native 입력은 바뀌지 않았다. 최신 local package는 dark-greatsword checkpoint, 설치·commit·publish 없음.
