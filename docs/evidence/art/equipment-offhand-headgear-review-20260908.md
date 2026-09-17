# 일반 방패13·머리 장비3 원본과 실제 크기 검수

## Exact scope

`scripts/art_sources/equipment/v2/offhand-headgear/batches/`의 book 제외6개 batch, 총16종이다. 별도 book5 검수와 합쳐 이 cohort21종의 원본 및 primary ItemIcon 크기를 확인했다. 다른 cohort나 signature 장비로 확대하지 않는다.

- shield-01: 균열 차단 방패, 냉기 방패, 대지 방패, 목재 방패, 성광 방벽, 세계수 방패.
- shield-02: 세계의 방패, 수호자의 방패, 어둠 방패, 원시의 이지스, 자연 방패, 철제 방패.
- shield-03: 화염 방패.
- hood/straw-hat/wizard-hat: 도적의 두건, 짚 모자, 마법 모자.

Owner가 동명의 원본 PNG6장을 직접 열고 row-major 이름과 대조했다. `output/s5-offhand-review.html`은 위 batch 이름을 canonical `findItemByName`으로 조회해 실제 ItemIcon·production CSS에서 각32/46/96px로 표시한다. 총16종·4group 계약을 검사하며 원본, runtime, gameplay를 수정하지 않는다.

## Visual findings

목재/철제는 원형 재료와 중앙 돌출부, 냉기는 얼음 조각, 성광은 밝은 긴 방패와 태양, 어둠은 검은 뾰족 외곽과 보라색 중심, 자연/세계수는 목질과 잎·보석, 원시의 이지스는 뼈 돌기와 가죽, 화염은 붉은 틈으로 읽힌다. 두건은 깊은 천 입구, 짚 모자는 넓은 직조 챙, 마법 모자는 긴 굽은 원뿔로 구분된다. 원본의 cell 침범이나 실제 icon clipping은 발견하지 않았다.

32px에서 어둠 방패·도적의 두건은 내부 세부가 약하지만 외곽과 주요 개구부는 남는다. 나무 계열 방패의 잎·보석 세부는 크기가 커져야 선명하다. 이는 미세 장식 식별 한계이며 모든 세부가32px에서 읽힌다는 주장은 하지 않는다.

두 contextual 표현을 확인했다. 균열 차단 방패는 빛 속성이지만 보라색 균열을 표현한다. 세계의 방패는 '세계수의 의지가 깃든' 설명을 나무 대신 지구본 문양으로 표현한다. 각각 차단 대상/세계의 상징으로 해석 가능하므로 명백한 물체 형태 모순으로 확정하지 않았다. 속성색을 확정적 식별 정보로 사용해서는 안 되며 item 이름·설명이 함께 있어야 한다.

## Runtime proof and limits

390×844에서 4group×12이미지=48개의 decode를 기다린 뒤 overflow 검사와 screenshot을 수행했다. Owner가 `output/playwright/s5-offhand-0-390x844.png`부터 `s5-offhand-3-390x844.png`까지 모두 직접 확인했다. Raw `/tmp/aetheria-offhand-capture.log` 보존. Console에는 검수 HTML의 favicon.ico404 한 건과 React DevTools INFO가 있었다. 48개의 item image decode는 성공했으므로 favicon 오류와 아이템 렌더 결함을 구분한다.

실제 ItemIcon component 검수이며 자연 획득/장착/캐릭터 합성/모든 fallback/기기 검수가 아니다. 별도 review browser만 종료했고 기존 fresh gameplay save와 dev4430은 보존했다. Production·native 변경, commit/install/publication 없음.
