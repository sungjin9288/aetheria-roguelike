# 일반 도끼·둔기11 원본 및 ItemIcon 검수

## Scope

`scripts/art_sources/equipment/v2/weapon-core/weapon-core-heavy-01.png`와 `weapon-core-heavy-02.png`를 owner가 직접 열어 동일 batch JSON의 row-major 이름과 대조했다.

- heavy-01: 광기의 도끼, 광전사의 도끼, 나무곤봉, 낡은 철퇴, 녹슨 도끼, 대지의 메이스.
- heavy-02: 돌망치, 드워프의 망치, 전투도끼, 철퇴장, 타이탄 해머.

`output/s5-offhand-review.html?cohort=heavy`는 원래 offhand 검수의 기본 경로를 유지하며 heavy batch11만 별도 선택한다. 실제 canonical 조회·ItemIcon·production CSS를 사용하고 총11종, 3group을 검사한다. 390×844에서 각32/46/96px, 총33개의 image decode와 overflow 검사를 수행했다. Owner가 `output/playwright/s5-heavy-0-390x844.png`부터 `s5-heavy-2-390x844.png`까지 모두 직접 확인했다. Raw `/tmp/aetheria-heavy-capture.log` 보존.

## Findings

도끼의 날, 철퇴/메이스의 다각형 머리, 나무곤봉의 두꺼운 목재 끝, 망치의 횡방향 머리가 구분된다. 녹슨 도끼는 단날·목재 손잡이, 광기 도끼는 큰 갈고리형 날, 광전사/전투도끼는 양날, 돌망치는 묶은 돌, 드워프 망치는 금색 중심 띠, 타이탄은 두꺼운 각진 머리와 녹색 보석이다. 이름이 명시한 물체와 모순되거나 cell/아이콘 경계에서 잘린 형체는 발견하지 않았다.

32px에서 철퇴장은 긴 손잡이 때문에 머리가 작고, 도끼의 세부 각인·타이탄 보석 장식은 약해진다. 광전사의 도끼와 전투도끼는 양날·붉은 손잡이를 공유해 작은 크기에서 가까운 계열로 읽힌다. 이를 모든 무기가 작은 크기에서 독립적으로 식별된다는 주장으로 확대하지 않는다. Item 이름이 함께 표시되는 현재 UI에서 명확한 사용 차단 결함은 발견하지 않았다. 1H/2H 허용 여부는 그림의 길이가 아니라 production hands/canEquip으로 판단한다.

Production·원본·runtime PNG·native 변경 없음. 검수 browser만 종료하고 fresh save/dev4430은 보존했다. 이 결과는 component 시각 검수이며 자연 획득/장착/기기 설치/fallback 증거가 아니다.
