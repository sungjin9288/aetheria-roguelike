# Signature25 원본 검수 보충

`scripts/art_sources/equipment/v2/signature-mythic/`의 현재 item/overlay PNG **22장**을 각각 직접 열어 batch JSON row-major identity와 대조했다. 11batch, 25item+25overlay cell이다. 기존 contact sheet/작은 runtime 검수를 원본 검수로 확대하지 않고 이 보충 기록을 별도로 남긴다.

| Batch suffix | 수 | 원본에서 확인한 형태 |
|---|---:|---|
| armor-cloak-01 | 1 | 암흑 군주의 망토: 큰 견갑·긴 보라색 옷자락; overlay는 몸통이 열린 망토 |
| armor-plate-01 | 4 | 광기 붉은 눈/드래곤 금색 뿔/심해 산호/혼돈 보라 core를 가진 갑주; overlay도 해당 판금 정체성 유지 |
| armor-robe-01 | 1 | 세계수의 로브: 초록 천·나뭇가지 장식, overlay 긴 소매·옷자락 |
| offhand-book-01 | 2 | 에테르 그리모어의 사슬·보라색 표지와 천공 성전의 흰색·금색 십자 표지 |
| offhand-shield-01 | 1 | 차원 방패 이지스: 길쭉한 금속 방패 면·중앙 빛 core |
| weapon-bow-01 | 1 | 바람의 궁극: 곡선 활대·현; overlay는 가로로 회전한 활 형태 |
| weapon-dagger-01 | 2 | 그림자 절단기의 짧은 곡선 외날, 영혼 절단자의 보라 core·갈고리형 날 |
| weapon-lance-01 | 3 | 마왕의 대낫의 긴 자루·낫날, 성스러운 창의 창끝·깃발, 차원 마왕의 낫의 쌍곡선 날·차원 core |
| weapon-staff-01 | 3 | 세계수의 지팡이 나뭇가지, 신전 도시 원형 성물, 천벌 십자형 head; 긴 자루 유지 |
| weapon-sword-01 | 6 | 교정된 대지의 심판 검신, 라그나로크 용암 대검, 빙결 왕관검, 밝은 성검, 잎 모양 세계수 검, 금색 거인 대검 |
| weapon-sword-02 | 1 | 용의 화염: 불꽃 균열·뾰족한 검신·금속 guard; overlay에도 같은 정체성 |

이 범위에서 명확한 이름/몸체 모순, 다른 cell 침범이나 주 형체 절단을 새로 발견하지 않았다. 대지의 심판은 이미 교정된 canonical source를 확인한 것이다. 그림자 절단기는 짧은 curved blade이며, 이를 별도 production 길이 계약 없이 무조건 장검으로 바꾸지 않는다.

한계: item/overlay의 각도와 작은 장식은 동일 복제가 아니다. 활은 세로→가로, 단검과 창은 기울기가 달라진다. 이는 실패 대체 이미지에 쓰이는 overlay의 표현 차이이며 정상 캐릭터 착용 합성을 증명하지 않는다. 작은32px의 현·룬·사슬·산호 가지 개별 식별이나 25종 전체의 실제 fallback interaction은 이번 원본 열람으로 승인하지 않는다. 기존 actual equipment/fallback 증거와 결합하되 범위는 유지한다.

원본/runtime/gameplay 파일 수정 없음. 이 검수는 장비 229종 전체 조합, 몬스터254 현재 이미지 승인 또는 전체 게임 완성을 뜻하지 않는다.
