# 하늘·폭풍 지역 몬스터17종 시각 감사

2026-09-07. `storm-highland`, `sky-temple`, `sky-garden`의 non-boss·non-authored17종을 검사했다. Owner가 `output/playwright/sky-audit-{1,2,3}.png`의 canonical160px와32px를 직접 검수했다. 17PNG SHA가 manifest와 일치하며 production 이름·원소 특성은 `src/data/monsters.ts`와 대조했다. Source 감사일 뿐 자연 조우·전체 카탈로그 승인 증거는 아니다.

## 결과

| 분류 | 이름 | 관찰과 교정 방향 |
| --- | --- | --- |
| Important | 광풍의 원소 | 녹색 잎·나뭇가지 정령이다. 바람의 회전·날리는 형태를 몸체에 통합한다. |
| Important | 구름 정령 | 녹색 나무 정령이다. 구름 덩어리와 부유하는 몸체로 구별한다. |
| Important | 바람 정령 | 나무 정령과 같은 몸체다. 바람 형상과 움직임 방향을 읽을 수 있어야 한다. 광풍의 원소와도 실루엣을 구별한다. |
| Important | 번개 정령 | 녹색 나무 정령이다. 번개가 몸체를 이루는 명확한 형상이 필요하며 외부 장식선만 추가하지 않는다. |
| Important | 빛결 수정체 | 얼굴·잎·나뭇가지가 있는 정령이다. 광물의 면과 결정 구조가 지배적인 몸체가 필요하다. |
| Important | 성운 감시자 | 왕관을 쓴 화염 군주다. 성운의 감시 역할을 몸체·장비에 통합하고 일반 불의 군주와 구별한다. 특정 종족을 강제하지 않는다. |
| Important | 천공 수호조 | 불붙은 꼬리·막 날개를 가진 박쥐다. 부리·깃털·새의 날개와 몸체가 필요하다. |
| Important | 폭풍 그리핀 | 불붙은 꼬리의 일반 용이다. 독수리 머리·날개와 사자형 몸체를 연결한 그리핀으로 교정한다. |
| Important | 폭풍 매 | 박쥐의 귀·얼굴·막 날개다. 매의 부리·깃털 날개·꼬리·발톱이 필요하다. |
| Important | 폭풍 세이렌 | 일반 불 박쥐다. 세이렌의 인간형 얼굴·노래하는 역할과 날개 또는 수중 몸체의 일관된 디자인이 필요하다. 세이렌의 날개형/수중형 해석은 후속 디자인에서 명시한다. |
| Important | 하늘 정령 | 녹색 나무 정령이다. 하늘·빛·공기의 몸체 방향으로 구름·바람 정령과도 구별한다. |
| Contextual | 뇌운 와이번 | 날개 달린 용의 큰 형태는 이름 범위에 있으나 불붙은 꼬리만 있고 뇌운 표현이 약하다. 정확한 팔다리 수를 게임 계약으로 임의 강제하지 않는다. |
| Contextual | 바람 드레이크 | 용의 몸체는 맞지만 화염 꼬리가 주된 속성 표현이다. 바람·활공 맥락을 별도 검토한다. |
| Contextual | 뇌운의 사냥꾼 | 무장한 갈색 rogue는 사냥꾼으로 가능하나 뇌운의 단서는 약하다. |
| Contextual | 바람 추적자 | 이도류 rogue는 추적자 역할과 양립하지만 바람 표현이 약하다. |
| Contextual | 번개 골렘 | 돌 골렘과 파란 rune는 일치 가능한 해석이나 번개·전류 표현이 약하다. 금속 몸체를 무조건 요구하지 않는다. |
| Contextual | 폭풍 수호자 | 무장한 rogue는 역할상 가능하나 수호·폭풍의 맥락을 더 구별할 필요가 있다. |

반복 corner/meter 장식은 기존 prototype의 별도 style debt다. 교정은 이름·몸체·재질의 명백한 충돌을 우선하며 맥락 보완6을 자동 재제작 목록으로 합치지 않는다.

## 검사 시점 SHA-256

| 이름 | Runtime path | SHA-256 |
| --- | --- | --- |
| 광풍의 원소 | /assets/monsters/catalog/monster-57e2ea4a579b.png | 2e49c48ca06955cebfca7eea149881bc529a8ff55e834fa799088b4bd1607e01 |
| 구름 정령 | /assets/monsters/catalog/monster-6b166f3da88c.png | dc9218b7485aa27c01a0cee43e3b87b976ff6dfb190ef58f97904b502f349733 |
| 뇌운 와이번 | /assets/monsters/catalog/monster-6e2f6db6bdca.png | 96c34483612f46d7e7fbb0f45eb4bf09ae45d0f96ae6359bfdcfd5aff3710959 |
| 뇌운의 사냥꾼 | /assets/monsters/catalog/monster-63ae5e408f3b.png | f476e3839d38bd847b07bfb0f5a28337bb19eefb4c4671e62bf018e828038b0c |
| 바람 드레이크 | /assets/monsters/catalog/monster-b9e2ceed0c47.png | b2b3824dd7f109903521ef10de98b5d42313bd16d339a6cd9f3c63220568e074 |
| 바람 정령 | /assets/monsters/catalog/monster-d41324bc0c39.png | 507a2fd41f6d1dd8c1cd9912a94d4cbc4651054e155e6e60984cb58be351dfa6 |
| 바람 추적자 | /assets/monsters/catalog/monster-6651720e2aa5.png | 4b7b0131a4fd2bd8db97c9024f41ebea802ab482520ee3100104bbe7af7b4b1d |
| 번개 골렘 | /assets/monsters/catalog/monster-afc1ba2a24bc.png | 6929a6077fc8ce85c3eaef48f1359142281a8561a9652beea62b63a5b2cdefdf |
| 번개 정령 | /assets/monsters/catalog/monster-dcc2d3af8f46.png | d2448d9a1aac8b12295465b1822027e24c63171e5cc1993f5681f0bcdaa4999a |
| 빛결 수정체 | /assets/monsters/catalog/monster-735dac0f894d.png | d68f0f6566bc6d02c8844d76712c1d8a143764beb9cb7faf86ba99207deac727 |
| 성운 감시자 | /assets/monsters/catalog/monster-37d94f499032.png | 5cfcff0ec1491f784e17442e15c85b8a8297bec24227129698011b4559698876 |
| 천공 수호조 | /assets/monsters/catalog/monster-d4edd07203c8.png | 7ed53250b2b912beaf4a132e9baad678b61b9c392497a23deb22bdbb4f6205bb |
| 폭풍 그리핀 | /assets/monsters/catalog/monster-bbd8808afc36.png | ca0b92fa71fa75a40e212218d9ad15393702c21f7fb831c5ffcb770592a247ac |
| 폭풍 매 | /assets/monsters/catalog/monster-e031d34c6b86.png | e2ecedd1f3094c5265bc5a83e9505f2308517142ab77a1f4bf5848e8e8de1965 |
| 폭풍 세이렌 | /assets/monsters/catalog/monster-2ca7828456ee.png | 44bff66028a5c2d18ef7d1cbfb42045d7ee8ab23e08863a2ffad3117aa9d3da5 |
| 폭풍 수호자 | /assets/monsters/catalog/monster-5424972b69b1.png | 0806b28aabf2908273ca7e369905c6bacf4d1fe3d54eeda8a0e4089f5e33f9dc |
| 하늘 정령 | /assets/monsters/catalog/monster-df633d29c087.png | 54ffdff84fdf371098788e4ca5b824a18422e86e191720ff7b6475def9e9c69f |

## 후속 범위

11 Important는 현재 v11 수중6 full28177과 분리한 다음 교정 후보군이다. 원본보존·개별 디자인·작은 화면 검수·TDD adoption·actual surface 순서로 진행한다. 이 감사로 runtime·gameplay·save·진단 source pin은 변경하지 않았다. Whole-game Goal과 나머지 카탈로그 감사는 여전히 미완료다.

