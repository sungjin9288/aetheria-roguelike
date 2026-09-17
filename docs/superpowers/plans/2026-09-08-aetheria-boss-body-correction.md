# 보스 몸체 교정 — 설계안

상태: 승인된 첫9종 교정 local checkpoint 완료(2026-09-08). 후보·사후 독립C0/I0, 관련21/21, 실제390 portrait9장, 전체unit4423/E2E117·smoke 및 native329paths/package 비교 PASS. 상세 scripts/art_sources/monsters/v20/candidate-review.md. 다음8종·별도7종·Kingdom UI·설치 승인을 포함하지 않으며 전체Goal은 미완료다.

## 확정된 문제와 범위

09-05 게임 완성 계획 S3는 보스를 일반 몬스터와 체격·자세·주요 형태로 구분하도록 요구한다. 09-08 current runtime46 검수와 Sol/xhigh 재감사에서 일반 몸체에 장식만 더한 **17종**이 이 요구에 미달했다(Critical0 / Important1, 영향17종). 이름과 그림의 모순이 없다는 이전 semantic 판정은 이 요구의 통과 증거가 아니다.

첫 batch는 동일한 유령 기사 원형에 의존하는 9종이다. `src/data/monsters.ts`의 역할·phase 설명과 `src/data/maps.ts`의 지역을 유지한다. 아래 조형은 그 사실을 표현하기 위한 **새 디자인 제안**이며, 원래 lore에 이미 명시된 설정이라고 주장하지 않는다.

| 이름 | 현재 source가 정하는 역할 | 제안하는 큰 형태와 자세 |
| --- | --- | --- |
| 공허의 심판자 | 우주의 법칙·시공간 정지·절대 심판 | 넓은 대칭 법복과 떠 있는 석판 양팔, 수직으로 선 재판관. 방패 든 기사와 다른 사각 실루엣 |
| 균열의 사령관 | 차원 힘을 지휘하는 spectral 사령관 | 비대칭 대형 어깨 갑주와 가로지른 지휘용 장병기. 갑주 속 빈 가슴과 분리된 유령 다리를 주요 형태로 유지하고, 기존 후드·천 하체 대신 공간이 끊긴 갑주 조각으로 전진 자세를 구성 |
| 멸절의 사도 | 공간 붕괴·소멸 | 거대한 갈라진 외골격과 안쪽 빈 몸통, 양팔을 벌린 붕괴 자세. 큰 음영 공간으로 형태를 읽게 함 |
| 심연의 파수꾼 | 냉기 저항·심연 방어 | 낮고 넓은 중갑 몸체, 지면에 박힌 대형 문짝 방패, 몸을 숙인 방어 자세 |
| 원한의 용사 | 저주·최후의 힘을 폭발시키는 용사 | 상처 난 실체 갑옷, 부러진 대검을 두 손으로 든 전진 자세, 길게 찢어진 망토 |
| 전초기지 사령관 | 부활한 spectral 군인·고대 장치·기계 병기 공명 | 가슴과 얼굴이 비어 있는 망령 지휘관, 낡은 군용 판금과 유령 다리. 한 손으로 작은 고대 조작 장치를 작동시키는 자세. 기계는 보조 장비로 제한하고 기계 몸체·거대 기계 팔은 사용하지 않음 |
| 종말의 기사 | 파멸의 검·검은 화염·최후의 전장 | 큰 양손검과 길고 무거운 전신 판금, 대각선 검을 양손으로 낮게 든 묵직한 자세 |
| 차원 분열자 | 차원 절단·출혈 | 상하가 어긋난 분절 갑주, 서로 다른 방향의 쌍날 팔, 몸통 사이 명확한 틈 |
| 허무의 전령 | 메시지 전달·존재 소실·저주 | 길고 가는 사절 몸체와 아래로 갈수록 사라지는 세 갈래 옷자락, 한 팔을 뻗은 전달 자세 |

공통: 투명 배경 pixel-fantasy, 기존 캐릭터와 같은 화풍. 눈/왕관/ring을 몸통 위에 덧씌우는 기계적 구분을 금지한다. 미세 문양 없이도 일반 유령 기사 및 서로의 큰 형태가 46px에서 구분돼야 한다. 32px는 주요 몸체·무기 식별을 확인하며 얼굴·장식의 완전 판독은 요구하지 않는다.

## 나머지 범위

- 다음 교정 batch8: 공허의 대행자, 무한의 화신, 에테르 심판자, 봄의 여왕, 수호신의 사도, 에테르 거인, 하수도의 여왕, 혼돈의 수호자. 각 이름의 조형안은 production 문맥을 대조해 별도로 정한다.
- 이미 boss 원형을 사용하는7종(공허의 군주, 마왕, 에테르 군주, 엔트로피 군주, 차원 마왕, 허무의 황제, 에테르 드래곤)은 이번17종 위반과 구분한다. 고유 body 승인이 끝난 것은 아니며 최종 수용/추가 교정 판정을 남긴다.
- 일반 몬스터6종의 지역 cue 약함을 boss body 요구로 자동 확대하지 않는다.

## 구현·검증 순서

1. 이 설계의9종 조형 방향 승인 후 기존 image-generation 경로로 개별 원화 준비. 외부 유료 API나 새 의존성 없음.
2. 기존 PNG9개와 manifest/registry preimage를 보존한다. 원화도 그대로 보존하고 승인된 Pillow 경로로 alpha/여백/160px export만 처리한다.
3. 기존 v19 source·adoption 패턴을 재사용한다. 이름9개, 원본 hash, source drift 사전 거부, export·registry·manifest 일치, 나머지245 runtime/metadata 불변을 TDD로 검증한다. 새 generic framework는 만들지 않는다.
4. 원화와 160/46/32px dark/light를 직접 검수하고 Sol/xhigh가 body 구분을 독립 판정한다. 통과 전 canonical에 반영하지 않는다.
5. 승인된9개만 연결하고 actual MonsterPortrait 390×844에서 decode/46px 표시/crop/contrast/overflow를 확인한다. Seeded fixture는 자연 조우라고 주장하지 않는다.
6. 필요한 deterministic source pin만 갱신하고 report/v1 불변을 비교한다. Focused→verify:full→art/content/equipment→cap/doctor→Android debug/iOS unsigned→실제 package bytes 검증으로 닫는다.

게임 수치, boss pattern/phase, 이름, 보상, save schema는 변경하지 않는다. 기존 전체 dirty worktree·historical candidate/Toss evidence·설치된 앱을 보존한다. Commit/push/install/sign/upload/publish는 포함하지 않는다. 전체 Goal의 S5/S6와 실제 기기 관찰은 이9종 교정으로 대체하지 않는다.
