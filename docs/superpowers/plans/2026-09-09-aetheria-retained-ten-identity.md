# 잔여 몬스터 정체성10 교정 설계

상태: **2026-09-09 승인 exact10 local 구현·검증 완료, 미설치**. Exact10/source/prototype/diagnostic/protected preflight PASS 후 v26 preimage 보존. 원화11회/선택10/거부1 보존, tracker dark32 교정 후 owner/Sol visual·구현 C0/I0. Focused29, full4481unit/118E2E/양쪽smoke/type/lint/build, 실제390 열 종·공격, diagnostic readonly/report·v1불변, art/content/doctor, cap/Androiddebug/iOSunsigned PASS. Native884선택경로 byte동일. 상세 `scripts/art_sources/monsters/v26/candidate-review.md`. 나머지89 retained를 최종 수용했다고 주장하지 않으며 기기/lifecycle/S6는 별도다.

## 조형 계약

아래는 역할을 읽기 쉽게 만드는 시각 제안이다. 새로운 해부학·종족 설정이 기존 source에 확정돼 있다는 주장이 아니며 전투 속성/수치는 변경하지 않는다.

| 대상 / 지역 | 현재 관찰 | 제안 형태와 구별 기준 |
| --- | --- | --- |
| 전류 추적자 / 기계 폐도 | 천 두건·두 칼의 도적 원형 | 가늘고 앞으로 기운 두 다리 기계 추적자, 길게 뻗은 탐지 안테나와 갈라진 전극 팔. 청백 전류는 연결부에만. 중갑 자동인형·거대 골렘과 달리 좁은 몸축/길쭉한 탐지부로 구분 |
| 변이 실험체 / 폐기된 연구소 | 후드와 무기를 든 녹색 코볼드 | 한쪽 긴 팔과 다른 쪽 짧은 팔, 굽은 등, 피부 아래 큰 배양 흔적이 보이는 비대칭 생물. 창/후드 제거, 무기보다 몸체로 읽히게. 노출 장기·피·과도한 고어 없음 |
| 에테르 잔류체 / 에테르 폐허 | 나무 정령 위 눈·원형 장식 | 세로로 끊어진 비정형 파편, 희미한 잔광이 연결하는 열린 몸체. 큰 빈 공간이 있는 길쭉한 실루엣. 나뭇가지·나뭇잎·거대한 눈 재사용 금지 |
| 에테르 흡수체 / 에테르 폐허 | 잔류체와 같은 나무·눈 원형 | 낮고 넓은 응축체, 몸 안쪽으로 접힌 두꺼운 판이 중앙의 어두운 흡입구를 감쌈. 닫힌 원형 mass와 안쪽 방향성으로 잔류체의 열린 세로 파편과 구분. 실제 흡혈 등 새 효과 추가 없음 |
| 망자의 사제 / 저주받은 묘지 | 불꽃 군주 원형 | 수의 같은 긴 의복, 굽은 의식 지팡이, 양손을 가슴 앞에 모은 장례 의식 자세. 해진 밝은 천/뼈 장식의 세로 실루엣. 불꽃 왕관·화염 갑주 없음 |
| 암흑 사제 / 암흑 성 | 같은 불꽃 군주에 지팡이 | 얼굴을 가린 낮은 두건, 넓은 검은 의복과 크게 펼친 팔, 가슴 앞 봉인 인장. 넓은 삼각형 자세로 망자의 사제와 구분. Dark32에서 의복 경계가 읽히는 보라 회색 중간톤 유지 |
| 언데드 마법사 / 저주받은 묘지 | 불꽃 군주 원형 | 드러난 해골 얼굴, 굽은 척추, 한 손은 큰 낡은 마법서를 들고 다른 손은 주문을 맺는 자세. 짧은 해진 망토와 뼈 다리로 사제 두 종의 긴 의복과 구분. 불꽃 군주 재색칠 금지 |
| 화염 도마뱀 / 화염의 협곡 | 자주색 몸·청록 장식 원형 | 낮고 튼튼한 네 다리 도마뱀, 둥근 주둥이, 등에서 꼬리까지 이어지는 굵은 주황 열선. 적갈 몸체, 동물 형태가 먼저 읽히도록 장식 최소화 |
| 불꽃 도마뱀 / 화염의 사원 | 같은 원형과 청록 입자 | 가는 몸통을 조금 세운 경계 자세, 위로 말린 넓은 꼬리와 불꽃 같은 등 볏. 위로 솟은 꼬리/볏으로 낮은 화염 도마뱀과 구분. 몸 밖 불꽃 입자에 정체성을 의존하지 않음 |
| 화산 도마뱀 / 용암 지대 | 같은 원형·작은 색 차이 | 낮고 넓적한 몸, 두꺼운 짧은 꼬리, 현무암 같은 큰 등판과 굵은 주황 균열. 단단한 사각 mass로 다른 두 도마뱀과 구분. 머리·발이 검은 배경에 묻히지 않게 중간톤 확보 |

160/46/32px dark/light에서 소재와 주요 몸체를 식별하고, 같은 군의 자세·외곽은 색을 제거해도 구별되어야 한다. 원화가 좋아 보여도32px에서 흐린 선으로 사라지면 거부한다. 새 눈·입자·색만 더한 원형 반복을 교정 완료로 취급하지 않는다.

## 범위·보존

- Exact10 catalog PNG와 authored/v1 연결, manifest의10 sourceRuntimePath/sha256, registry add10, 원본·export·검수·관련 tests/evidence/ledger만 변경한다. 나머지244 entry/runtime bytes를 보존한다.
- 새 v26 batch가 없음을 확인하고 preimage10/manifest/registry/diagnostic을 먼저 보존한다. 다른 작업의 preimage drift가 있으면 수정 전에 중단한다.
- `화염 도마뱀`의 기존 key는 **fire-lizard**다. Catalog `/assets/monsters/catalog/fire-lizard.png`와 새 authored 경로만 교체한다. 여러 retained sprite의 원본인 **public/assets/monsters/fire/fire-lizard.png는 변경하지 않는다**. 기존 prototype·v1~v25 masters/exports/rejected는 모두 보존한다.
- 후속 source 감사: 현재 이 prototype의 manifest 소비자는 불꽃/화산/화염 도마뱀 exact3이며 모두 대상10 안에 있다. 다른244의 현재 의존성을 과장하지 않는다. Generator의 향후 fallback 및 과거 재현을 위해 prototype SHA `7a1246fe5c2952bf042436978249ca2db1a81fbbb0dc27e1198842568458dbe1`을 전후 비교한다. 일반/정예/광폭한 화염 도마뱀은 모두 catalog/fire-lizard.png로 resolve하는 production 함수 검증 PASS.
- Name/key/region/archetype/boss flag/weakness/resistance/status/HP/ATK/DEF/EXP/loot/pity/event/save는 그대로 둔다. 그림 색에 맞추려고 저항값을 고치지 않는다.
- Built-in image generation을 개별 자산마다 사용한다. 유료 API fallback·dependency install·commit/push·설치·서명·공개는 제외한다. 승인된 원본 보존 Python/Pillow export만 사용한다.

## 구현·검증 순서

1. Preimage와 protected candidate/Toss hashes 확인. 원본·기존10 PNG·manifest·registry·diagnostic 보존.
2. 전류/실험체2 → 에테르2 → 암흑시전자3 → 도마뱀3 순으로 원화를 만들고 각 군의 겹침을 비교한다. 실패본은 삭제하지 않는다.
3. v25 source-pinned export 패턴 TDD RED→GREEN. 전체 source preflight, drift·opaque/empty·기존 output 거부,160×160 RGBA/8px margin, 두 fresh export byte일치.
4. Owner small-scale와 Sol 독립 visual review에서 C/I0을 확인한 뒤 exact10만 채택. Other244·registry 기존155·prototype 불변 tests 및 공통 CORRECTED_NAMES 목록도 함께 갱신. 과거 checkpoint는 정확한 보존 preimage에 연결하고 assertion은 유지.
5. 필요한 canonical writer 종료→report/v1불변→readonly verify. 모든 source 입력이 안정된 한 묶음에서 `npm run verify:full`, `npm run art:verify`, `npm run content:verify`, `npm run mobile:doctor`를 실행한다. Source 변경 없는 승인대기 중 같은 full을 반복하지 않는다.
6. 실제390×844 전투10종 portrait·공격·HP변화·overflow·console. Production EXP/class-vitals와 map level(배열 포함)/spawn authority로 fixture 생성. 화면 전환 opacity가 안정된 뒤 캡처하고 자연 출현/실기기 증거와 구분한다.
7. `npm run cap:sync`, Android debug/unsigned iOS, 선택 이미지/productionJS package byte 비교, native tracked0/protected evidence 불변/diffcheck. 최종 Sol 구현 감사와 ledger/handoff 정합성 확인.

한 후보가 실패하면 해당 원화만 교정하고 통과한 나머지 source/export SHA는 유지한다. 조형 검수 미통과를 테스트 완화로 우회하지 않는다. 모든 local gate 완료 전165authored/89retained 달성이나 전체게임 완성을 선언하지 않는다. 기기/lifecycle/S6는 별도다.

## Preimage — 2026-09-09, HEAD38a3584

Runtime은 `public/assets/monsters/catalog/<key>.png`다.

| 이름 | key | SHA256 |
| --- | --- | --- |
| 전류 추적자 | monster-60f43416e1e9 | a84d012c26f3b0ee7b0c47036047a9afef65bbb738c2271d88b2ef63ab69dea1 |
| 변이 실험체 | monster-9da39d1152ff | 4d144be0789b02beadcf0746001b792c9c10f049b7eeb1a0ef2a7d45096b28db |
| 에테르 잔류체 | monster-4b17248f8de5 | 8dc9ce87da03895a918e55fbc58e6a0bab1013efe35c4030cd39d94742231236 |
| 에테르 흡수체 | monster-960af22a3197 | b6c367eb942c67d659b17ba201e1b1977e23511d9b3d7c287650420fa8337ee2 |
| 망자의 사제 | monster-411b4ac30c1e | 954f821ef6208b831d2c2d6e6a70b1b9056879d70cdb4c85450d6e63f7a9f3d4 |
| 암흑 사제 | monster-1138655832ae | 61356f74f31ec5fa3a566fe86263bfaf7ac58f20eb6b93cd36206da35d7abc8c |
| 언데드 마법사 | monster-90af280d7002 | 4fb124f9d55c78dbf4f7cafab7ac55e98b17f34d4fe1d6532295dbdab1e6fd55 |
| 불꽃 도마뱀 | monster-02c52111756b | e1166168da6677e61fc1b65077ec27165d41ae17704c39ff3a35b4f2e4c169d8 |
| 화산 도마뱀 | monster-fa417fa9f7b8 | 3b8fc2e628e7fd4e3b1201624f5317a588efbb7e5701cd8fafeeefaa068a3580 |
| 화염 도마뱀 | fire-lizard | 6ab97985aa55647f2c3dac3f4cc5cfe7c9c74e0097705f3c1e24bc903c41c159 |

- Manifest: `b902a1499ca3120e4e0ba9a790b65b84e14fb91151248e3cb44564a2028517ba`
- Corrections registry: `bc128479de59630e62ff503e20ab3f3f06dca6afec3fb0de80eded18450c172f`
- monsters.ts: `e278d7b0fb8a4a256a3e07f7fb7500114a5ae945bc08e4892b21e26459fe0d09`
- maps.ts: `bfa8b82d98a15eff56098a641d59f85a0f6a1bb613c6ac9602cae0689f004a72`
- Diagnostic: `ced614ce1b41a32fb4bc2583baf6996953c7fa0ed5db75192a5bf4d3d8ed3fb0`

검수 입력: `output/playwright/retained99-20260909/records.json` 및 sheet1~4. Current99 모두 SHA 일치, adopted155 제외. 이 설계 턴은 runtime/source/build를 변경하지 않았다.
