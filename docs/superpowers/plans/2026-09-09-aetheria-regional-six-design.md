# 지역 정체성 6종 교정 설계

상태: **승인된6종 local 구현·검증 완료**(149 authored/105 retained). 원본과 other248 보존, focused24/24, 실제390 전투6종, 독립 Sol C0/I0 PASS. Full unit4452/E2E118·양쪽smoke·타입/lint/build, art/content/doctor·cap·Android debug·unsigned iOS 및329선택경로 byte대조 PASS. 게임 수치·저장 변경/설치/commit 없음. 상세 `scripts/art_sources/monsters/v24/candidate-review.md`. 전체게임 완료와는 별도다.

## 목적과 범위

현재 retained111 중 실제 그림과 지역/속성 문맥이 어긋난6종만 교정한다. 기존143 authored의 수용 판단과 나머지105 retained의 품질 판단을 혼동하지 않는다. 적용 후 예상 분류149 authored/105 retained는 구현·검수 통과 전 완료 수치가 아니다.

Source authority: `src/data/maps.ts`, `src/data/monsters.ts`, `src/data/monsterArtManifest.json`. 조사 시 manifest SHA-256 `0d720452daa282584d2b67ea9c7f9f998063cbba37fdb1a077949fbb7e002df9`. 구현 전 현재 bytes를 다시 확인하고 drift가 있으면 기존 원본을 덮어쓰지 않고 범위를 재대조한다.

## 개별 조형

| 대상 / runtime key | 교정할 몸체와 자세 | 작은 크기 핵심 / 금지 요소 |
| --- | --- | --- |
| 뿌리 포식자 / monster-774ae1973572 | 낮고 길게 엎드린 짐승, 가시뿌리 갈기와 갈라진 나무턱, 앞발로 흙을 움켜쥔 자세 | 톱니 같은 뿌리 윤곽과 연두 수액. 잎 화환만 얹은 화염 도마뱀 금지 |
| 세계수 수호자 / monster-0d8cf742b8e9 | 넓은 수피 몸통과 뿌리 다리, 한쪽 팔이 잎이 난 목제 방패인 수호자 | 수직적이고 안정적인 비대칭 몸체. 후드·망령·금속 검의 기존 기사 몸체 재사용 금지. 별도 보스 ‘타락한 세계수 수호자’와 혼동하지 않음 |
| 꽃잎 슬라임 / monster-00683765f209 | 낮은 연둣빛 젤리 몸체 안에 씨앗, 몸 가장자리에 분홍 꽃잎이 층층이 붙은 슬라임 | 단순한 꽃잎 외곽과 밝은 젤리 중심. 파란 물 슬라임에 작은 꽃 장식만 추가하는 방식 금지 |
| 화산재 골렘 / monster-70fff0d39abb | 거친 회색 화산석과 재가 쌓인 넓은 어깨, 짧은 다리로 버티는 묵직한 몸체 | 재색 덩어리와 제한된 주황 균열. 푸른 얼음 결정·청록 입자 금지, 전신을 불꽃으로 덮어 돌 형태를 잃지 않음 |
| 뇌운 와이번 / monster-6e2f6db6bdca | 큰 날개와 두 뒷다리의 와이번, 날개를 위로 세운 급강하 준비 자세, 먹구름빛 비늘 | 각진 번개 형태의 날개 끝과 백황색 능선. 붉은 용 몸체·불꽃 숨결 금지. 전투 resistance는 기존 자연 그대로 |
| 바람 드레이크 / monster-b9e2ceed0c47 | 가늘고 긴 드레이크, 수평 활공 자세와 흐르는 꼬리, 밝은 청회색 비늘 | 긴 수평 윤곽과 넓게 편 얇은 날개. 뇌운 와이번의 세로 실루엣·번개·붉은 화염 형태와 분리 |

공통: 기존 게임의 pixel-art 표현, 투명 배경, 160×160 RGBA,8px 안전 여백. 텍스트·프레임·UI·배경 장면 없음. 장식 이펙트는 몸체 인식을 가리지 않는다. 밝고 어두운 배경의46px/32px에서 색뿐 아니라 자세·주요 형태로 식별되어야 한다.

## 구현과 검증 순서

1. 승인 후 v23의 원본 보존·처리·adoption 패턴을 재사용한다. 여섯 이전 runtime PNG와 manifest/registry preimage를 보존하며 다른248 runtime bytes는 불변으로 고정한다. 유료 API fallback은 사용하지 않는다.
2. 원화6개를 개별 생성하고 원본 bytes를 보존한다. Python/Pillow는 기존 사용자 승인 범위에서 deterministic export에만 사용한다. 처리 전후 source SHA, 크기, alpha, 여백, 출력 덮어쓰기 거부를 RED→GREEN으로 고정한다.
3. 160/46/32px dark/light sheet를 직접 검수한다. 원본에서 몸체가 부족하면 재생성 후보를 별도 보존하며 필터나 색조 변경만으로 통과시키지 않는다. 특히 용2종과 나무2종의 상호 구별을 독립 Sol 검토에 포함한다.
4. 승인 후보만 exact6 adoption한다. Manifest·correction registry·회귀 테스트를 함께 갱신하고 다른248종/게임 수치/저장을 보존한다. 실제390×844 전투 portrait6종을 확인한다.
5. Evidence writer 종료와 source freeze 후 read-only diagnostic verify 및 전체 unit/full/art/content gates를 실행한다. Writer와 해당 evidence 불변 테스트를 병렬 실행하지 않는다.
6. 필요한 cap/native packaging과 source/dist/package 대조를 완료한다. 기존 사용자 iPhone 설치·서명·공개 배포는 포함하지 않는다. plan/tasks/progress에 실제 결과를 기록한다.

## 수용 경계

Hash 고유성이나 파일 존재만으로 디자인 완료를 주장하지 않는다. 여섯 개의 개별 정체성과 작은 크기 검수, 다른248종 보존, 전체 검증이 모두 필요하다. 도서관 보상 변경은 별도 콘텐츠 설계이며 이 이미지 교정에 섞지 않는다. 전체 Goal은 기기/lifecycle와 나머지 요구사항 확인 전 완료하지 않는다.
