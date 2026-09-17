# 암흑의 대검 — broad-blade correction

## 최종 local checkpoint

Full26974, cap/doctor87969, Android83772, iOS9221 모두 exit0. Unit4416, E2E117, 두 smoke, art/content/equipment gates 및 독립 Sol/xhigh C0/I0. 기존328-path verifier와 추가 대검 PNG 비교로 **패키지별329 경로**(monster254/location53/character18/EarthVerdict2/dark sword1/mainJS1)가 public/dist/APK/iOS App과 일치함을 확인했다. Source audit와 직접 장착 검증 범위는 아래에 기록했다.

- Android: `android/app/build/outputs/apk/debug/app-debug.apk`, 225984784bytes, SHA `a22bf356f30ba6cbef19de877fbce4c66ac62c3e36bcb10da4c6b1f29793812f`.
- iOS unsigned: `/tmp/aetheria-dark-ios.JVheQz/Build/Products/Release-iphoneos/App.app`.
- Main: `assets/index-DMA63Uzn.js`, SHA `db639528d6a3696d24f83bf38cbb8f0944ce42a9604232571e380c0b3c867beb`.
- Native tracked drift0, HEAD `38a358454bfeb689cebf2a80c33478ac86371105`, index empty.
- Historical candidate6 SHA `ac1956ad67087ddeae0cd1af85e57eee7a6bf94d3afb81b00a823f2ceb5ea0dd`, Toss38 SHA `0f870e56774c46dcbd477ceda6e9c6c1f312a4a7dec3f84ad10b3342934d5b5c` 불변.
- Logs: `/tmp/aetheria-dark-{full-final,cap,doctor,android,ios,native-verification}.log`. Verifier: `python3 output/verify-v8-native.py /tmp/aetheria-dark-ios.JVheQz` (328), plus dark runtime exact SHA and zip/App/public/dist comparison (1).

이번 1종 교정은 local 완료다. iPhone 설치·실기기 화면·서명 배포·전체 게임 Goal 완료는 별도이며 수행하지 않았다. 아래 진행 중 문구는 이 최종 checkpoint 이전의 이력이다.

## 구현과 보존

독립 Sol/xhigh가 기존 canonical 양손 대검의 needle silhouette를 Important로 판정했다. 새 원화와 이전 sheet/runtime는 `scripts/art_sources/equipment/v3/dark-greatsword/`에 보존했다. Candidate는 32/46/96px 독립 검토에서 교정 승인됐고, 일반 processor의 명시적 replacement 확장도 Critical 0 / Important 0이었다.

`process_equipment_art_batch.py --replace-existing`은 기존 output SHA, batch/catalog/cohort/ordered identities/cell/runtimePath/source basename을 확인한다. 기본 호출은 conflict를 계속 거부한다. Missing batch, source collision, output drift는 쓰기 전에 중단하며, exact replay/dry run과 기존 staged rollback을 유지한다. Historical generationReview는 수정하지 않는다.

정상 processor와 manifest sync로 canonical에 반영했다. 전체 229 runtime의 preimage 비교에서 **암흑의 대검 1개만 변경, 나머지 228개 불변**이다. Source sheet의 bottom-center만 교체됐고 다른 5 cell은 동일하다. Manifest는 같은 sheet를 참조하는 6개 record의 source hash, 대상 1개의 export hash만 변경됐다. 다른 manifest fields, provenance의 다른 batch와 generationReview는 불변이다. 장비 수치·hands2·job·save schema는 변경하지 않았다.

- 이전 source SHA: `b8de8917866933ac05976ee4573676e5b3cc379e23049e83ca1a46ccc706aacc`
- 새 source SHA: `f1dcefa9c5219f40775058c62d465a2c34a564f15f8163a8433fb10529e6f9c5`
- 이전 runtime SHA: `f7ba4e202df3c21da330971cfd9112c03b12eda59c1f834fb70db5f48672af6a`
- 새 runtime SHA: `2e1d2c19bdfd3b49b3381cee405653d844cbc05c9fef70cbb4a4b26f1e0b90e5`
- 실행 preimage: `/tmp/aetheria-dark-adopt.8Q65Hf/` (local 보존, durable 원본은 위 v3/previous)

## 검증

- Replacement 신규2개 테스트 RED→GREEN, metadata/history/collision regression 추가.
- 실제 finalized weapon-core54 임시 복제 rehearsal: 대상만 변경, 다른53 출력/다른 batch/history 유지, replay byte-identical, manifest sync PASS.
- Canonical adoption assertion RED→GREEN. Pipeline+source **111/111 PASS**: `/tmp/aetheria-dark-canonical-green.log`.
- `art:verify` PASS: `/tmp/aetheria-dark-art.log`.
- Actual ItemIcon32/46/96, 390×844: `output/playwright/dark-greatsword-adopted-390x844.png`. 12 images decode, overflow0, request interception 없이 canonical URL 사용. QA HTML favicon404 1건은 item decode 실패가 아니다.
- 실제 장비 UI: `output/playwright/dark-greatsword-equipped-390x844.png`. 별도 browser context에서 합법적인 버서커 fixture → 장착 클릭 → 저장 → reload → 장비 콘솔 확인. hands2/offhand null/overflow0/pageError0. `output/dark-greatsword-equipment.ts`, `/tmp/aetheria-dark-equipment-final.log`가 재현 경로다. 자연 획득·실기기 검증은 아니다. 초기 시도는 콘솔을 열기 전 가방 버튼을 찾다가 timeout됐으며, 화면을 확인해 순서를 교정했다. 기존 fresh save는 건드리지 않았다.
- 첫 `verify:full`: 4415/4416, progression evidence source hash mismatch 1건. Canonical evidence writer 실행 후 **equipmentArtManifest source pin만 변경, report/reportHash/v1Baseline 등 나머지 필드 불변** 확인. `/tmp/aetheria-dark-full.log`, `/tmp/aetheria-dark-diagnostic-write.log`.

## 남은 gate

Full26974 **exit0**: unit4416/4416, E2E59+58, desktop/mobile smoke, type/lint/build guard PASS. Desktop browser-close는 기존 guard에서 timeout warning으로 기록됐으며 test 실패는 아니다. Cap sync와 mobile doctor87969 exit0. Android debug83772와 iOS unsigned9221 빌드 진행 중; iOS DerivedData `/tmp/aetheria-dark-ios.JVheQz`. Android release signing 자료는 없으므로 debug/unsigned 검증을 signed delivery로 해석하지 않는다. 아래 full 실행 중 문구는 이전 상태다.

최종 adoption 독립 Sol/xhigh 감사 완료: **Critical 0 / Important 0**. Source 5개 이웃 cell, 나머지228 runtime, manifest/history 및 diagnostic 불변 범위를 별도 비교했고 두 실제 화면을 확인했다. 기존 시각 Important는 이 1종 범위에서 해소됐다. 아래 full/native 미완료는 여전히 유효하며 최종 adoption 감사 대기 표시는 이 결과로 대체한다.

갱신 후 `verify:full` 실행 중: `/tmp/aetheria-dark-full-final.log`. 후속 full 결과, 관련 equipment/content gates, native packaging 및 최종 adoption 감사는 아직 미완료다. 최신 검증 native는 기존 vitals checkpoint이며 이번 이미지를 포함하지 않는다. 설치·commit·push·publication 없음. 전체 게임 완성 Goal은 계속 진행 중이다.
