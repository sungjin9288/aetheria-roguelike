import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import StatsPanel from '../src/components/StatsPanel.tsx';
import FieldStage from '../src/components/field/FieldStage.tsx';
import { MSG } from '../src/data/messages.ts';
import { DEATH_LORE } from '../src/data/deathLore.ts';
import { MAPS } from '../src/data/maps.ts';
import { createCurrentRunProgress } from '../src/utils/runProgress.ts';
import { getChapterOf } from '../src/utils/chapters.ts';
import { DEATH_LORE_TOTAL } from '../src/utils/deathLore.ts';
import { makePlayerFixture, renderStatic, sliceElementByTestId } from './helpers/render.ts';

/**
 * 2026-11 B1 · B6 P1 (명세 `docs/CHAPTER_RECAP_DEATH_LORE_SPEC_2026-11.md` §1.6 · §2.5):
 *   능력치 탭 '이번 여정의 장'(원정 밖 결산 포함, 최신이 먼저) · '돌기둥의 증언 N/46'(첫 증언 뒤에만, 들은 문장만) ·
 *   필드 무대 장 칩(표시 도출, 길 잃은 여행에서 숨김).
 */

const recap = (chapter, expeditionId) => ({
    chapter, passed: [], expeditionId, levelFrom: chapter, levelTo: chapter + 4, explores: 4, kills: 7, bossKills: 0, relics: 0, moments: [],
});

const withRecaps = (recaps) => {
    const base = createCurrentRunProgress({});
    const player = makePlayerFixture({ level: 12 });
    return {
        ...player,
        stats: { ...player.stats, currentRun: { ...base, chapters: { reached: 5, mark: base.chapters.mark, recaps } } },
    };
};

const testIds = (html, id) => [...html.matchAll(new RegExp(`data-testid="${id}"[^>]*data-chapter="(\\d+)"`, 'gu'))].map(([, n]) => Number(n));

test("능력치 탭 '이번 여정의 장': 결산이 없으면 묶음이 없다", () => {
    const html = renderStatic(createElement(StatsPanel, { player: withRecaps([]), stats: null }));
    assert.ok(!html.includes('data-testid="stats-chapter-recaps"'));
});

test("능력치 탭 '이번 여정의 장': 원정 밖(expeditionId null) 결산을 포함해 전부, 최신이 먼저", () => {
    const html = renderStatic(createElement(StatsPanel, { player: withRecaps([recap(1, null), recap(2, 'e1'), recap(3, 'e2'), recap(4, null)]), stats: null }));
    const section = sliceElementByTestId(html, 'stats-chapter-recaps');
    assert.ok(section.includes(MSG.STATS_CHAPTER_RECAPS_HEADING));
    assert.ok(section.includes(MSG.STATS_CHAPTER_RECAPS_COUNT(4)));
    assert.deepEqual(testIds(section, 'stats-chapter-recap-card'), [4, 3, 2, 1], '원정 정리 시트와 달리 칸 상한이 없다');
    assert.ok(!section.includes('debrief-chapter-recap'), '원정 정리 시트의 이름을 쓰지 않는다');
});

test("능력치 탭 '돌기둥의 증언': 첫 증언 전에는 존재를 알리지 않는다", () => {
    const player = makePlayerFixture();
    const html = renderStatic(createElement(StatsPanel, { player: { ...player, stats: { ...player.stats, deathLore: [] } }, stats: null }));
    assert.ok(!html.includes('data-testid="stats-death-lore"'));
    assert.ok(!html.includes(MSG.STATS_DEATH_LORE_HEADING));
});

test("능력치 탭 '돌기둥의 증언': 들은 순서로 문장만, 듣지 않은 줄 · 모르는 id는 그리지 않는다", () => {
    const heard = [DEATH_LORE[5], DEATH_LORE[0], DEATH_LORE[12]];
    const player = makePlayerFixture();
    const ledger = [heard[0].id, 'unknown-id', heard[1].id, heard[2].id];
    const html = renderStatic(createElement(StatsPanel, { player: { ...player, stats: { ...player.stats, deathLore: ledger } }, stats: null }));
    const section = sliceElementByTestId(html, 'stats-death-lore');
    assert.ok(section.includes(MSG.DEATH_LORE_COUNT(3, DEATH_LORE_TOTAL)));
    const lines = [...section.matchAll(/data-testid="stats-death-lore-line"[^>]*>([^<]*)</gu)].map(([, text]) => text);
    assert.deepEqual(lines, heard.map((line) => line.text.replaceAll('"', '&quot;')));
    for (const unheard of DEATH_LORE.filter((line) => !heard.includes(line))) {
        assert.ok(!section.includes(unheard.text.replaceAll('"', '&quot;')), unheard.id);
    }
    // 계승 기록 아래에 있다.
    assert.ok(html.indexOf('data-testid="stats-legacy-records"') < html.indexOf('data-testid="stats-death-lore"'));
});

const chapterRegion = Object.keys(MAPS).find((name) => getChapterOf(name) === 3);
const safeRegion = Object.keys(MAPS).find((name) => MAPS[name].type === 'safe');

test('필드 무대 장 칩: 장 지역이면 N장, 장이 아닌 곳 · 길 잃은 여행이면 없다', () => {
    assert.ok(chapterRegion && safeRegion);
    const render = (overrides) => renderStatic(createElement(FieldStage, { player: makePlayerFixture(overrides), logs: [] }));
    const field = render({ loc: chapterRegion });
    assert.match(field, /data-testid="field-stage-chapter"[^>]*>3장</u);
    assert.ok(!render({ loc: safeRegion }).includes('field-stage-chapter'), '안전지대는 장이 아니다');
    assert.ok(!render({ loc: chapterRegion, challengeModifiers: ['blindMap'] }).includes('field-stage-chapter'), '길 잃은 여행');
});
