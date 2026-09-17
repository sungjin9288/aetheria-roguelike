# 일반 주문서·마도서·서판 5종 시각 검수

## 범위와 방법

Canonical `offhand-headgear-book-01`의 견습 주문서, 룬 마도서, 심연의 마도서, 쌍두 마도서, 현자의 서판을 검수했다. Owner가 source sheet를 열어 batch JSON의 row-major 이름과 대조한 뒤, 실제 `ItemIcon`·canonical item 조회·production CSS를 사용하는 `output/s5-book-review.html`에서 32/46/96px 세 크기를 확인했다. Source나 runtime PNG는 수정하지 않았다.

원본: `scripts/art_sources/equipment/v2/offhand-headgear/offhand-headgear-book-01.png`, SHA-256 `1248a469988b8b69ee2b8aa807953e2d099b7e917851ec6a6e5842a5f87098cd`.

## 결과

- 견습 주문서: 양쪽 말린 끝과 펼친 양피지 형태가 세 크기에서 유지된다.
- 룬 마도서: 푸른 닫힌 표지·책등·금색 문양이 읽힌다. 작은 크기에서는 문양 세부보다 책 실루엣이 중심이다.
- 심연의 마도서: 어두운 책과 보라색 중심 장식·쇠사슬의 큰 구조가 유지된다. 32px에서는 쇠사슬의 개별 고리와 표지 세부가 뭉개지지만 책 외곽이 배경과 분리된다.
- 쌍두 마도서: 붉은 면/푸른 면의 이중 표지와 가운데 결합부가 보인다. 색뿐 아니라 중앙 분할된 구조가 유지된다.
- 현자의 서판: 각진 회색 석판·테두리·중앙 각인으로 책들과 구분된다.

실제 390×844 화면의 15개 primary 이미지가 decode되고, 가로 overflow는 없었다. Icon 크기는 outer box 기준이며 내부 PNG는 padding만큼 작게 표시된다. Owner가 `output/playwright/s5-book-review-390x844.png`를 직접 확인했다. Screenshot SHA-256 `cbdcf85d5f46c3c7034cbfb0c7b1b53597a1afaf074fd93f0a25d3f2224c4c87`. 해당 5종에서 명확한 이름/형태 모순이나 clipping 결함을 발견하지 않았다.

## 한계와 보존

이는 source 및 실제 component 크기 검수다. 자연 획득·장착·캐릭터 합성·기기 설치 또는 장비229종 전체 품질 완료를 증명하지 않는다. 이미지 fallback도 이번 검수 대상이 아니다. Raw `/tmp/aetheria-book-proof.log` 보존. 별도 `s5-book-review` browser만 종료했으며 fresh gameplay profile과 dev4430은 보존했다. Production 변경·commit·install은 없다.
