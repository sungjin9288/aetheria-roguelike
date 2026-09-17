# 잔여 몬스터89 시각 마무리 설계

상태: **2026-09-09 사용자 69종 시각 마무리 설계 승인, 구현 진행 중**. 승인된 retained26 exact10은 완료했다. 기존 Goal을 재개하며 전체 게임 목표와 기기 gate를 유지한다. V27에69 PNG와 manifest/registry/diagnostic preimage를 배타적으로 보존했다. 새 후보는 전체 검수 전까지 runtime에 채택하지 않는다.

## 현재 증거와 완료 기준

- Manifest254 − authored165 = retained89. 현재 SHA로 고정한 `output/playwright/retained89-20260909/records.json`,96/32px dark/light3시트를 owner가 직접 보았다.
- `docs/evidence/art/retained89-disposition-20260909.json`은89개 이름/SHA/runtime/지역/boss/약점/저항과 판정을 담는다. `output/retained89-disposition.mjs`가 source에서 생성하며 exact coverage, 중복0, 지역 누락0을 검사한다.
- 초기 지역 조회에서 이프리트는 monsters/bossMonsters 배열에 없었지만 `MAPS['용암 지대'].boss` 단일 문자열로 연결돼 있었다. 수정된 조회는 세 경로를 모두 포함한다. 게임 콘텐츠 누락으로 오인하지 않는다.
- 20종은 형태 유지 **후보**,69종은 교정 **제안**이다. 재사용 자체를 결함이라고 단정하지 않는다. 69는 모두 기능적 버그라는 뜻이 아니라 직무 구분과 시각적 완성도를 위한 제작 범위다.
- 최종 합격에는 source 문맥,160/46/32px dark/light, 같은 군의 무채색 실루엣 비교, 실제390×844 노출이 필요하다. 그림 수나 해시만으로 합격하지 않는다.

## 유지 후보20

추가 검수 완료(2026-09-09): 현재20 source 그대로 정적 Sol C0/I0 및 실제390 browser portrait·공격20 PASS. `docs/evidence/art/retained20-review-20260909.md` 참조. 아래 후보 분류의 초기 이력은 보존하며, 이는 자연 조우/실기기 증거 또는 새69 승인으로 확대하지 않는다.

거대 사슴벌레, 거미떼, 광산 박쥐, 늑대, 독버섯, 독안개 요정, 동굴 박쥐, 들개, 멧돼지, 묘지 구울, 봄의 정령, 수련 님프, 숲 요정, 숲의 정령, 슬라임, 자연의 정령, 정원 요정, 평원 도적, 폐허 구울, 해골 병사.

관찰: 해당 곤충/동물/식물/뼈/도적의 기본 형태가 읽힌다. 요정·정령·박쥐·구울은 관련 종의 공통 형태를 공유할 수 있지만 같은 지역에서 이름만 바꾼 것으로 혼동되는지 추가 검수한다. 이20종의 runtime은 우선 그대로 둔다. 최종 검수에서 Important가 발견되면 자동으로 새 원화 범위를 확대하지 않고 대상과 이유를 설계에 반환한다.

## 교정 제안69 — 시각 설계, 기존 세계관 사실의 추가 주장 아님

아래 소품·해부학은 이름/직무를 읽기 쉽게 하는 제안이다. 몬스터의 실제 종족·스킬·수치·드롭·저항을 새로 정의하지 않는다. 원본의 읽히는 장점은 남기되 독립 실루엣과 큰 명암 면을 우선한다.

### 1. 석재·재질6

2026-09-09 후보 검수 완료: V27 stone-material 원본6/160 export6, TDD RED3→GREEN3 및 기존10 integration6 PASS. 160/46/32 dark/light·무채색 owner/Sol C0/I0. Runtime 미채택. `scripts/art_sources/monsters/v27/stone-material/candidate-review.md`에 prompt/provenance/검증·보존 증거를 기록했다. 다음은 직업·도구11이며 추가 승인 없이 같은 계획을 실행한다.

| 이름 | 형태 계약 |
| --- | --- |
| 감옥 골렘 | 철창처럼 열린 흉부와 잠금장치, 좁은 통로를 막는 사각 어깨 |
| 광석골렘 | 거친 광맥이 박힌 비대칭 바위 몸과 한쪽 큰 채굴형 주먹 |
| 돌 거인 | 길게 선 원시 암석 몸, 작은 머리와 긴 무거운 팔 |
| 석상 가디언 | 정돈된 조각면, 직립한 의식 수호상과 넓은 석재 방패 |
| 영겁의 수호신상 | 침식된 다층 석관 몸과 고리형 머리 장식, 묵직한 좌대 없는 직립 |
| 황금 골렘 | 금속 판금과 큰 금괴 관절, 낮고 넓은 광택 몸체; 석재 재색칠 금지 |

### 2. 직업·도구11

2026-09-09 후보 검수 완료: 원화12/선택11/거부어부1 원본 보존. 어부 dark32 실패를 밝고 굵은 도구/외투로 교정했고 다른10 export는 불변이다. `v27/occupation/exports-reviewed/`가 최종 후보 authority. TDD RED3→GREEN3·stone6 integration6, owner/Sol small-color/grayscale C0/I0, 원본/해시/alpha·여백11 PASS. `scripts/art_sources/monsters/v27/occupation/candidate-review.md` 참조. Runtime 미채택, 다음 경비·수호12.

| 이름 | 형태 계약 |
| --- | --- |
| 강의 요괴 | 낮은 물결형 몸과 물갈퀴 손, 넓은 젖은 머리 형태; 창 든 코볼드 제외 |
| 고문관 | 무거운 앞치마·닫힌 가면·큰 구속 집게, 고어와 피해자 묘사 제외 |
| 그림자 사냥꾼 | 낮게 웅크린 긴 몸, 짧은 활과 펼친 망토; 갑주 오크 재사용 제외 |
| 뇌운의 사냥꾼 | 전방을 겨눈 굵은 쇠뇌와 짧은 방풍 망토, 전류는 도구 연결부만 |
| 바람 추적자 | 길게 기운 가벼운 몸, 뒤로 흐르는 넓은 스카프와 짧은 추적 창 |
| 보물사냥꾼 | 큰 배낭과 들린 등불, 몸 앞 탐사용 곡괭이; 도적 두 칼과 구분 |
| 뼈 수집가 | 굽은 몸 위 큰 뼈 운반망과 집게, 수집품의 큰 외곽이 읽히게 |
| 사막도적 | 머리 천과 굽은 단검, 낮은 옆걸음 자세; 오크 중갑과 구분 |
| 저주받은 어부 | 처진 넓은 모자, 큰 낚싯대·빈 그물, 물에 젖은 긴 외투 |
| 탐욕의 상인 | 둥근 짐보따리 몸축과 열린 큰 금전함, 공격 소품보다 상인 직무 우선 |
| 흡혼 해골 | 비어 있는 갈비뼈 안의 큰 혼불 항아리, 양팔을 모은 자세; 방패 병사와 구분 |

### 3. 경비·수호12

2026-09-09 후보 검수 완료: 원화12/선택12 보존, `v27/guard-duty/exports/`가 후보 authority. Owner/Sol160·46·32 dark/light/grayscale C0/I0, TDD RED3→GREEN3 및 기존2군 integration9 PASS, source/export 해시·alpha·여백·clipping12 PASS. Runtime69/snapshots3/보호44 불변. 상세 `scripts/art_sources/monsters/v27/guard-duty/candidate-review.md`. 누적29/69, 다음 기사·무장11이며 전체69 안정 전 runtime 채택하지 않는다.

| 이름 | 형태 계약 |
| --- | --- |
| 마법 감시자 | 눈 대신 큰 마력 렌즈를 단 직립 감시 구조물, 빛나는 면은 몸에 연결 |
| 균열 감시자 | 갈라진 직사각 방패를 세운 좁은 감시병, 한쪽 높은 탐지 장식 |
| 신전 경비병 | 닫힌 투구·길고 넓은 방패·수직 장창, 단정한 직립 수비 |
| 실험실 수호자 | 밀폐된 실험 보호복과 둥근 관찰창, 두꺼운 격리 방패 |
| 심연의 수호자 | 낮고 넓은 중갑 몸, 아래로 굽은 쌍날 방패, 어두운 면의 중간톤 확보 |
| 어둠 수호자 | 몸 대부분을 덮는 높은 방패와 작은 가면, 좁고 닫힌 외곽 |
| 전초기지 파수꾼 | 해진 깃발 달린 창과 투구, 편측 경계 자세 |
| 최후의 수호자 | 부서진 큰 방패를 받친 무릎 굽힌 몸, 끝까지 버티는 자세 |
| 탑 수호자 | 높은 원통형 투구와 계단 모양 방패, 긴 직선 몸축 |
| 폭풍 수호자 | 바람을 받는 넓은 어깨판·발을 벌린 낮은 자세, 떠 있는 입자 제외 |
| 함정 수호자 | 닫힌 철제 턱 모양 흉갑·짧고 굵은 다리, 기계적인 함정 외곽 |
| 수정 지킴이 | 큰 수정 방패와 결정 관절, 투명체만으로 흐려지지 않는 불투명 중심축 |

### 4. 기사·무장11

2026-09-10 후보 검수 완료: 원화14/선택11/거부3 보존. 데스나이트 명암·용사 파손검 교정, 불투명 수정본 거부. `v27/knight-form/exports-reviewed/`가 final authority이며 initial exports는 보존했다. Owner/Sol small color/grayscale C0/I0, TDD RED3→GREEN3·기존3군 integration12 PASS, source/export 계약11 및 원본14 PASS. Other9/기존runtime69/snapshots3/보호44 불변. 상세 `scripts/art_sources/monsters/v27/knight-form/candidate-review.md`. 누적40/69, 잔여29이며 다음은 마법사·의식7이다.

| 이름 | 형태 계약 |
| --- | --- |
| 데스나이트 | 단단한 검은 판금과 닫힌 투구, 큰 양손 검; 허공의 천 몸 제외 |
| 망령 기사 | 빈 투구와 끊긴 하반신, 한쪽 방패를 든 넓은 유령 외곽 |
| 망령 기사단장 | 높은 투구 볏과 지휘검, 길게 펼친 분리 망토; 일반 망령 기사보다 직립 |
| 유령 기사 | 얇은 투명 갑주지만 굵은 밝은 중심판, 아래로 가늘어지는 한 줄기 몸 |
| 익사한 기사 | 물에 잠긴 둥근 녹슨 투구·끌리는 해초 망토·낮은 검 |
| 저주받은 기사 | 한쪽 높이 솟은 비대칭 갑주와 안쪽으로 굽은 검, 저주 균열은 몸 안에 |
| 타락 기사 | 뒤틀린 넓은 어깨·기울어진 방패, 무거운 두 다리 판금 |
| 타락한 용사 | 찢긴 영웅 망토·부러진 대검을 든 한쪽 긴 자세, 얼굴을 완전히 유령화하지 않음 |
| 파멸의 기사 | 큰 쐐기형 투구·아래로 내리찍는 장검, 사선의 무거운 자세 |
| 지옥의 문지기 | 넓게 선 몸과 문짝 같은 쌍방패, 낮은 열기 장식; 유령 기사 재사용 제외 |
| 허무의 기사 | 큰 빈 공간이 있는 끊긴 갑주와 하나의 고형 검, 눈 스티커 제외 |

### 5. 마법사·의식7

2026-09-10 후보 검수 완료: 원화8/선택7/거부사기꾼1 보존. Dark32 하반신 교정 후 owner/Sol C0/I0, TDD RED3→GREEN3·기존4군 integration15 PASS. Final authority `v27/caster-role/exports-reviewed/`; 다른6 export 불변. 원본8/final7 계약과 누적5군47 unique 승인 이름·해시 PASS. Runtime69/snapshots3/보호44 불변. 상세 `scripts/art_sources/monsters/v27/caster-role/candidate-review.md`. 누적47/69, 다음 차원·붕괴16이며 전체69 안정 전 runtime 미채택.

| 이름 | 형태 계약 |
| --- | --- |
| 고대 마법사 | 굽은 긴 모자·넓은 두루마리·짧은 지팡이, 불꽃 왕관 제외 |
| 공허 마법사 | 넓은 비어 있는 소매를 모아 중심의 어두운 틈을 감싼 자세 |
| 분노한 마구스 | 머리와 팔을 앞으로 크게 내민 시전 자세, 갈라진 지팡이와 넓은 소매 |
| 사기꾼 마법사 | 옆으로 선 짧은 외투·큰 카드 부채·감춘 두 번째 손, 화염 군주 제외 |
| 종말의 마법사 | 큰 닫힌 마법서를 들어 몸 절반을 가리는 자세, 찢긴 짧은 덧옷 |
| 종말의 전령 | 긴 몸·커다란 의식 나팔·뒤로 늘어진 띠, 마법서/지팡이와 구분 |
| 화염 사제 | 단순한 불꽃 그릇을 가슴 앞에 든 넓은 의복, 군주 왕관과 갑주 제외 |

### 6. 차원·붕괴16

2026-09-10 후보 검수 완료: 원화17/선택16/거부사령관1 보존. Source 상단 잘림 교정 후 owner/Sol C0/I0, TDD RED3→GREEN3·기존5군 integration18 PASS. Final authority `v27/dimensional-form/exports-reviewed/`; 다른15 export 불변. 원본17/final16 계약·누적6군63 unique 승인 이름/해시 PASS. Runtime69/snapshots3/보호44 불변. 상세 `scripts/art_sources/monsters/v27/dimensional-form/candidate-review.md`. 누적63/69 후보 수용; 다음 이름 있는 위압감6. Runtime 미채택.

| 이름 | 형태 계약 |
| --- | --- |
| 공간 파괴자 | 쐐기처럼 갈라진 큰 전완과 열린 흉부를 가진 사선 돌파체 |
| 공허 감시병 | 좁은 머리 없는 갑주·긴 수직 관찰 틈·작은 방패, 거대한 눈 제외 |
| 공허 집행관 | 넓은 어깨와 떨어진 큰 판형 집행 도구, 닫힌 낮은 몸축 |
| 공허의 감시자 | 수평으로 펼친 세 감시 판과 하나의 중심 틈, 병사형과 구분 |
| 붕괴된 수호자 | 한쪽 붕괴한 물리 판금·기울어진 짧은 다리, 해골 병사 재색칠 제외 |
| 붕괴한 수호자 | 몸 절반이 비어 있는 떠 있는 갑주·아래로 흩어진 큰 판, 위 종과 구분 |
| 에테르 돌격대 | 전방을 향한 쐐기 몸과 길게 접힌 두 다리, 전진하는 사선 외곽 |
| 에테르 방랑자 | 비대칭 긴 띠와 둥근 중심석, 열린 유연한 세로 몸; 불꽃 눈 제외 |
| 차원 방랑자 | 어긋난 두 겹의 몸판과 넓은 빈 간격, 짧은 뒤틀린 발 |
| 차원 분열체 | 서로 벌어지는 두 큰 반쪽과 하나의 연결부, 눈 중심 불꽃 구체 제외 |
| 차원 사령관 | 높은 깃 모양 머리판과 지휘하는 한 팔, 삼각 직립 몸 |
| 차원의 포식자 | 낮고 긴 접힌 판 몸과 앞쪽 큰 열린 틈, 거대한 눈/기사형 제외 |
| 허무 집행관 | 중심의 수직 빈 칼날과 양쪽 짧고 굵은 팔, 낮은 수평 어깨 |
| 허무의 집행관 | 머리 위 반원 집행륜과 긴 좁은 몸, 위 이름과 색 없이 구분 |
| 혼돈의 추종자 | 뒤틀린 무릎과 비대칭 의식 망토, 몸에 붙은 큰 봉인판 |
| 혼돈의 화신 | 서로 다른 방향의 큰 곡면이 엮인 비인간 mass, 열린 중심·넓은 외곽 |

### 7. 이름 있는 위압감6

2026-09-10 후보 검수 완료: 원화7/선택6/거부사도1 보존. Dark32 가독성 교정 후 owner/Sol C0/I0, TDD RED3→초기integration20/21 stale fixture key 해소→최종21/21 PASS. Final authority `v27/named-presence/exports-reviewed/`; 다른5 export 불변. 누적7군 exact69 unique 승인 이름/source/export hashes PASS. 상세 `scripts/art_sources/monsters/v27/named-presence/candidate-review.md`. 69/69 정적 후보 수용, runtime 미채택. 아래 실행계약4부터 진행한다.

| 이름 | 형태 계약 |
| --- | --- |
| 레드 드래곤 | 넓은 적갈 날개막과 낮고 긴 용 머리, 청록 얼음 장식 대신 자연스럽게 연결된 등판 |
| 마왕의 사도 | 한쪽 높은 의식 견갑·커다란 문양 방패, 군주 왕관 없이 비대칭 수행자 |
| 미궁의 마왕 | 미로형 층이 겹친 큰 흉갑과 낮은 뿔, 좌우로 넓은 길막 몸 |
| 사슬 마왕 | 몸에 실제 연결된 굵은 사슬 고리와 무거운 구속구 팔, 작은 원형 장식 제외 |
| 화염 군주 이프리트 | 넓은 불꽃 어깨·불꽃과 연결된 굵은 하체, 세로 상승형 군주; 용암 심장 중심 |
| 화염의 군주 | 닫힌 열갑주와 크고 낮은 불꽃 관, 수평으로 넓은 왕권형 자세; 이프리트와 구분 |

이름 있는 위압감6의 전원이 source의 boss인 것은 아니다. Boss 여부는 JSON의 실제 source 값을 유지한다. Prefix/phase2 이름 resolve 역시 기존 authority를 유지한다.

## 실행 계약 — 승인 후

2026-09-10 actual39089 완료: exact89 fixture 공격HP감소/46px/overflowfalse/errors0, owner all9boards+첫/마지막 전체화면 검수. UI receipt `v27/ui-receipt.json`, 실제기기/자연성장 주장은 아님. Sol 구현C0/I0·UI review 진행 중. Readonly57977 PASS. Finalfull15775 unit4505·첫E2E59 PASS 후 두번째 묶음 진행 중; full 종료/native 미완료.

최신 검증: 초기unit94252 종료4498/4505, 역사참조6와writer동시실행에 따른readonly1 실패를 기록. 역사경로 수정 후focused29 PASS, writer59500 종료/report·v1불변/source330 중manifest1pin만 변경. Readonly57977 및 finalfull15775 진행 중; art/content/doctor PASS. 실제화면89/native/최종감사는 이후다.

2026-09-10 exact69 runtime 채택 완료, 통합검증 진행 중. New adoption RED2→GREEN3, historical fixture 보존 연결 후 focused27 PASS. Other185/기존165와 protected44 보존. Unit94252 및 sole diagnostic writer59500 실행 중이며 종료/read-only/full/browser89/native 미완료. 재개 상태는 `scripts/art_sources/monsters/v27/adoption-review.md`를 따른다. 각 군의 runtime 미채택 문구는 해당 static checkpoint 당시 상태다.

1. 현재89 disposition/SHA와 manifest/registry/diagnostic/prototype 및 historical candidate/Toss aggregate를 다시 비교한다. Drift면 제작 전 중단. 기존 v1~v26 원본과 현재69 preimage를 새 비충돌 batch에 배타적으로 보존한다.
2. 위7군 순서로 개별 built-in imagegen 생성. Python/Pillow는 승인된 원본 보존 export에만 사용. 유료 API fallback/의존성 설치 없음. 처음부터69 전부를 원형 하나로 batch 재색칠하지 않는다.
3. 각 군에서 source-pinned deterministic export TDD와160/46/32 dark/light·무채색 형태·Sol 독립 검수. Failed 후보만 교정하고 다른 source/export는 고정한다. 중요한 후보 차이가 있는 동안 runtime에 채택하지 않는다.
4. 모든69와 유지후보20의 정적 판단이 안정된 뒤 exact69를 묶어 채택한다. Other185 runtime와 entry object 보존. Registry 기존165 유지·신규69, 최종234 authored/20 retained는 수량일 뿐 수용 증거를 대신하지 않는다.
5. 기존 역사 checkpoint를 정확한 preserved preimage로 연결하고 assertion 유지. 공통 corrected-name 계약 갱신. 최종 source freeze 후 canonical diagnostic writer 완료→readonly, report/v1Baseline 동일 확인. EXP/drop/pity/event/HP/profile/save/UI layout/이름/key/지역/boss flag를 바꾸지 않는다.
6. Full/art/content/doctor를 통합 checkpoint에서 한 번 실행한다. 실패가 있으면 원인을 수정하고 필요한 재실행만 한다. 각 원화마다 full/native 전체를 반복하지 않는다.
7. 기존 canonical EXP/class-vitals/map-level/spawn fixture 경로로89종 실제390×844 초상화·decode·공격·HP변화·overflow·console를 확인한다. 이는 자연 성장/실기기 관찰과 구분한다. 같은 가족의 이름/형태를 나란히 재검수하고20 유지후보도 최종 판정한다.
8. Cap sync, Android debug, unsigned iOS와 선택 이미지·production JS bytes, native tracked0, protected evidence, diffcheck. 최종 독립 Sol 감사와 ledger 정합성. 설치/서명/commit/push/공개는 별도 승인이다.

## 남은 범위

2026-09-10 local checkpoint 완료: exact69 runtime 채택, 유지20 포함89 실제390 UI와 Sol/xhigh C0/I0, focused29/full4505unit+118E2E/양쪽smoke 및 art/content/doctor PASS. Android debug/unsigned iOS exit0,841images+43JS=884 package byte동일/native tracked0. 상세 `scripts/art_sources/monsters/v27/adoption-review.md`, `output/v27-native-20260910.json`. 이번69 시각 마무리 local 범위는 완료됐으며 설치/실기기/전체Goal 완료를 뜻하지 않는다.

본 설계 승인으로 기존 전체 Goal을 유지한다. 캐릭터/지역/장비/세트/스토리/전투/성장/저장 감사는 기존 source별 증거를 따르며 이 문서가 전체게임 완료를 선언하지 않는다. 실제 기기 foreground/background·저장 보존·설치본 식별과 S6는 여전히 별도다. 물리 Android 제외 조건도 그대로다.
