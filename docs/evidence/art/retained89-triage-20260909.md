# Retained89 전체 disposition — 정적 검수

Retained26 local 완료 후 현재 manifest254/corrections165에서 제외한 exact89를 다시 추출했다. `output/review-retained89.py`가 source SHA를 검사하고 기존 자료를 덮어쓰지 않는 새 `output/playwright/retained89-20260909/`에96/32px dark/light3시트와 records를 생성했다. Owner가 세 시트를 모두 직접 열어 관찰했다.

## 다음 행동을 바꾸는 결과

- 기본 형태 유지 후보20: 곤충·동물·슬라임·식물/요정·도적·구울·해골의 종/기본 역할은 읽힌다. 최종 수용은 아니며160/46/32과 실제화면 검수가 남는다.
- 교정 제안69: 같은 stone golem, hood rogue, fire lord, spectral knight, eye/flame 원형이 이름/직무 차이를 가리는 경우가 많다. 전체69가 기능 버그라는 뜻은 아니다. 시각 목표에 맞춘 제안이며 새 해부학이나 종족 설정을 기존 source 사실로 주장하지 않는다.
- 일곱 군: 재질6/직업11/경비12/기사11/시전자7/차원16/이름있는위압감6. 세부69 이름별 실루엣은 `docs/superpowers/plans/2026-09-09-aetheria-remaining-monster-art-closure.md`에 기재했다. 군 이름은 source boss flag를 바꾸지 않는다.
- 예: 고문관·신전 경비병·탑 수호자는 현재 같은 두칼 도적 계열, 마법 감시자·탐욕의 상인은 같은 오크 계열, 여러 기사는 같은 부유 갑주 계열이다. 차원 돌격대·방랑자·분열체는 주로 큰 눈/불꽃 overlay에 의존한다. 직무별 큰 도구·몸축·자세로 구분하는 설계를 제안한다.
- 이프리트의 최초 지역 조회 누락은 조회기가 단일 `map.boss` 문자열을 빠뜨렸기 때문이다. Source에는 용암 지대 boss로 연결돼 있으며, 조회기만 세 경로(monsters/bossMonsters/boss)를 포함하도록 작성했다. 런타임 결함으로 처리하지 않았다.

## 범위와 검증

초기 Markdown table 검사기는 일곱 separator 행까지 이름으로 세어76으로 실패했다. Header와 separator를 구분하도록 조회 조건을 바로잡고 이름69 exact-set 검증을 다시 통과했다. 설계 대상을 줄이거나 누락을 허용하지 않았다.

`output/retained89-disposition.mjs`는 순수 조회 CLI다. Machine-readable evidence는 `docs/evidence/art/retained89-disposition-20260909.json`이다. Exact89/currentSHA89/20+69 partition/중복0/지역누락0/설계table exact69 PASS. 기존165 corrected는 검수 대상에서 제외했다. Runtime 이미지·게임 source·수치·save·diagnostic·native는 수정하지 않았다. `git diff --check` PASS, native tracked0/index empty.

이번 turn은 progress: 잔여 전체를 한 번 분류하고 이름별69 설계를 만들었다. 새 이미지 생성·교체 승인은 아직 없고, full/native 반복 실행도 하지 않았다. 후속 구현은 사용자 승인 뒤7군 시각 검수→안정된 exact69 채택→통합full/native 순서로 진행한다. Latest completed checkpoint는 retained26이며 Goal은 active다. 실제 기기/lifecycle과 S6는 여전히 미완료다.
