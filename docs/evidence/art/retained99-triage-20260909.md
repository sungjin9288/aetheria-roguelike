# Retained99 정적 검수와 다음 교정 범위

Elemental25 local 완료 후 `output/review-retained99.py`로 기존 검수 형식을 재사용했다. 새 출력 `output/playwright/retained99-20260909/`에99개 이름·runtime·SHA records 및96/32px dark/light sheet4장을 생성했다. Original runtime은 읽기만 했고 이전114 시트는 덮어쓰지 않았다. Current manifest254에서 corrections155를 제외한 exact99와 records가 일치하며99 SHA 모두 PASS다.

Owner가4장을 모두 직접 관찰했다. 이는 정적 triage이며99개의 자연 전투·46px 실화면 최종 합격을 의미하지 않는다. 기존 contextual4를 개별160px로 다시 열고 실제 source 지역·profile을 대조했다.

## 우선 교정10

| 군 | 대상 | 다음 액션을 바꾸는 관찰 |
| --- | --- | --- |
| 기존 contextual4 | 전류 추적자, 변이 실험체, 에테르 잔류체, 에테르 흡수체 | 도적/코볼드/같은 나무 정령 원형과 실제 기계·연구소·차원 붕괴 문맥의 간극. 구체적 몸체 차별화 제안 |
| 암흑 시전자3 | 망자의 사제, 암흑 사제, 언데드 마법사 | 모두 화염 군주 원형을 공유. Source는 저주받은 묘지/암흑 성, 빛 약점·어둠 저항이며 앞뒤 두 종은 curse hit. 불꽃 왕관보다 장례의식·봉인·해골 마법서의 다른 역할/자세를 제안 |
| 화염 도마뱀3 | 화염 도마뱀, 불꽃 도마뱀, 화산 도마뱀 | 공통 자주색 몸/청록 장식과 작은 색 차이. 세 지역 모두 냉기 약점·화염 저항. 낮은 동물형·솟은 꼬리/등볏·납작한 화산 등판으로 외곽 차별화 제안 |

계획은 `docs/superpowers/plans/2026-09-09-aetheria-retained-ten-identity.md`에 exact10/preimage/244보존/수치불변/TDD/full/실화면/native 기준까지 고정했다. 여러 작은 묶음의 full 반복 대신 시각 군별 제작·검수를 먼저 하고 안정된10을 cohesive local checkpoint로 검증한다. 새 그림과 해부학은 승인 전 미구현이다.

특수 경계: `화염 도마뱀`의 legacy key는 `fire-lizard`. Catalog와 authored만 교체 가능하며 여러 다른 sprite가 참조하는 `public/assets/monsters/fire/fire-lizard.png` prototype은 보존해야 한다. 이는 단순 전체 파일명 치환을 피해야 하는 source 기반 제약이다.

후속 참조 감사: 현재 manifest의 prototype 소비자는 exact3(불꽃/화산/화염 도마뱀)이고 모두 설계10에 포함된다. Other244가 현재 직접 의존한다고 주장하지 않는다. Generator의 beast/aquatic/reptile/dragon fallback 후보와 과거 재현을 보존하기 위해 prototype 자체는 동결한다(SHA `7a1246fe5c2952bf042436978249ca2db1a81fbbb0dc27e1198842568458dbe1`). `getMonsterVisual` production 함수에서 일반/정예/광폭한 이름3 모두 catalog 경로로 resolve해, runtime 우회 때문에 prototype까지 바꿀 필요가 없음을 확인했다. 첫 `.js` 직접 검색은 실제 파일이 `.ts`여서 경로 오류였고, 실제 `.ts`를 읽고 검증했다. Source 변경 없음.

## 남은 범위와 한계

99=우선 교정 제안10+최종 수용 미완료89. 공통 몸체 사용만으로 다른89 전체를 결함 또는 합격으로 분류하지 않는다. 기본 늑대·멧돼지·슬라임처럼 종을 읽을 수 있는 그림과, 직무별 경비병/사제/기사 변형의 역할 구별은 다른 문제다. 추가 우선순위는 source 문맥과 사용 크기의 실제 혼동을 근거로 판단한다.

이번 turn은 progress: 최신99만 포함하는 증거가 생겼고 추가6와 prototype 보존 제약으로 다음 설계 범위가 바뀌었다. Runtime·수치·save·canonical diagnostic·native 변경 없음. `git diff --check` PASS/native tracked0. 최신 완료 full/native는 elemental25이고 재실행하지 않았다. Goal active; 설계 승인과89 수용/기기/lifecycle/S6는 여전히 별도다.
