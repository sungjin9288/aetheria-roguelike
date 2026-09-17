# 일반 지팡이·완드24 원본 및 실제 크기 검수

Owner가 `scripts/art_sources/equipment/v2/weapon-ranged-magic/weapon-ranged-magic-staff-01.png`부터04까지 원본4장을 열고 batch row-major 이름과 대조했다. 01/02의12종,03/04의12종을 각각 검수했다.

## Exact names

- 01: 고대 마탑 스태프, 나무지팡이, 대지의 지팡이, 마녀의 지팡이, 마법봉, 마법지팡이.
- 02: 번개 지팡이, 빙결 지팡이, 빙하의 지팡이, 성운 지팡이, 세이지 로드, 수정 완드.
- 03: 아크스태프, 얼음 지팡이, 에테르 플럭스 로드, 유성 완드, 정령의 지팡이, 차원 균열 지팡이.
- 04: 폭풍 스태프, 허공의 지팡이, 호신용 지팡이, 혼돈의 로드, 혼돈의 지팡이, 화염의 지팡이.

## Findings

나무/호신 지팡이는 굽은 목재 끝, 수정 완드는 묶은 수정 끝, 대지는 갈색 큰 수정, 냉기 계열은 얼음 결정, 정령은 초록 중심과 덩굴, 화염은 불꽃, 허공은 검은 초승달형 구조와 보라색 중심으로 읽힌다. 마법봉과 고급 스태프는 단순 구형 끝과 복잡한 방사형 머리의 차이가 있다. 원본 cell 침범, 실제 아이콘 잘림이나 물체 종류의 명확한 모순은 발견하지 않았다.

32px에서 긴 자루와 문양·보석 세부는 가늘어지고 같은 원소 스태프끼리 색과 중앙 장식 중심으로 읽힌다. 작은 크기에서 모든 개별 문양을 식별하거나 이름 없이24종을 구분한다는 평가는 아니다. 혼돈의 로드의 도끼형 머리는 마법 중심 장식으로 보이며 이름이 특정 날 형체를 명시하지 않으므로 별도 물체 모순으로 확정하지 않았다.

## Runtime evidence and limits

`output/s5-offhand-review.html?cohort=staff`는 canonical staff24 및 production ItemIcon/CSS를 사용한다. 390×844 6group, 총72이미지(32/46/96px) decode·가로 overflow 검사 후 capture했다. Owner가 `output/playwright/s5-staff-0-390x844.png`부터5까지 모두 직접 확인했다. Raw `/tmp/aetheria-staff-capture.log` 보존.

별도 browser만 종료, fresh save/dev4430 보존. Production/source/runtime/native 변경 없음. 자연 획득·장착·fallback·실기기 검증은 아니다. 이번 supplemental 일반 무기101종(source/runtime)은 모두 검수했지만 암흑의 대검 Important1은 미해결이다. 기존 armor/offhand/signature 검수의 증거 수준 및 전체 S3/S5/S6 완료 여부와 구분한다.
