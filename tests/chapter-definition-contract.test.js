import test from 'node:test';
import assert from 'node:assert/strict';

import { CHAPTER_BANDS } from '../src/data/chapters.js';
import { MAPS } from '../src/data/maps.js';
import { getChapterOf, getChapterRegions } from '../src/utils/chapters.js';
import { getMapRouteGate } from '../src/utils/mapRouteGate.js';

/**
 * 2026-11 B1 장 정의 (소유자 결정 2026-11-09 — 명세 `docs/CHAPTER_RECAP_DEATH_LORE_SPEC_2026-11.md` §1.2):
 * 장 = 사냥 지역을 경로 게이트로 묶은 것. 지도가 바뀌어 장 번호가 움직이면 이 골든이 붉어져 의도적 갱신을 요구한다.
 */
const GOLDEN = {
    1: ['고요한 숲', '서쪽 평원', '호수의 신전', '잊혀진 폐허'],
    2: ['신성한 호수', '버려진 광산', '고대 하수도', '어둠의 동굴', '수정 동굴'],
    3: ['바람의 고원', '화염의 협곡', '몰락한 전초기지', '화염의 사원'],
    4: ['용의 둥지', '고대 마법 탑'],
    5: ['피라미드', '얼음 성채', '북부 설원', '빙하 심연', '기계 폐도', '암흑 성', '폐기된 연구소', '저주받은 묘지', '용암 지대'],
    6: ['천공 정원', '세계수 숲', '폭풍의 고원'],
    7: ['어둠의 지하 감옥', '지하 미궁'],
    8: ['마왕성'],
    9: ['고대 신전 도시', '심해 회랑', '공중 신전', '영혼의 강'],
    10: ['붕괴된 마법 요새', '금지된 도서관'],
    11: ['에테르 관문', '차원의 균열 전초기지', '에테르 폐허', '공허의 회랑', '종말의 전장', '차원의 틈새'],
};

test('장 표 골든: 지역 → 장(명세 §1.2)', () => {
    const regions = getChapterRegions();
    const sorted = (list) => [...list].sort();
    assert.deepEqual(Object.keys(regions).map(Number).sort((a, b) => a - b), Object.keys(GOLDEN).map(Number));
    for (const [chapter, names] of Object.entries(GOLDEN)) {
        assert.deepEqual(sorted(regions[chapter]), sorted(names), `${chapter}장`);
    }
});

test('장 번호는 경로 게이트와 단조이고, 장마다 게이트 하한 이상이다', () => {
    const rows = Object.keys(MAPS)
        .map((name) => ({ name, chapter: getChapterOf(name), gate: getMapRouteGate(MAPS, name)?.routeGateLevel }))
        .filter((row) => row.chapter !== null);
    for (const a of rows) {
        const band = CHAPTER_BANDS.find((entry) => entry.chapter === a.chapter);
        assert.ok(a.gate >= band.minGate, `${a.name}: 게이트 ${a.gate} < ${band.minGate}`);
        for (const b of rows) {
            if (a.gate < b.gate) assert.ok(a.chapter <= b.chapter, `${a.name}(${a.gate}) > ${b.name}(${b.gate})`);
        }
    }
});

test('안전지대 · 혼돈의 심연 · 계절 지역 · 열쇠 지역 · 모르는 곳은 장이 아니다', () => {
    for (const [name, map] of Object.entries(MAPS)) {
        if (map.type === 'safe') assert.equal(getChapterOf(name), null, name);
    }
    for (const name of ['황금 왕국', '혼돈의 심연', '봄의 정원', '서리 폭풍 유적', '고대 보물고', '없는 곳', '']) {
        assert.equal(getChapterOf(name), null, name);
    }
    assert.equal(getChapterOf(undefined), null);
});

test('장 이름: 11개 · 번호 순 · 게이트 하한 증가 · 지역 이름 전체 문자열을 담지 않는다', () => {
    assert.equal(CHAPTER_BANDS.length, 11);
    CHAPTER_BANDS.forEach((band, index) => {
        assert.equal(band.chapter, index + 1);
        if (index > 0) assert.ok(band.minGate > CHAPTER_BANDS[index - 1].minGate);
        for (const name of Object.keys(MAPS)) assert.ok(!band.name.includes(name), `${band.name} ⊃ ${name}`);
    });
});
