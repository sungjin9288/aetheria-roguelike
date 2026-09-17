# 일반 단검 계열19 원본·실제 크기 검수

## Exact scope

Owner가 `scripts/art_sources/equipment/v2/weapon-core/weapon-core-dagger-01.png`부터 `04.png`까지 원본4장을 직접 열어 해당 batch JSON의 row-major 이름을 대조했다. Source01/02의11종과03/04의8종을 구분했다.

- 01: 견습생의 단검, 녹슨 단검, 독사의 송곳니, 독침 단검, 뼈 단검.
- 02: 성수 단검, 쌍칼, 암살의 표창, 암살자의 단검, 암흑 단검, 어둠 감옥 단검.
- 03: 용아 단검, 질풍의 단검, 청해 단검, 투척용 단검, 혼돈 절멸기, 흑요석단검.
- 04: 균열의 날, 서리칼날.

## Findings

견습/녹슨 단검은 실용적인 짧은 날·손잡이와 재료 차이, 뼈/용아는 밝은 유기질 날, 독사/독침은 초록 계열 휘어진 장식, 성수는 밝은 금속과 금색 장식으로 읽힌다. 표창은 네 갈래 투척 별, 쌍칼은 두 자루의 교차된 날이므로 일반 단검 그림을 그대로 붙인 오류가 아니다. 투척용 단검은 간결한 날과 손잡이 끝 고리가 있다.

어둠 감옥 단검은 중심 금속 격자, 혼돈 절멸기는 분절된 날, 흑요석은 깨진 돌 면, 균열의 날은 보라색 균열, 서리칼날은 파란 날과 눈송이 끝 장식이다. 원본 cell 침범이나 실제 icon crop은 발견하지 않았다. 손잡이 방향이 다른 마지막 두 종도 아이콘 내부에 온전히 들어간다.

32px에서는 어두운 암살자/암흑/감옥 단검의 미세 차이와 독 계열 장식이 약해진다. 이름과 함께 읽는 현재 ItemIcon에서 명확한 형태 오류는 발견하지 않았지만, 이름 없이19종 모두를 식별할 수 있다는 평가는 아니다. 쌍칼 이미지가 두 개라는 이유로 offhand 규칙을 추론하거나 변경하지 않는다.

## Runtime evidence

`output/s5-offhand-review.html?cohort=dagger`는 canonical19 이름·조회와 실제 ItemIcon/CSS를 사용한다. 390×844,5group의 총57이미지(32/46/96px)가 decode된 뒤 가로 overflow 검사와 capture를 수행했다. Owner가 `output/playwright/s5-dagger-0-390x844.png`부터 `s5-dagger-4-390x844.png`까지 전부 직접 확인했다. Raw `/tmp/aetheria-dagger-capture.log` 보존. 기존 offhand/heavy QA 경로는 별도 scope로 유지한다.

원본/production/runtime PNG/native는 수정하지 않았다. Review browser만 종료하고 fresh gameplay save/dev4430은 보존했다. 자연 획득·장착·fallback·기기 검수는 이번 증거 범위가 아니다. Commit/install/publication 없음.
