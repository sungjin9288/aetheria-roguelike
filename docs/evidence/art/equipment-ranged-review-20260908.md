# 일반 활11·창/낫11·채찍1 시각 검수

Owner가 `scripts/art_sources/equipment/v2/weapon-ranged-magic/`의 bow-01/02, lance-01/02, whip-01 원본5장을 각각 열고 batch JSON 이름/row-major 순서와 대조했다. 활11과 창/낫11, 채찍1을 나눠 검수했다. Staff24는 이 범위에서 제외한다.

## Exact names

- Bow01: 나뭇가지 활, 단궁, 바람의 활, 복합궁, 불사조의 활, 빙결 장궁.
- Bow02: 사냥꾼의 장궁, 사냥꾼의 활, 에테르 심판궁, 엘프의활, 천공의 활.
- Lance01: 병사의 창, 빙원의 장창, 세계수 절멸창, 수정 창, 심연 파쇄창, 심해의 창.
- Lance02: 용살자의창, 정예병의 창, 죽음의 낫, 차원 붕괴창, 폭풍의 창.
- Whip01: 독아 채찍.

## Observations

활은 휘어진 활대와 시위, 창은 긴 자루와 찌르기 날, 죽음의 낫은 큰 옆방향 곡선날, 채찍은 유연하게 휘어진 가시 줄로 읽힌다. 이 묶음에서 석궁은 없었다. 나뭇가지 활의 가지/끈, 불사조 불꽃, 빙결 장궁 얼음, 천공 활 날개, 세계수 창 목질, 심연 창 어두운 중앙, 폭풍 창 흐르는 장식 등 이름별 큰 특성을 확인했다.

가는 활대/창대/채찍은 해당 물체의 구조이며 대검의 body mass 부족과 같은 기준으로 오류 처리하지 않는다. 32px에서는 일반 활의 시위·덩굴과 채찍 가시의 미세 형태가 약하고, 밝은 중앙 장식이나 바깥 실루엣 중심으로 읽힌다. 이름 없이 모든 동종을 독립 식별한다는 주장은 하지 않는다. 명확한 물체 형태 모순·cell 침범·실제 icon clipping을 발견하지 않았다.

## Runtime evidence

`output/s5-offhand-review.html?cohort=ranged`는 authoritative batch의 staff 제외23개 canonical 이름과 actual ItemIcon/CSS를 사용한다. 390×844 6group에서 총69이미지(32/46/96px)의 decode와 overflow 검사를 통과했다. Owner가 `output/playwright/s5-ranged-0-390x844.png`부터5까지 모두 직접 확인했다. Raw `/tmp/aetheria-ranged-capture.log` 보존. Browser만 종료했고 fresh gameplay save/dev4430은 유지했다.

Production/source/runtime/native를 수정하지 않았다. 이는 component 검수이며 자연 획득·장착·fallback·device 검증이 아니다. 오래된 `output/equipment-catalog.json` 분류 대신 현재 batch/provenance를 사용했다. 남은 원거리·마법 supplemental 검수는 staff24다.
