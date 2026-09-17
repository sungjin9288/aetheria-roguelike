# 지역 52종 owner 검수 — 수정 필요

## Current-byte 독립 사후 감사 — 2026-09-08

Sol/xhigh가 교정 후 현재 runtime을 receipt와 다시 대조했다. 53 entries의 runtime/review output SHA mismatch0, 변경exact12/나머지41불변. `output/location-boundary-v1/review.png`의96/28px dark/light에서 이웃 오른쪽 테두리 잔상과 치우침이 해소됐고 대표 서쪽 평원390 실제 UI도 확인했다. 이 이전 결함에 대해 C0/I0이며 아래 최초 제목/지적은 역사다. 전체12 지역 자연 도달·모든 디자인·실기기 완료를 주장하지 않는다.

## ART-LOCATION-01 검증 완료 — 2026-09-07

12종 이웃 테두리 결함의 source/runtime 교정과 해당 회귀 gate를 완료했다. 이 문서의 나머지 과거 상태는 당시 기록이다. 전체 게임 디자인이나 실제 기기 완료를 선언하는 것은 아니다.

- `npm run verify:full` handle66048 exit0: unit4376/4376, typecheck/lint/build, desktop/mobile smoke, E2E59/59+58/58. 로그 `/tmp/aetheria-location-boundary-full.log`. Desktop `browser.close timeout`은 assertion 이후 비치명적 종료 경고로 기록한다.
- 실제390×844 게임 지도에서 장비 콘솔→지도→서쪽 평원 선택을 실행했다. `location-boundary-map-390x844.png`와 `location-boundary-western-detail-390x844.png`를 `output/playwright/`에 보존하고 owner가 직접 확인했다. 서쪽 평원96px 원본이32px로 정상 표시되고, 상세 선택·레벨3 잠금 안내가 일치하며 가로 overflow=false다. 시작 마을/고요한 숲도 decode 성공. 전체12종 이미지 비교와 대표 UI 검증을 구분하며,12개 지역의 자연 도달을 주장하지 않는다. 별도 QA 저장 영역을 사용했고 browser/dev server는 종료했다.
- Production `build:guard`, `cap:sync`, `mobile:doctor`, Android debug/iOS unsigned build exit0. 두 패키지의 몬스터254+지역53+대지의 심판2+main JS=310경로가 dist와 byte-identical. Native tracked drift0. `boundary-v1/native-checkpoint.json`에 정확한 SHA/경로를 기록했다.
- `boundary-v1/receipt.json`은 교정 당시의 source5/이전53/runtime53 SHA 기록이며 생성 당시의 verification-in-progress 분류를 보존한다. 전체 gate의 최종 상태는 이 절과 native checkpoint를 따른다. Historical candidate6/Toss38 aggregate는 그대로다. iPhone 설치, 기존 archive 교체, commit/push/publication은 수행하지 않았다. 배포용 signing 입력과 실기기 검증은 미완료다.

## 현재 교정 상태 — 2026-09-07

ART-LOCATION-01의 12종 runtime 교정을 적용했다. 아래 최초 감사 내용과 당시 승인 대기 상태는 역사 기록으로 보존한다. Python/Pillow 원본 보존 승인은 현재 유효하다.

`process_location_medallions.py`는 frontier/midlands/endgame의 세 번째 열만 오른쪽 경계를 x=940에서 x=920의 빈 간격으로 옮긴다. 다른 열과 normalize/background 알고리즘은 바꾸지 않았다. 이 경계는 검수한 1254×1254, 4×4 시트에만 적용하며 geometry drift는 거부한다. 원본 세 장을 직접 확인했고 각 본체 테두리와 다음 열 사이에 빈 간격이 있음을 확인했다.

`tests/location-source-boundary.test.js`는 실제 12개 crop을 처리해 오른쪽 12px에 이웃 테두리가 없고, 본체 폭과 중앙 배치가 보존되는지 검사한다. 최초 RED는 frontier index2의 `neighbor frame leaked`; 경계 교정 뒤 GREEN이다. 원본 decoded pixels 불변도 검사한다. Focused location/monster-region/art 계약 27/27와 `npm run art:verify` PASS, diff-check PASS.

모든 기존 export는 `scripts/art_sources/location-medallions/boundary-v1/previous/`에 보존했다. 별도 `output/location-boundary-v1/`에서 전체 53개를 생성한 결과 정확히 문제의 12개만 달라졌고 나머지 41개는 byte-identical이다. Map identity는 52개이고 export에는 보조 lava-zone도 있으므로, 이전 문서의 “나머지40종”과 실제 보존 파일41개를 구분한다. 그 후 12개만 runtime에 복사했다.

Owner가 `output/location-boundary-v1/review.png`의 12종을 96px/28px, 밝은/어두운 배경에서 직접 확인했다. 오른쪽 독립 테두리는 없어지고 본체는 중앙에 표시된다. 이는 Pillow 합성 비교이며 실제 게임 브라우저 화면이나 native 검증을 대신하지 않는다.

전체 gate: `/tmp/aetheria-location-boundary-full.log`, 실행 handle66048에서 `npm run verify:full` 진행 중. 이 변경 이후의 실제390×844 게임 화면·production 재빌드·native package 검증은 아직 남아 있다. 기존 v7 native checkpoint는 지역12종 교정 이전 빌드다. Progression source 목록에는 이 processor/PNG가 없어 진단 evidence는 변경하지 않았다. Commit/install/publication 없음.

## 판정

Critical 0, Important 1(공통 분리 결함, 12종 영향). 이전 독립 검토의 C0/I0는 역사 기록으로 보존하되 최종 승인으로 채택하지 않는다. 이름과 지역 소재는 52종에서 구분되지만, 파일 존재·고유 SHA·투명 여백만으로 시각 품질을 승인할 수 없다.

## 직접 확인한 증거

- `output/playwright/completion-20260907/map52-owner-{1..5}.png`: 기존 검수 HTML의 52개 카드를 12/12/12/12/4개로 나누어 owner가 모두 확인했다. 각 카드는 어두운/밝은 배경의 144px·28px 그림이다. 새 원화나 gameplay screenshot이 아니다.
- Playwright 캡처 exit0. 로컬 서버 로그에서 52개 이미지 GET200, console 오류는 favicon.ico404 한 건이다. 검수 서버는 종료했다.
- `node --import tsx --test tests/monster-region-art.test.js`: 6/6 PASS. 해당 검증은 PNG header·identity·source manifest·runtime 연결을 확인하며 분리된 잔상이나 본체의 중심을 판정하지 않는다.
- 소스 `scripts/art_sources/location-medallions/frontier.png` 원본을 직접 확인했다. 1254×1254의 세 번째 열 crop은 x=[627,940)인데, y=150과200에서 다음 그림의 테두리 x=[932,940)가 포함된다.
- 현재 export alpha≥128의 8-connected component를 read-only 분석했다. 아래 12종은 주 형체 bbox=[2,9,78,87), 오른쪽 독립 잔상 x=[91또는92,94), 높이40~42px가 남아 있다. 픽셀이나 원본은 변경하지 않았다.

## ART-LOCATION-01 / Important

영향: 서쪽 평원, 버려진 광산, 몰락한 전초기지, 화염의 사원, 얼음 성채, 고대 마법 탑, 심해 회랑, 암흑 성, 황금 왕국, 금지된 도서관, 폐기된 연구소, 공허의 회랑.

원인: `scripts/process_location_medallions.py`의 `crop_cell`은 실제 그림 경계가 아닌 동일 크기 grid를 사용한다. 인접 테두리는 어두워서 `remove_connected_background`가 제거하지 않는다. `normalize`는 잔상을 포함한 전체 alpha bbox를 기준으로 축소·정렬한다. 따라서 본체도 약76×78px로 작아지고 왼쪽으로 치우친다. 세 시트의 세 번째 열 각각4종이라는 반복 패턴과 일치한다.

수정 방향: 원본을 보존하고 정확한 cell 경계를 수정하는 source extraction 방식이 우선이다. 임의 전체 흰색 제거·UI clipping으로 숨기기·테스트 기준 완화는 하지 않는다. Python/Pillow를 통한 이미지 수정은 아직 명시적으로 승인받지 않았으므로 실행하지 않았다. 승인 후 source-level 회귀 RED, 분리 경계 교정, 12종 재추출 및 나머지40종 bytes 보존, 144/28px 재검수, art/full/native gate가 필요하다.

## 범위의 한계

지역52개는 5개 원본 시트에서 분리한 개별 아이콘이며, 52개 개별 대형 장면 원화를 제작했다는 증거는 아니다. 이번 owner 검수는 전체 fresh/mid/late 원정·기기 플레이 완료를 뜻하지 않는다. 장비229와 남은 캐릭터/몬스터 검수도 별도다.
