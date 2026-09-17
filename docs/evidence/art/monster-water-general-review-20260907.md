# 수중·영혼의 강 몬스터 12종 시각 감사

2026-09-07. `deep-sea-corridor`, `river-of-souls`, `lake-temple`, `sacred-lake`의 non-boss·non-authored 12종을 검사했다. `output/playwright/water-audit-{1,2}.png`에서 원본160px와32px를 직접 확인했고, 12개 PNG SHA가 manifest와 일치했다. Production 이름·특성은 `src/data/monsters.ts`와 대조했다. 이 문서는 source 검수이며 자연 조우·전투 밸런스 또는 전체254종 승인 증거가 아니다.

## 확인된 수정 대상

| 중요도 | 이름 | 관찰과 교정 방향 |
| --- | --- | --- |
| Important | 망각의 나가 | 뿔과 잎이 달린 나무 정령이다. 나가의 뱀형 하체·비늘 등 종족을 읽을 수 있는 몸체가 필요하다. |
| Important | 심연 크라켄 | 불꽃 얼굴과 장식선이며 두족류 몸체가 없다. 머리·실제 촉수가 연결된 수중 크라켄 실루엣이 필요하다. |
| Important | 심해 기도사 | 왕관·화염을 든 불의 군주로 보인다. 심해 기도자 역할과 수중 재질·의식 도구를 몸체에 통합한다. 특정 종족을 임의로 강제하지 않는다. |
| Important | 어비스 리바이어던 | 불붙은 꼬리의 짧은 육상 도마뱀이다. 지느러미·긴 수중 몸체 등 리바이어던의 수중 생물 방향이 필요하다. |
| Important | 한 맺힌 망자 | 살아 있는 녹색 나무 정령이다. 망자의 유령성·원한을 읽을 수 있는 몸체가 필요하며 나무 정령 색상 변경만으로 닫지 않는다. |
| Important | 해류 파수꾼 | 불꽃 정령에 장식선만 추가되어 있다. 해류와 파수 역할을 실루엣·장비 또는 물의 형태에 연결한다. |
| Contextual | 수련 님프 | 날개 달린 녹색 꽃 요정은 자연 정령과 맞지만 수련·수면 맥락은 약하다. 명백한 종족 충돌로 단정하지 않는다. |
| Contextual | 익사한 기사 | 유령 갑옷·검은 맞으나 익사·수중 흔적은 약하다. |
| Contextual | 저주받은 어부 | 창을 든 거북 여행자이며 어부의 도구·저주 표현이 약하다. 종족이 거북이라는 이유만으로 오류로 분류하지 않는다. |
| Contextual | 호수 수호자 | 유령 갑옷과 검으로 수호자 역할은 가능하나 호수의 맥락은 약하다. 살아 있는 인간을 요구하지 않는다. |
| 명백한 충돌 없음 | 강의 요괴 | 거북형 무장 요괴는 이름의 허용 범위에 있다. 전체 디자인 승인으로 확대하지 않는다. |
| 명백한 충돌 없음 | 흡혼 해골 | 해골·장비는 이름과 맞다. 흡혼 연출과 자연 전투는 별도 미검증이다. |

반복된 독립 corner/meter 장식은 기존 prototype의 공통 style debt로 남는다. 위 분류는 장식 유무보다 몸체·재질·역할의 명백한 충돌을 우선한다.

## 검사 시점 SHA-256

| 이름 | Runtime path | SHA-256 |
| --- | --- | --- |
| 강의 요괴 | /assets/monsters/catalog/monster-f11406bcaf00.png | fad74101e3af977a6bed8dc885566dc783e6b973c400fcb71e4c364e2e5b46da |
| 망각의 나가 | /assets/monsters/catalog/monster-3c3af718b4e5.png | 157ca31088d7151efadd2bb8d7f678fc43af3dac8a40a95e6beea1855476156a |
| 수련 님프 | /assets/monsters/catalog/monster-70b7adba43b9.png | 0b0e3d1bf8f7fa0562cdeea4c5ac3b3c1205fa0a2a06afb5911a7b18fd051de4 |
| 심연 크라켄 | /assets/monsters/catalog/monster-10a5124e4c85.png | f5f2f0cada7955a3ca8a069730b9082c7888f5f93231513db52f3aeb40bd1233 |
| 심해 기도사 | /assets/monsters/catalog/monster-44fb1b6be751.png | 54bbd7d24677aa6f48b17d469eff55659f60c7847be8f176b09194639a92e5c5 |
| 어비스 리바이어던 | /assets/monsters/catalog/monster-1abc00bd9cc6.png | 16272ce161c667b4dcb392324f1e0dd408cf4ac5c54d4a847ff90f0ecfadb43b |
| 익사한 기사 | /assets/monsters/catalog/monster-2592649153a9.png | e3df684b6b6ac7947cd750ec801a81e821fea7c8e68916e1c4ed4e7dc3836d57 |
| 저주받은 어부 | /assets/monsters/catalog/monster-7950c7898939.png | fea1ea985b2a66e191a35b525184143987433491fdb2a91a603ec69f51748fc5 |
| 한 맺힌 망자 | /assets/monsters/catalog/monster-f70c5593d86e.png | 38a1d5af007e706e74634586a90a3fceffa80fb8e913acdbc7a31342c29fdd9c |
| 해류 파수꾼 | /assets/monsters/catalog/monster-611198ce96b6.png | dbdc05c54968de88e26f5e7326c997ef2334ee1b65d1f7c93e428707a39420a6 |
| 호수 수호자 | /assets/monsters/catalog/monster-8b0a61414b4b.png | 48d87f3a22c061a97ada8e64dd3a25ef4c1226667cbf4ccf82f0458776780830 |
| 흡혼 해골 | /assets/monsters/catalog/monster-5a11b2b511c4.png | ebe2da7af45ee69c89529afaac746b249f9050255a9c9faba55a1ab295a8ccee |

## 다음 단계

현재 v10 full gate와 분리한 후속 6종 교정이다. 원본 보존 → 개별 디자인 → 실제 크기 검수 → TDD adoption → canonical 화면 검증 순서로 진행한다. 이 감사에서는 runtime·게임 수치·save·source manifest를 변경하지 않았다. Contextual4는 별도로 검토하며 자동 재제작을 승인한 것으로 해석하지 않는다.

