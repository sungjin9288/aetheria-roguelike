# Retained identity follow-up

## 범위와 현재성

2026-09-09 owner가 `output/playwright/retained114-20260909/sheet-1.png`부터 `sheet-4.png`까지 직접 다시 열었다. 96/32px dark/light 정적 이미지이며 실제390 combat 검증이 아니다. 기존 records114에서 current corrections registry에 등록된9개를 제외한105개 runtime SHA를 재계산해 records와 전부 일치함을 확인했다.

제외9: 꽃잎 슬라임, 뇌운 와이번, 바람 드레이크, 뿌리 포식자, 서리 늑대, 세계수 수호자, 잉크 슬라임, 화산재 골렘, 화염 감시자. 이 셀들은 현재 이미지 증거로 사용하지 않았다. 이미 별도 elemental6 설계가 있는 여섯 개도 이번 추가 대상에서 제외한다.

## 추가로 문맥을 대조한 4종

| 이름 / 시트 번호 | 실제 source·시각 관찰 | 판정과 다음 검토 |
| --- | --- | --- |
| 전류 추적자 / 77 | 기계 폐도 lore는 고대 병기의 순찰. 현재는 천 두건·갈색 도적 옷·두 칼, 전류나 추적 장치가 없음. Profile은 대지 약점/빛 저항/atkMult1.14 | 이름·지역 역할을 그림으로 구별하기 어렵다. 도적의 색 변경이 아닌 전기 추적 장치/기계 몸체 등의 조형 제안이 필요. 자동인형이라는 새 lore가 이미 확정됐다고 주장하지 않음 |
| 변이 실험체 / 38 | 폐기된 연구소의 금지 생체실험. 현재 작은 녹색 코볼드·후드·손무기 원형으로 뚜렷한 비대칭 변이 특징이 없음. Profile은 poison hit | 생체실험 정체성 부족. 비대칭 팔다리·봉합/배양 흔적 같은 조형 선택을 먼저 설계. Poison 수치 변경이나 지나친 고어 추가 불필요 |
| 에테르 잔류체 / 68 | 에테르 폐허의 현실 침식. 초록 나뭇가지 정령에 눈과 원형 장식. Profile 자연 약점/빛 저항 | 나무 정령 원형과 잔류 에너지의 구분 약함. 부유 파편·끊어진 몸체 등의 선택은 새 시각 제안이지 기존 source anatomy가 아님 |
| 에테르 흡수체 / 69 | 같은 지역, 잔류체와 같은 나무/눈 원형·유사 자세. 별개 profile의 hp/atk/def/pattern 존재 | 둘의 다른 역할을 외곽 형태로 읽기 어려움. 수렴하는 입구/고리와 응축된 몸체 등 잔류체와 구별되는 구조 검토 |

이는 **시각 정체성 개선 후보**이며 production 전투 오류나 특정 새 해부학의 의무를 입증한 것은 아니다. Shared body 자체를 무조건 결함으로 취급하지 않는다. 차후 exact art contract와 승인, 원본 보존·작은 크기 검수 후에만 교체한다. 기존 elemental6 승인 범위에 임의로 포함하지 않는다.

Current preimage SHA256:

- 전류 추적자 `monster-60f43416e1e9`: `a84d012c26f3b0ee7b0c47036047a9afef65bbb738c2271d88b2ef63ab69dea1`.
- 변이 실험체 `monster-9da39d1152ff`: `4d144be0789b02beadcf0746001b792c9c10f049b7eeb1a0ef2a7d45096b28db`.
- 에테르 잔류체 `monster-4b17248f8de5`: `8dc9ce87da03895a918e55fbc58e6a0bab1013efe35c4030cd39d94742231236`.
- 에테르 흡수체 `monster-960af22a3197`: `b6c367eb942c67d659b17ba201e1b1977e23511d9b3d7c287650420fa8337ee2`.

경로는 `public/assets/monsters/catalog/<key>.png`. Profile·지역 문맥은 `src/data/monsters.ts`, `src/data/maps.ts`; 연결은 `src/data/monsterArtManifest.json`에서 확인했다.

## 남은 판정과 보존

105 = 기존 elemental6 + 이번 contextual4 + 나머지95. 이 분할은 시각 합격 수가 아니다. 네 시트 관찰만으로 나머지95의 개별 디자인·실제 사용 크기 최종수용을 선언하지 않는다. Current retained의 boss flag는 레드 드래곤·화염 군주 이프리트·화염의 군주3개뿐이며 다른 이름에 마왕/군주가 있다는 이유만으로 boss-specific 요구를 적용하지 않는다.

이번 작업은 원본·runtime·manifest·registry·수치·save·native를 변경하지 않았다. 최신 검증/build는 library local, 전체 Goal active. 이미지 승인이나 실기기 조건을 대신해 같은 full/native를 재실행하지 않았다. 다음은 기존 elemental6 승인 이후 구현, 추가4에 대해서는 별도 조형 선택 확정이다.
