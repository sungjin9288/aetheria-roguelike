# 지도 걷기 · 숨은 조우 · 보물상자 벤치마크 (2026-11-13)

**목적:** 탐험 버튼을 지역 지도 걷기로 바꾸는 방향(소유자 제안 2026-11-13 — "지도에는 플레이어 움직임만, 몬스터는 걷다가 만나고, 중간중간 보물상자")을 구현하기 전에 같은 장르 공식을 확인한다. 장르 공식과 수치 설계의 원리만 참고한다 — 다른 게임의 이름 · 그림 · 지도 · 문구는 쓰지 않는다.

**대상(공개 자료만, 대상 분류 C):** Dragon Quest(NES판 · 리메이크 · iOS/Android 이식), Final Fantasy(NES FF1 · Pixel Remaster), Pokémon 본편, Etrian Odyssey II, Octopath Traveler I · II, Bravely Default, Shattered Pixel Dungeon(SPD), Pokémon Mystery Dungeon(PMD) 계열. Siralim Ultimate는 적이 지도에 보이는 방식이라 숨은 조우 사례에서 뺐다.

**조사 범위:** 영어 웹 2013 ~ 2025, 검색 약 25회 · 페이지 열람 약 30회. Bulbapedia · Final Fantasy Wiki · TouchArcade · shatteredpixel.com 일부는 403/402로 막혀 검색 요약(2차)으로만 확인했다 — 해당 줄에 `2차`로 적었다. 게임 데이터 · 코드는 열지 않았다.

근거 유형: `문서`(공식 · 위키 · 패치노트), `관찰`(리뷰 · 영상 · 포럼), `논평`(설계 글), `추정`, `측정`(우리 저장소에서 잰 값).

---

## 1. 관찰한 사실

### 1.1 조우 확률 모델 — 세 계열

| 계열 | 사례 | 동작 | 근거 |
|---|---|---|---|
| 걸음마다 독립 확률 | DQ NES판, Pokémon | 지형별 고정 확률(DQ: 다리 1/48 · 초원 1/24 · 숲 1/16 · 언덕 1/8). 100걸음 무전투도 가능 | 문서 [dragon-quest.org](https://dragon-quest.org/wiki/Encounter) · Pokémon은 2차 [Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Encounter_rate) |
| 카운트다운 | FF1(NES) | 전투 뒤 50 ~ 255를 뽑고 걸음마다 5 ~ 6씩 줄여 0이면 전투 → 전투 직후 유예가 구조적으로 생긴다(최소 약 9걸음은 계산값) | 2차 [FF Wiki](https://finalfantasy.fandom.com/wiki/Random_encounter) |
| 위험도 누적 | EO2, DQ III 리메이크 등 | 타일마다 위험값(EO2 0 ~ 5, 입구 근처 0), 지형 가중치(DQ III 리메이크: 바다 0.4 · 초원 1.0 · 숲 1.5 · 언덕 2.5). 누적이 문턱(EO2 16 ~ 64에서 새로 뽑음)을 넘으면 전투, 전투 · 층 진입 때 0으로 | 문서 · 팬 분석 [LP Archive EO2](https://lparchive.org/Etrian-Odyssey-II-Heroes-of-Lagaard/Update%2003/) |

전투 사이 평균 걸음 수를 공식으로 밝힌 게임은 찾지 못했다(위 출처 범위 안).

### 1.2 조우 전 신호

- EO2: 화면 구석의 구슬이 문턱 대비 0 · 45 · 60 · 75%에서 진청 → 녹색 → 주황 → 적색. 글이 아니라 색이다. `문서 · 팬 분석` [LP Archive](https://lparchive.org/Etrian-Odyssey-II-Heroes-of-Lagaard/Update%2003/)
- Octopath: 달리면 미니맵이 빨개져 조우가 잦아졌다고 알린다 — "곧 전투"가 아니라 경향 표시. `관찰` [Final Weapon](https://finalweapon.net/2023/02/26/octopath-traveler-ii-encounter-rates-explained)
- 설계 글은 사전 경고와 놀라움이 함께 갈 수 있다고 본다. `논평` [Game Developer 2022](https://www.gamedeveloper.com/game-platforms/revisiting-random-encounters)

### 1.3 조우 조절 도구

- 레벨 조건 퇴치: Pokémon Repel(100 · 200 · 250걸음, 선두보다 낮은 레벨만 막음), DQ 성수(지역 기준보다 높을 때만). `문서 · 2차`
- 끄기 · 배율: FF Pixel Remaster 1.1.0(2024-01) 조우 끄기 + EXP · 골드 배율. `문서` [RPGSite](https://rpgsite.net/news/15412-square-enix-updates-steam-mobile-versions-final-fantasy-pixel-remasters-with-font-game-assista-options)
- 빈도 슬라이더: Bravely Default −100% ~ +100%. 디렉터는 "가능한 많은 사람이 끝까지" 깨기를 바랐고, 적을 지도에 보여 달라는 요구에 "보여 주는 대신 빈도 선택"으로 답했다. `인터뷰` [Siliconera 2013-10](https://www.siliconera.com/bravely-defaults-bravely-second-feature-added-help-players-finish-game/) · [2013-09](https://www.siliconera.com/new-bravely-default-already-has-over-80-of-fan-feedback-implemented/)

### 1.4 템포와 불만

- 자동 전투 · 4배속(Bravely Default)은 칭찬받았고, 빠진 BD2는 비판받았다. `관찰` [Kotaku 2014](https://kotaku.com/the-one-feature-all-modern-jrpgs-should-have-1508232852) · [GameSpot](https://www.gamespot.com/reviews/bravely-default-2-review/1900-6417645)
- 이상적 빈도에 대한 개발자 데이터는 없다. 논평은 "빈도는 낮게, 전투는 의미 있게", "한 화면에 1 ~ 2번", "탐색이 끝난 곳은 조우 생략"을 권한다. `논평` [Hello Void 2025](https://matthewmarchitto.substack.com/p/random-encounters-less-is-more) · [Game Developer](https://www.gamedeveloper.com/game-platforms/revisiting-random-encounters)
- 불만(직접 읽은 5건 — 얇다): 몇 걸음마다 끊겨 "진흙 속을 걷는" 느낌, 약한 전투 반복, 미로에서 특히 심함. `관찰 · 논평`

### 1.5 세로 화면 조작 · 배치

- DQ 이식판은 세로 고정 + 위치를 옮길 수 있는 가상 스틱(왼쪽 · 오른쪽 · 가운데), DQ8은 자동 달리기로 한 손 조작이 호평. 좁은 실내 · 세로 시야는 불만. `관찰` [Siliconera](https://www.siliconera.com/dragon-quest-viiis-one-handed-control-scheme-looks-pretty-well-done/) · [Infinity Retro](https://infinityretro.com/dragon-quest-i-mobile-review/)
- SPD는 격자 탭 이동. 하단 바 근처 오탭이 이동으로 처리되는 불만. 큰 화면 · 작은 화면 인터페이스 모드, 핀치 줌. `관찰 · 문서` [SPD App Store](https://apps.apple.com/ca/app/id1563121109)
- Chrono Trigger iOS 가상 패드는 부정확하다는 평. `관찰` [Pocket Gamer](https://www.pocketgamer.com/chrono-trigger/chrono-trigger-review/)
- 지도:UI 화면 비율 · 휴대폰 타일 크기의 공개 수치는 찾지 못했다.

### 1.6 보물상자

- PMD 계열: 층당 아이템 최대 16, 층마다 밀도 값 −2 ~ +1로 흔듦, 깊을수록 늘어난다(한 던전 1–5층 2–5개 → 12–19층 3–6개). `문서(커뮤니티 역분석 위키)` [SkyTemple](https://wiki.skytemple.org/Dungeon_Floor) · [Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Treacherous_Waters)
- SPD 미믹: 출처끼리 충돌(일반 상자 25% 대 20%, 1층 없음). `2차`
- Siralim: 한 패치가 상자를 "가장 나쁜 보물 출처"라며 보상을 올렸다 — 상자가 약하면 열 이유가 없다. `문서(패치노트)` [SteamDB](https://steamdb.info/patchnotes/7716146)

### 1.7 지도 생성

- SPD: 방 목록 결정 → 배치 → 칠하기, 주 루프에 방을 놓고 가지를 붙임(이후 8자 레이아웃 추가). `문서` [SPD levelgen](https://shatteredpixel.com/blog/coming-soon-to-shattered-levelgen-refinements.html)
- PMD: 방문마다 새로 만들고 계단을 찾아야 다음 층. 방 최소 2, 연결 · 루프 · 막다른 길의 양을 층 값으로 조절. `문서` [Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Mystery_dungeon) · [SkyTemple](https://wiki.skytemple.org/Dungeon_Floor)
- PMDO: 바닥 구조 → 입구 · 출구 → 지형 → 함정 → 돈 · 아이템. 연결성 보장 방식은 공개 문서에 없고 마지막 검사만 있다. `문서` [PMDO wiki](https://wiki.pmdo.pmdcollab.org/Floor_Generation_Overview)

### 1.8 우리 게임의 탐험 결과 분포 (측정)

자연 플레이 드라이버 v3(`runNaturalPlay` + 리듀서 관찰, 기본 정책), knight · mage · rogue × 시드 1 ~ 4 × 4,000행동. 행동 16,000번 중 탐험 4,646번(29%). 탐험이 끝난 행동의 상태로 분류했다(`other` = 조용한 결과 · 골드 같은 작은 발견 · 모닥불 등).

| 레벨대 | 탐험 수 | 전투 | 이벤트 | 유물 선택 | 그 밖 |
|---|---|---|---|---|---|
| 1 ~ 5 | 358 | 68.2% | 13.4% | 5.3% | 13.1% |
| 6 ~ 10 | 266 | 63.2% | 17.7% | 4.1% | 15.0% |
| 11 ~ 20 | 753 | 64.1% | 17.1% | 1.1% | 17.7% |
| 21 ~ 35 | 1,038 | 65.8% | 19.5% | — | 14.7% |
| 36 + | 2,231 | 66.5% | 20.2% | — | 13.3% |

측정 스크립트는 저장소 밖(scratchpad)에 두었다. 드라이버는 가방을 정리하지 않는 기본 정책이다.

---

## 2. 우리 설계로 옮길 판단 (추정 — 시제품으로 확인한다)

1. **조우는 위험도 누적 + 해시 문턱.** 걸음마다 타일 위험값(길 0 · 풀 1 · 깊은 곳 1.5 정도)을 더하고, 문턱을 넘으면 기존 `explore()`를 부른다. 문턱은 `deriveSeed(지역, 탐험 수, …)`로 정한다 — 걸음에 `actionRng`를 쓰지 않는다(Wave 70 · 75 원칙: 걷기가 탐험 난수열을 밀면 오프라인 게임 · 측정 전체가 움직인다). 조우 뒤 0으로 리셋되므로 전투 직후 유예가 생기고(FF1 · EO2), 입구 근처는 위험 0이다.
2. **신호는 글이 아니라 색 하나.** 지도 구석의 작은 구슬 4단계(EO2). 소유자가 '주의' 기록 줄을 싫어했다 — 경고 문장을 늘리지 않는다.
3. **"조용한 결과"는 조우로 띄우지 않는다.** 탐험의 약 14%가 아무 일 없거나 작은 발견이다. 걷다가 멈췄는데 아무 일도 없으면 "진흙 속을 걷는" 느낌만 남는다. 조우는 전투 · 이벤트 · 유물만 화면을 바꾸고, 작은 발견은 걷는 중 짧은 떠오름 글자로, 그 몫의 일부를 지도의 보물상자로 옮긴다. 보상 총량은 옮기기만 한다(경제 증빙 · E9 지출 비율을 지킨다).
4. **상자는 적고 확실하게.** 방문당 3 ~ 5개, 깊이에 따라 소폭 증가(PMD), 내용물은 기존 발견 몫에서 옮겨 와 열 가치가 있게(Siralim 교훈). 미믹은 시제품 밖.
5. **조작은 격자 한 칸 이동 + 위치를 옮길 수 있는 방향 패드, 탭 이동은 보조.** 격자 한 칸씩이라 좁은 곳 정밀도 문제(DQ · CT)가 없다. 누르고 있으면 연속 이동. 지도 밖 UI의 탭은 이동으로 받지 않는다(SPD 오탭). 한 손 세로 화면이 기준이다.
6. **지도는 여정마다 새로, 다시 불러와도 같게.** 지역 시드 + 여정 번호의 해시로 방 목록 → 배치 → 칠하기, 주 루프 + 가지. 생성 뒤 BFS로 도달성을 검사하고 입구에서 가장 먼 곳에 구역 보스 문, 가장자리에 옆 지역 출구(기존 지역 연결 그대로).
7. **빈도 조절 도구는 지금 넣지 않는다.** 장르에서 검증됐지만(Bravely Default · FF PR) 로그라이크의 가혹함 원칙과 부딪힌다. 대신 이미 지나간 칸은 위험 0으로 두어(논평: 탐색이 끝난 곳은 생략) 되돌아가는 길이 지루하지 않게 한다. 연속 탐험(H1)은 "길 따라 자동 걷기"로 옮기는 안을 설계에서 다룬다.
8. **측정은 이어진다.** 조우 = `explore()` 한 번이므로 드라이버는 "조우 1번 = 탐험 1번"으로 계속 잰다. 바뀌는 것은 사람의 시간(걷는 시간)뿐이라, 플레이테스트 기준값의 시간 환산만 다시 한다.

## 3. 질문 표

| 질문 | 상태 | 결론 | 근거 유형 · 위치 | 찾은 범위 |
|---|---|---|---|---|
| 조우 확률 모델 | 일부 | 독립 확률 · 카운트다운 · 위험도 누적의 세 계열, 지형 가중치 수치 있음. 평균 걸음 수 공식 자료 없음 | 문서(DQ wiki, EO LP), 2차(Bulbapedia, FF Wiki) | DQ · FF1 · EO2 · Pokémon |
| 조우 전 신호 | 일부 | 색 4단계 구슬(EO2), 미니맵 색(Octopath) | 문서 · 팬 분석, 관찰 | EO2 · Octopath |
| 조절 도구와 이유 | 답함 | 레벨 조건 퇴치, 끄기, ±100% 슬라이더. 이유는 "끝까지 클리어" | 인터뷰, 매체, 문서 | BD · FF PR · Pokémon · DQ · Octopath |
| 템포 · 이상적 빈도 | 일부 | 자동 전투 · 배속 호평. 빈도에 대한 개발자 데이터 없음, 논평은 "낮게" | 관찰, 논평 | BD · BD2 · 설계 글 2 |
| 불만 | 일부(얇음) | 잦은 끊김, 약한 전투 반복, 세로 시야 · 오탭 | 관찰 5 + 3 ~ 4건 | 2013 ~ 2025 영어 |
| 세로 화면 조작 | 답함 | 위치 이동 가능한 스틱 + 한 손. 탭 이동은 오탭 약점 | 문서(SPD 블로그), 관찰 4건 | DQ1/4/8 · FF PR · SPD · CT |
| 화면 비율 · 타일 크기 | 미해결 | 공개 수치 없음 → 시제품에서 잰다 | — | SPD · FF PR · DQ1 |
| 상자 밀도 · 내용 | 일부 | 층당 2 ~ 6, 깊을수록 증가. 미믹 확률 출처 충돌 | 커뮤니티 위키(2차 포함) | SPD · PMD · Siralim |
| 지도 생성 | 답함 | 방 목록 → 배치 → 칠하기, 주 루프 + 가지, 방문마다 재생성 · 출구가 목표. 연결성 보장은 생성 뒤 검사 | 문서(개발 블로그, 위키) | SPD · PMD · PMDO |
| 우리 탐험 결과 분포 | 답함 | 전투 63 ~ 68% · 이벤트 13 ~ 20% · 그 밖 13 ~ 18% · 유물 ≤ 5% | 측정(드라이버 v3, 12판 × 4,000행동) | Lv1 ~ 50 |
