# 일반 검24 시각 검수 — 암흑의 대검 교정 완료

최신: 해당 Important는 원본 보존 교정·actual32/46/96·실제 장착/저장/reload·full/native 및 최종 Sol/xhigh C0/I0로 해소됐다. `dark-greatsword-adoption-20260908.md`에 exact1 runtime 변경/다른228 불변과 패키지329-path 증거를 기록했다. 아래 교정 전 판정은 원인과 당시 상태의 이력이다. 전체 장비 조합·실기기 완료를 뜻하지 않는다.

후속 독립 Sol/xhigh 판정: **Critical0/Important1/Minor0**. 암흑의 대검은 source부터 rapier/needle silhouette여서 2H 대검 body mass가 사라지는 semantic mismatch로 확정했다. 아래 판정 대기 문구는 과거다. 최소 교정은 넓고 무거운 날·분명한 guard·긴 양손 grip, 기존 검정/보라 정체성 유지다. Hands2/numeric/job/tier/설명은 그대로 둔다. 원본 보존, sword04 bottom-center 이외5cell 및 다른 sword23runtime 불변, 연관 hash/provenance/evidence 동기화와 actual ItemIcon32/46/96·장비 슬롯 재검수가 필요하다. 아직 교정은 구현하지 않았다.

Owner가 `scripts/art_sources/equipment/v2/weapon-core/weapon-core-sword-01.png`부터05까지 원본5장을 해당 batch row-major 이름과 대조했다. Source01/02의10종,03/04의9종,05의5종으로 검수했다. `output/s5-offhand-review.html?cohort=sword`의 canonical24종·production ItemIcon/CSS를 사용해32/46/96px 총72이미지 decode 및 가로 overflow 검사를 완료했다. Owner가 `output/playwright/s5-sword-0-390x844.png`부터5까지390×844 화면6장을 직접 확인했다.

## Exact scope

- 01: 강철 롱소드, 기계식 레이피어, 기사의 검, 농부의 포크, 롱소드.
- 02: 미스릴검, 사냥칼, 사막의 시미터, 수련생의 검, 양손검.
- 03: 어둠의 팔치온, 에테르 세이버, 영겁의 세이버.
- 04: 공허의 대검, 성기사의 검, 시간 파편 소드, 심판자의 검, **암흑의 대검**, 에테르 검.
- 05: 용암 대검, 차원절단자, 타락 기사의 검, 파멸의 검, 화염 사원의 검.

## Findings

농부의 포크는 여러 갈래 농기구, 기계식 레이피어는 가는 찌르기 날과 원형 장치, 사막의 시미터는 휜 날, 사냥칼은 짧고 두꺼운 단날이다. 공허/용암 대검은 넓은 대형 날, 시간 파편/에테르/차원절단자는 분절된 마법 구조로 구분된다. 원본 cell 침범이나 실제 icon crop은 발견하지 않았다. 나머지23종은 명확한 이름/물체 형태 모순을 발견하지 않았으나, 근접한 일반 검의 작은 크기 차이는 이름과 함께 읽어야 한다.

**암흑의 대검은 승인하지 않았다.** Production은 `hands:2`, tier4, 어둠, 버서커/흑마법사 전용이다. Source04 bottom-center부터 날이 극단적으로 가늘고, runtime `public/assets/equipment-exact/auto/auto-4473919467f6.png`도 같은 형체다. `s5-sword-4-390x844.png` row2에서32/46px는 거의 가는 선으로 읽히고96px에서도 대검의 넓은 날이 드러나지 않는다. 단순 decode/크기오류가 아니라 승인된 source 형상 자체를 재검토할 후보로 Sol/xhigh 독립 감사를 요청했다. 아직 severity 확정이나 새 원화·runtime 수정은 하지 않았다. 다른 대검의 넓은 형체와 비교해 작은 화면 가독성 및 대검 정체성을 판정한다.

## Boundaries

Raw `/tmp/aetheria-sword-capture.log` 보존. Source/runtime/production/native 변경 없음. 검수 browser만 종료, fresh gameplay save/dev4430 보존. 자연 획득·장착·모든 fallback·device 완료를 증명하지 않는다. 근접 weapon-core54의 source/runtime 보충 검수는 수행했지만, 위1종의 판정과 필요 시 교정은 남았다. 다음 미검수 cohort는 원거리·마법47종이다.
