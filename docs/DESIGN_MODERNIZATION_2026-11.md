# 디자인 고도화 — "올드하다"에서 벗어나기 (2026-11-08)

베이스: `main` `2c7bf099`(브랜치 `docs/playtest-kit`).
요청: 소유자 "게임 디자인이나 진행방식이 너무 올드해 — 다른 게임들의 트렌디한 디자인을 차용해오자."
방법: `reverse-engineering` 스킬(디자인 벤치마크 · 기능 분석) + `design-critique` + 공개 자료 조사 두 갈래(진행 구조 · 화면 연출). 타사 그림 · 문구 · 이름 · 색은 가져오지 않고 **원리와 측정값만** 가져온다.

---

## 0. 결론

"올드함"은 두 겹이다. 고치는 비용과 소유자 결정의 무게가 달라서 나눠 진행한다.

| 겹 | 원인 | 고치는 곳 | 규칙 · 난수 · 세이브 | 소유자 결정 |
|---|---|---|---|---|
| **A. 화면 · 연출** | 무대가 텍스트 로그다. 공격 · 치명타 · 처치 · 전리품이 모두 같은 무게의 글줄로 보인다 | 컴포넌트 · CSS · 표시 계층 | 바꾸지 않는다 — 자연 플레이 바이트 동일 | 작음(Q1 ~ Q3) |
| **B. 진행 구조** | 탐험 단추 반복 → 무작위 결과 → 공격 반복. 중후반 행동의 70%가 고를 것 없는 입력이고 정지점이 약하다 | 게임 규칙 | 바꾼다 — 측정 · 짝 비교 필요 | 큼(Q4 ~ Q8, 기존 결정 D1 · Wave 127과 부딪힌다) |

**권고:** A를 먼저, 그중 **전투 무대(A1 + A3 + A4)를 한 PR로 시범 적용**해 iPhone에서 체감을 확인한다. B는 사람 플레이테스트(세션 1)를 본 뒤 Q4 ~ Q8을 정한다. 이유는 셋이다.
1. 소유자가 가장 자주 보는 화면이 전투이고, 거기서 "글줄 피드백"이 가장 크게 드러난다.
2. A는 수치 · 난수를 건드리지 않아 기존 원칙(Wave 53 · 60 · 70 · 88)과 충돌하지 않는다.
3. 이미 있는 자산이 놀고 있다 — 픽셀 아트 1,395장(`public/assets` — 몬스터 · 지역 · 아바타 · 장비 · 유물), 떠오르는 피해 숫자(`DamageNumber.tsx`), 진동(`useHapticFeedback`), 적 다음 행동 예측(`predictEnemyNextAction`), Framer Motion.

---

## 1. 기준선 (관찰, 2026-11-08, 375 × 812, dev 서버)

| 화면 | 위에서 아래로 | 눈이 가는 순서 |
|---|---|---|
| 마을(첫 여정) | 상태 카드 → 안내 로그 3줄 + 이야기 카드 → 원정 준비 카드 → 금빛 "첫 출발" → 이동 → 마을 시설 | 금빛 단추 → 상태 카드 → 로그 |
| 필드(고요한 숲) | 상태 카드 → 지역 머리 + 스크롤 로그(이벤트 · 안내 배지 + 문장) → 원정 임무 카드 → 추천 경로 줄 → 금빛 "탐험" → 도크 4칸 | 금빛 단추 → 로그 문장 |
| 전투(슬라임) | 머리 띠 → 적 카드(초상 약 100px · 이름 · 생명 막대) → "최근 전투" 로그(화면의 약 35%, 실제 내용 2줄) → 생명 · 기력 → 칩 3개(위험 · 권장 대응 · 예상 흐름) → 2 × 2 행동 → 기술 칩 | 금빛 "공격" → 적 초상 → 칩 3개. **내가 준 피해는 13px 글줄 하나** |
| 전투 결과 | 아래 시트: 제목 → 상태 · 추천 → 보상 칩 → 전리품 줄 → 단추 2개. 뒤 로그에 "전리품: 슬라임 젤리"가 세 줄 반복 | 금빛 "전리품 확인" → 보상 칩 |

Lv1 슬라임은 공격 6번(76 생명, 회당 14 ~ 16)이다. 탭마다 바뀌는 것은 로그 두 줄과 막대 하나다.

### 1.1 디자인 평가 (`design-critique`)

- **목표 적합성:** 전투 · 필드 화면의 목표는 "내 행동이 무엇을 일으켰는지 즉시 느끼게 하기"다. 정보는 정확하고 토큰 체계도 단정하지만, 사건의 무게가 시각적으로 구분되지 않아 목표에 못 미친다. 잘 차려입은 MUD로 보이는 이유다.
- **잘한 것:** 에테르 유리 토큰 · 화면당 금빛 주 행동 하나 · 11px 하한 · 44px 터치 — 기반은 현대적이다. 픽셀 아트 초상은 매력적이고 양이 많다.
- **위계 불일치:** 전투에서 가장 큰 면적(로그 카드)이 거의 비어 있고, 가장 중요한 순간(피해 · 치명타 · 처치)은 3순위 밖이다. 떠오르는 피해 숫자는 있지만 화면 중앙 고정(`top-[38%]`)이라 맞은 대상과 붙어 있지 않다.
- **세부:** 칩 문구가 은어에 가깝다("마무리권"). 같은 전리품이 로그에 줄마다 반복된다(결과 카드는 묶는데 로그는 묶지 않는다). 결과 시트의 "전투 결과 · 전투 정리" 머리가 겹친다.
- **트레이드오프:** 텍스트 로그는 접근성 · 기록 · 낮은 아트 비용을 준다. 무대 중심으로 가면 움직임 예산 · 움직임 줄이기 설정 · 화면별 레이아웃 계약(`field-dock-fit` · `mobile-legibility` · `screen-text-clipping`)을 다시 맞춰야 한다.
- **한 가지 권고:** **무대를 화면 중심에 두고(적 · 지역 그림을 크게), 결과는 맞은 자리의 숫자 · 막대 · 반짝임으로 보이고, 로그는 2 ~ 3줄 띠로 내린다.**

---

## 2. 벤치마크 요약

대상: Capybara Go!(텍스트 이벤트 모바일 로그라이트) · Slay the Spire 1 · 2 · Balatro · Hades 1 · II · Vampire Survivors(진행 구조), Archero 2 · Reigns · Smash(Sakurai 칼럼) · Vlambeer(연출 원리). 전체 표와 출처는 부록 A.

| 원리 | 보이는 대상 | 우리 지금 |
|---|---|---|
| 무대가 먼저, 글은 1 ~ 2줄 | Capybara Go(텍스트 RPG인데 위쪽 절반이 걷는 캐릭터 무대) · Reigns · StS | 로그가 무대 |
| 피드백은 맞은 자리에서, 채널을 겹친다(숫자 · 흔들림 · 번쩍임 · 소리 · 진동) | StS · Balatro · Vlambeer | 글줄 + 화면 중앙 숫자 |
| 연출 강도는 사건 크기에 비례하고 상한이 있다 | Sakurai(hitstop) | 모든 사건이 같은 무게 |
| 보상은 순차 공개, 언제든 넘기기 | Archero 2 · StS | 칩 한 번에 표시 |
| 선택지는 같은 크기 카드 2 ~ 3장 + 영향 미리보기 | Capybara Go · Archero 2 · Reigns(영향받는 자원에 점) | 화면마다 모양이 다름 |
| 적 위협은 적 위 아이콘 하나 + 숫자 | StS 의도(intent) — 플레이테스트에서 숫자가 있을 때 더 몰입 | 칩 3개의 문장 |
| 속도 선택권(×1 / ×2 · 넘기기) | Balatro · StS | 없음 |
| 런이 짧은 단위로 끊기고 끝이 분명하다 | VS 15 ~ 30분 · StS 약 30 ~ 45분 · Balatro 8 Ante · Capybara 60일 장 | 53 모델시간, 중간 정지점 약함 |
| 반복 전투는 자동화하거나 결정으로 만든다 | VS · Capybara(자동) / StS(의도로 매 턴 퍼즐) | 중후반 70%가 고를 것 없는 입력 |
| 결정 단위가 "다음 방 · 노드 고르기"이고 보상이 미리 보인다 | StS 지도 · Hades 문 위 보상 · Balatro Blind 건너뛰기 | 탐험 결과가 그냥 무작위 |
| 장마다 보스가 규칙을 비튼다 | Balatro Boss Blind · StS 막 보스 | 회차 규칙 카드(회차 단위)만 |
| 죽음이 이야기를 진행시킨다 | Hades | 사망 화면은 정산 |

---

## 3. 제안

수치는 모두 **시작값**이고 실기기에서 조정한다. 각 제안은 기존 계약을 지킨다: 11px · 44px · 화면당 금빛 하나 · 토큰 색 · 한국어 줄바꿈 · `MSG` 문구 · 추천 문구 없음(Wave 88).

### A. 화면 · 연출 (규칙 · 난수 · 세이브 불변)

#### A1. 전투 무대 (시범 PR의 중심)
- **배치:** 적 초상을 화면 높이 40% 안팎의 무대로 키운다(지역 그림을 흐린 배경으로). "최근 전투" 로그는 최근 1 ~ 2줄 띠로 줄이고 전체는 기존 기록 탭이 맡는다. 생명 막대는 무대 아래에 굵게.
- **맞은 자리 피드백:** 피해 숫자를 적 초상 위에서 띄운다(24 ~ 32px 상승 · 600 ~ 800ms · 마지막 200ms 페이드). 받은 피해는 내 생명 막대 옆에서. 맞는 순간 초상에 흰 번쩍임 80 ~ 120ms.
- **강도 비례:** 치명타는 숫자 1.5배 + 치명타 색 + 2 ~ 4px 흔들림 150 ~ 250ms. 치명타 · 처치 · 보스 페이즈 전환에만 hitstop 60 ~ 100ms. 처치는 초상이 흩어지는 짧은 연출(≤ 400ms).
- **생명 막대 두 층:** 앞 층은 즉시 줄고 뒤 잔상이 200ms 뒤 300 ~ 500ms에 걸쳐 따라 준다.
- **안전:** 번쩍임 초당 3회 이하(WCAG 2.3.1). `prefers-reduced-motion`이면 흔들림 · hitstop을 끄고 숫자만 남긴다. 진동은 기존 `useHapticFeedback` 시점에 맞춘다.
- **판정 경계:** 연출은 표시 계층만 읽는다(리듀서 결과의 차이). 게임 판정 · 난수 · 기록 줄은 바꾸지 않는다 — 기록 줄을 더하면 자연 플레이 드라이버 짝 비교가 깨진다(Wave 111 교훈).

#### A2. 필드 무대
- 상태 카드 아래에 지역 그림 + 주인공 sprite 무대(화면 높이 35 ~ 40%). 로그는 2 ~ 3줄 띠, 이벤트 · 발견은 무대 위 카드로 떠오른다.
- 획득 · 회복 수치는 상태 막대 옆에 `+N`(400ms).
- 초상 · 지역 그림에 2 ~ 3초 주기 숨쉬기(scale 1 → 1.02)와 지역별 미세 입자(움직임 줄이기면 끈다).
- **계약 영향:** 기록 창 최소 높이(D14: 필드 96px · 시설 펼침 56px)와 `field-dock-fit` · `town-facilities-design` e2e를 함께 다시 정한다.

#### A3. 보상 공개
- 경험 · 골드를 0부터 세어 올린다(300 ~ 600ms). 전리품은 80 ~ 150ms 간격으로 하나씩, 등급 색은 테두리에만. 전설만 1초 이상의 빛(기존 전설 획득 알림과 이어진다).
- 한 번 누르면 전부 넘긴다. 입력 보호 350ms는 그대로.
- 접힌 카드(`isSwiftPostCombat` — 한 행동에 끝난 일반 전투)는 연출 없이 그대로 둔다. 연출은 판단할 거리가 있는 승리에만.
- 로그의 같은 전리품 반복은 결과 카드와 같은 `utils/lootSummary.ts`로 묶는다(이미 있는 판정 재사용).

#### A4. 적 의도 아이콘
- 칩 3개(위험 · 권장 대응 · 예상 흐름)를 **적 초상 위 의도 아이콘 + 숫자**(다음 행동 종류 · 예상 한 방)로 바꾼다. 판정은 이미 있는 `predictEnemyNextAction` · `estimateEnemyMaxHit` 하나를 읽는다.
- "권장 대응" 칩은 Wave 88 "반응은 플레이어 몫"과 결이 다르다 — 없앨지는 Q2.

#### A5. 속도 선택
- 설정에 전투 속도 ×1 / ×2. ×1에서 행동당 연출 600ms 이내, 기준 박자는 기존 `ENEMY_TURN_DELAY_MS` 300ms. ×2는 연출 시간만 절반이고 판정은 같다.

#### A6. 선택 화면 하나의 문법
- 유물 선택 · 정찰 3택 · 이벤트 선택지 · 회차 규칙 카드 · 기술 분기를 **같은 크기 카드 2 ~ 3장**(아이콘 · 등급 테두리 · 효과 한 줄 · 대가 한 줄)으로 통일한다.
- 이벤트는 영향받는 자원(생명 · 골드 · 유물 등)에 **점만** 표시하는 미리보기 — 방향 · 크기는 숨긴다. "얻는 방법은 얻은 뒤에만"(Wave 102 · 103)과 부딪히는지가 Q3.

### B. 진행 구조 (소유자 결정 필요 — 플레이테스트 세션 1 뒤)

| # | 제안 | 벤치마크 원리 | 부딪히는 기존 결정 | 크기 |
|---|---|---|---|---|
| B1 | **장(章)과 장 결산:** 지역 묶음 + 장 보스 단위로 회차를 나누고, 장을 넘을 때 결산 화면(이번 장의 처치 · 유물 · 큰 순간)과 자연스러운 정지점을 둔다. 본편 16장 · 구역 보스 · 토벌 의뢰가 이미 뼈대다 | 짧은 단위 · 분명한 끝 | 없음(표시 중심). 53시간 회차 길이 자체는 바꾸지 않는다 | M |
| B2 | **탐험을 갈래 고르기로:** 탐험 한 번이 무작위 결과 대신 2 ~ 3갈래 카드(일반 · 정예 · 이벤트 · 휴식 · 상인 아이콘)를 보이고 하나를 고른다. 정찰 3택(`scoutEvents`)을 넓힌다 | 다음 방 고르기 · 보상 미리보기 | 새 탐험 난수 추첨 금지(Wave 70 · 75) → 갈래는 해시로 만들어야 한다. 성장 모델 · 증빙 · 드라이버가 크게 움직인다 | L |
| B3 | **반복 전투 처리:** 레벨 차이가 큰 일반 전투를 한 번에 정리하거나, 멈춤 조건이 있는 연속 탐험(기존 E5) | 반복은 자동화, 선택은 몰아 준다 | D1 "2탭 유지" | M |
| B4 | **첫 정의적 선택 앞당기기:** 첫 유물 3택 또는 직업 맛보기를 첫 10분 안에 | 첫 선택이 몇 분 안 | D4(사람 측정 뒤) · 기존 E4 | S |
| B5 | **장 보스가 규칙을 비튼다:** 장 보스마다 그 전투 한정 규칙 하나(예: 기술 재사용 대기 2배) | Boss Blind | 보스 기믹은 브리핑 = 데이터 = 엔진 계약(Wave 59) 안에서 | M |
| B6 | **죽음이 이야기를 진행시킨다:** 사망 화면에 그 죽음의 지역 · 적에 따른 이야기 한 줄이 쌓인다(계정 장부). 초기화 범위는 그대로 | Hades | Wave 108 범위 표 그대로 — 새 계정 장부 하나 | S |

**들이지 않는 것:** 휠 스핀 · 보상 2배 광고 · 배틀 패스 띠(결제 · 광고 없음 결정), 승리마다 3택(Wave 127에서 소유자가 지웠다 — 3택은 장 보스 · 정예 보상에만), 판단을 없애는 완전 자동 전투, CRT · 스캔라인(11px 한글 가독성), 넘길 수 없는 긴 연출 · 큰 흔들림, 위협 표시에 추천 붙이기, 타사 그림 · 아이콘 · 색 · 문구.

---

## 4. 실행 순서

1. **시범(A1 + A3 + A4, 1 PR):** 전투 무대 · 맞은 자리 피드백 · 보상 순차 공개 · 의도 아이콘. 검증: `npm run verify` · 자연 플레이 바이트 동일 · e2e 세 폭(375 · 390 · 430) · 움직임 줄이기 · `design-verify`로 전후 캡처. iPhone 테스트 앱에 올려 소유자 체감 확인.
2. **확장(A2 + A5 + A6):** 필드 무대 · 속도 · 선택 카드 통일. 레이아웃 계약(D14) 재조정 포함.
3. **진행 구조(B):** 플레이테스트 세션 1(첫 전직까지) 결과로 Q4 ~ Q8을 정하고, 정한 것만 `game-designer` 명세 → 드라이버 짝 비교 → 구현.

---

## 5. 소유자 질문

| # | 질문 | 선택지 | 권고 |
|---|---|---|---|
| Q1 | 시범 PR 범위 | 전투 무대만(A1 + A3 + A4) / 필드까지(A2 포함) | 전투 무대만 — 체감 확인 뒤 확장 |
| Q2 | 전투의 "권장 대응" 칩 | 없앤다(의도 아이콘만) / 남긴다 | 없앤다 — Wave 88 원칙과 맞다 |
| Q3 | 이벤트 선택지의 영향 점 미리보기(A6) | 넣는다 / 넣지 않는다 | 넣는다 — 방향 · 크기는 숨겨 발견 원칙과 양립 |
| Q4 | 장 결산(B1) | 넣는다 / 보류 | 넣는다 — 기존 결정과 부딪히지 않는다 |
| Q5 | 탐험 갈래 고르기(B2) | 설계한다 / 보류 | 플레이테스트 뒤 — 가장 큰 변화, 해시 갈래 설계 필요 |
| Q6 | 반복 전투 처리(B3 = D1 재개) | 연다 / 유지 | 세션 1 · 3에서 "지루하다"가 나오면 연다 |
| Q7 | 첫 선택 앞당기기(B4) | 세션 1 뒤 판단 | 15분 기준(원장 §165)과 함께 |
| Q8 | 죽음 이야기 · 장 보스 규칙(B5 · B6) | 넣는다 / 보류 | B6 먼저(작고 원칙 충돌 없음) |

---

## 부록 A. 근거

### 질문별 상태

| 질문 | 상태 | 결론 | 근거 유형 · 위치 | 찾은 범위 |
|---|---|---|---|---|
| 우리 화면의 위계 | 답함 | 로그가 무대, 사건 무게 구분 없음 | 관찰 — dev 서버 375 × 812, 2026-11-08 | 마을 · 필드 · 전투 · 전투 결과 |
| 무대 vs 로그 | 일부 | 대상 모두 그림 · 숫자가 중심, 글 1 ~ 2줄 | 문서(Capybara Go "a bit more graphical") + 관찰(추정) | 스토어 · PocketGamer. 스크린샷 직접 대조는 못 함 |
| 전투 피드백 | 원리 답함 · 수치 제안값 | 크기 비례 · 상한 · 채널 겹치기 | 문서 — Sakurai 칼럼(번역), Vlambeer 발표 기사 | 게임별 ms 값 공개 자료 없음 |
| 보상 공개 | 일부 | 순차 · 등급색 · 넘기기 | 문서 — Archero 2 teardown | 공개 시간 수치 없음 |
| 선택지 표현 | 일부(추정 비중 큼) | 같은 크기 카드 + 미리보기 | 문서 — Reigns 리뷰 인용 | — |
| 속도 선택 | 답함 | Balatro 1 ~ 4단계, StS Fast Mode | 문서 — Steam 토론 · StS 위키 패치노트 | Capybara Go 배속 미확인 |
| 런 길이 | 일부 | VS 15 ~ 30분 · StS 약 31 ~ 43분(측정자 1명 · 승리 런) | 문서 — Wikipedia · 팬 측정 | Balatro · Hades 평균 미확인 |
| 결정 밀도 · 진행 구조 | 답함 | 반복은 자동 또는 의도로 결정화, 선택은 3택 · 노드에 몰림 | 문서 — Wikipedia · PocketGamer · 개발자 인터뷰 | — |
| 죽음과 메타 | 답함 | Hades는 죽음이 이야기를 진행 | 문서 — Kasavin 인터뷰(Game Developer 2020-02-13, Vice 2020-10-05) | — |
| 첫 선택까지 시간 | 미해결 | 몇 분 안이라는 관찰뿐 | — | 분 단위 출처 못 찾음. 사람 측정으로 대신(원장 §165) |

### 출처
- Capybara Go: [App Store](https://apps.apple.com/app/capybara-go/id6596787726) · [PocketGamer.biz 2024-09-24](http://www.pocketgamer.biz/after-1bn-in-player-spending-hybridcasual-specialist-habby-soft-launches-text-based-idle-rpg-capybara-go/) · [PocketGamer 2024-11-05](https://www.pocketgamer.com/ahead-of-the-game/capybara-go) · [GamingOnPhone 가이드](https://gamingonphone.com/guides/capybara-go-beginners-guide-and-tips)
- Slay the Spire: [Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire) · [Game Developer — Road to the IGF](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-mega-crit-games-i-slay-the-spire-i-) · [런 시간 팬 측정](https://slaythespire.info/en/i-looked-into-the-time-required-for-a-single-run-broken-down-by-character/) · [Fast Mode 패치노트](https://slaythespire.wiki.gg/wiki/Weekly_Patch_11_-_A_Library_of_Features) · [TouchArcade iOS 리뷰](https://toucharcade.com/2020/06/15/slay-the-spire-ios-review-iphone-ipad-performance-icloud-megacrit-humble-games/)
- Balatro: [Wikipedia](https://en.wikipedia.org/wiki/Balatro) · [Dot Esports — Ante · Blind](https://dotesports.com/indies/news/balatro-antes-blinds-explained) · [148Apps 리뷰](http://www.148apps.com/balatro/review/) · [Steam 토론 — 속도](https://steamcommunity.com/app/2379780/discussions/0/4346606879508270539)
- Hades: [Wikipedia](https://en.wikipedia.org/wiki/Hades_(video_game)) · [Game Developer 2020-02-13](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death) · [Vice 2020-10-05](https://www.vice.com/en/article/how-hades-made-a-genre-known-for-being-impossibly-hard-accessible)
- Vampire Survivors: [Wikipedia](https://en.wikipedia.org/wiki/Vampire_Survivors)
- Archero 2: [Tiny Teardown](https://someselectedstories.substack.com/p/tiny-teardown-archero-2-habby-games) · [GamingOnPhone 리뷰](https://gamingonphone.com/reviews/archero-2-game-review)
- Reigns: [Game Developer — Deep Dive](https://gamedeveloper.com/design/game-design-deep-dive-creating-an-adaptive-narrative-in-i-reigns-i-)
- 연출 원리: [Sakurai hitstop 칼럼(Source Gaming)](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/) · [Vlambeer 발표(Game Developer)](https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games)

**근거 한계:** 화면 배치 · 지속시간은 이번 조사에서 스토어 스크린샷 · 영상을 직접 대조하지 못한 관찰(추정)이다. A 제안의 ms 값은 원리(Sakurai · WCAG · 모션 토큰 관례)에서 정한 시작값이고, 구현 뒤 iPhone에서 조정한다. Capybara Go 구조 수치는 공략 출처뿐이다.

---

## 6. 진행 기록

- **Q1 결정(2026-11-08, 소유자 "필드까지 함께"):** 시범 PR은 A1 + A2 + A3 + A4다. Q2(권장 대응 칩)는 2026-11-08 소유자 결정 "없앤다"(아래 A4).
- **A1 전투 무대 — 구현 · 검증 완료(브랜치 `feat/stage-presentation`, 커밋 전):**
  - 적 카드를 `combat/EnemyStatus.tsx`로 분리(`card` = 데스크톱 왼쪽 열, `stage` = 휴대폰 무대). 휴대폰 전투에서 상태 표시줄은 적 카드를 그리지 않는다(`enemyPlacement="external"`).
  - 무대는 기록 창 자리의 위쪽이고 기록은 92px 띠다. 무대 높이(컨테이너 쿼리, `index.css` `w3:stage`)에 따라 그림 160px 세로 → 80px 세로(≤ 268px) → 80px 가로 줄(≤ 180px)이고, 열이 기록 띠를 담지 못하면(≤ 213px — 375 × 667 보스전) 띠를 접는다. 실측: 390 × 844 무대 310px(37%) · 160px, 430 × 932 398px · 160px, 375 × 667 140px 가로 줄, 보스전은 띠 접힘. 가로 넘침 0 · 조작판과 겹침 0.
  - 맞은 자리 피드백: 적 피해 숫자는 초상 위(700ms, 치명타 30px 금빛), 초상 흰 번쩍임 100ms, 치명타는 80ms 멈춘 뒤 200ms 흔들림, 처치는 380ms 흩어짐, 숨쉬기 3초 1.02배. 내 피해 · 회복 숫자는 조작판의 내 생명 막대 위(`CombatVitalsStrip`)이고 화면 가운데 숫자는 전투 밖에서만 뜬다. 모션 감소 설정이면 숫자만 그 자리에 남는다.
  - 판정 · 난수 · 기록 줄 변경 없음(바뀐 파일은 컴포넌트 · CSS · 테스트 · 증빙 해시뿐).
  - 검증: `tsc` · ESLint · 단위 6,516/6,516 · e2e 9개 스펙 73/73(전투 · 가독성 · 잘림 · 데스크톱 · 필드 독 · 결과 카드 · 통합 수용 배치) · 성장 진단 증빙은 해시만 다시 썼다(리포트 본문 동일) · `evidence:verify` 15/15. 바꾼 테스트 2건: `enemy-level-range-contract`(레벨 보너스를 읽는 파일이 `StatusBar` → `EnemyStatus`), `combat-skill-tray`(보스 초상 그림 80 → 80 또는 160, `offsetWidth`).
  - 미확인: iPhone 실기기 체감 · 자연 플레이 바이트 동일 측정(게임 코드를 건드리지 않아 돌리지 않았다).
- **A4 적 의도 칩 — 구현 · 검증 완료(같은 브랜치):** Q2 결정(2026-11-08, 소유자 "없앤다")대로 구현했다.
  - 판단 요약 세 칸(위협 · 권장 대응 · 예상 흐름 — `utils/combatForecast.ts`)을 지우고, 적 이름 아래 의도 칩(아이콘 · 예고 문구 · 그 행동 한 번의 예상 피해 · 맞으면 걸릴 상태)을 둔다. 휴대폰 무대와 데스크톱 상태 카드가 같은 칩을 그린다.
  - 판정은 `utils/enemyIntent.ts`(`getEnemyIntent`)이고 숫자는 엔진 한 방(`estimateEnemyMaxHit` 계열 — `CombatEngine.enemyAttack` 고정 굴림)이다. 게임 난수를 쓰지 않고 권하는 말이 없다(`tests/enemy-intent-contract.test.js`).
  - 약점 판정은 기술 칸과 같은 `hitsEnemyWeakness`이고 보스 카드 이름은 '공략 요령'(CL-09) 그대로다.
  - 검증: `tsc` · ESLint · 단위 6,519(실패 2건은 옛 예고를 찾던 테스트 — 고친 뒤 개별 재실행 통과) · build guard · 추적 증빙 15/15(성장 진단은 소스 해시만, 리포트 본문은 `HEAD`와 같다) · e2e `combat-focus` · `combat-skill-tray` · `mobile-legibility` 32/32 · 스모크 데스크톱 · 휴대폰 통과.
  - 스모크의 적 카드 넘침 검사는 글 · 조작만 잰다 — 무대 뒤 지역 그림(aria-hidden)은 흐림 가장자리를 숨기려 1.06배로 일부러 넘쳐 잘린다(휴대폰 374px 칸에서 11px).
  - 미확인: 전체 e2e · 데스크톱 상태 카드의 칩 화면 · iPhone 실기기.
- **A3 보상 공개 — 구현 · 검증 완료(같은 브랜치):**
  - 접히지 않은 결과 카드의 전리품이 한 줄 요약에서 묶음마다 칸 하나(`post-combat-loot-chip`)가 됐다. 앞의 네 묶음만 칸이고 나머지는 "외 N개" 칸 하나다(아이템 개수). 접힌 카드(`isSwiftPostCombat`)는 한 줄 그대로다.
  - 등급은 칸의 테두리 색뿐이다(`data-rarity`, 토큰 `--aether-r-*`). 판정은 `utils/lootSummary.ts`의 `getLootRarity` — 카탈로그 등급이고, 접두어 장비는 바탕 장비의 등급(접두어는 등급을 바꾸지 않는다 — `applyItemPrefix`), 모르는 이름은 `common`이다.
  - 전리품 칸 간격 60 → 100ms(`POST_COMBAT_REVEAL_TIMING.lootStaggerMs`, 명세 80 ~ 150ms), 큰 순간 빛 900 → 1200ms. 경험 · 골드 세어 올리기(400ms) · 한 번 눌러 넘기기 · 입력 보호 350ms는 이전 그대로다.
  - 검증: `tsc` · ESLint · build guard · 단위 6,520/6,522(실패 2건 — 칸 간격 상한 테스트를 명세 값으로, 성장 진단 증빙의 소스 해시 — 고친 뒤 두 파일 22/22) · 추적 증빙 15/15(성장 진단은 소스 해시만, 리포트 본문은 `HEAD`와 같다) · 결과 카드를 그리는 e2e 9개 스펙 49/49 · 375px 화면에서 칸 · 등급 테두리 · 12px · 가로 넘침 0.
  - 미확인: "외 N개" 칸의 실제 화면(렌더 테스트만) · iPhone 실기기.
- **A2 필드 무대 — 구현 · 검증 완료(같은 브랜치, f31b3abe):**
  - 사냥 지역의 대기 화면(`isFieldStageMode` — 대기 · 안전지대 밖)은 기록 창 자리의 위쪽이 필드 무대(`field/FieldStage.tsx`)이고 기록은 92px 띠다. 무대: 흐린 지역 그림 · 주인공 그림 · 지역 이름과 종류 칩 · 지역별 미세 입자 8개(고정 표, 움직임 줄이기면 그리지 않는다) · 발견 카드 하나.
  - 배치는 A1과 같은 컨테이너 쿼리다: 300px 이상은 주인공 192px, 200px 이하는 주인공 72px 왼쪽 · 카드 오른쪽(카드는 내용 높이), 열이 띠를 담지 못하면(≤ 185px) 띠를 접고 카드가 방금의 결과를 말한다(전체 기록은 '모험 기록').
  - 발견 카드는 무대가 선 뒤 최근 세 줄 안의 사건 · 획득 · 전설 · 안내 · 주의 · 오류 줄(`utils/fieldStage.selectFieldDiscovery`)이고 다음 행동의 줄이 밀어내면 사라진다(타이머 없음). 이야기 줄은 띠에만 남는다.
  - 지역 종류 판정은 `getFieldSceneKind` 하나를 기록 창 장면 머리와 무대가 같이 읽는다. 기록 창은 `hideScene`으로 장면 머리를 숨긴다(그림은 화면에 하나).
  - 획득 수치: 상태 표시줄의 골드 · 경험이 늘어난 순간 값 옆에 `+N`(`GainFloat`, 400ms). 복원 epoch(`presentationEpoch`)로 불러오기로 바뀐 값은 띄우지 않는다. 생명 회복은 기존 회복 숫자가 맡는다.
  - 레이아웃 계약(D14): 필드 기록 창 최소 96px은 무대 열의 최소 높이로 그대로다 — `field-dock-fit` 세 기기 통과.
  - 실측(원정 출발 → 탐험 시드 7): 375 × 812 무대 96px · 띠 접힘, 390 × 844 131px · 띠 접힘, 430 × 932 출발 직후 206px(세로 배치) · 임무 완료 카드가 커진 뒤 152px. 가로 넘침 0 · 화면 넘침 0 · 조작판 마지막 줄이 홈 표시줄 위.
  - 검증: `tsc` · ESLint · 단위 전체(성장 진단 증빙은 소스 목록 · 해시만, 리포트 본문 동일) · 추적 증빙 15/15 · e2e 44/44(`field-dock-fit` · `mobile-legibility` · `screen-text-clipping` · `screen-english-words` · `product-acceptance-layout`).
- **A1 생명 막대 두 층 — 마무리:** 앞 층은 80ms에 줄고 잔상이 200ms 뒤 400ms에 걸쳐 따라 준다(명세 지연 200 · 길이 300 ~ 500ms — 이전 값은 앞 층 200ms · 잔상 지연 350ms · 320ms). 적 생명 막대와 전투 조작판의 **내 생명 막대**(이전에는 잔상이 없었다 — `Gauge`의 `lagTrail`)가 같은 규칙이고, 기력 막대는 한 층이다. 움직임 줄이기에서는 전환이 0.01ms라 잔상이 200ms 뒤 바로 붙는다. 실측: 공격 한 번 직후 두 막대 모두 앞 층 `0 + 80ms` · 잔상 `200 + 400ms` 전환이 걸린다(`getAnimations`).
- **시범(A1 + A2 + A3 + A4) 마무리 검증:** 자연 플레이 3경로(나이트 · 성직자 · 어쌔신) × 3시드 × 4,000행동이 A1 이전 커밋(1589a9f8)과 결과 파일 9개 모두 바이트 동일. `npm run verify`: `tsc` · ESLint · 단위 6,521/6,522(실패 1건은 성장 진단 증빙의 소스 해시 — `Gauge` · `CombatVitalsStrip`만 다시 썼고 리포트 본문 동일, 다시 돌려 통과) · build guard 통과. 추적 증빙 15/15 · e2e `combat-focus` · `combat-skill-tray` · `mobile-legibility` 32/32.
- **남은 것:** iPhone 실기기 체감(소유자) · `design-verify` 전후 캡처 · 확장 단계 A5(속도 선택) · A6(선택 카드 통일 — Q3 결정 필요).
