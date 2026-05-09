import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 396: StatsPanel `syn.name` silent undefined render 정리
 *   (cycle 222-395 silent dead config 시리즈 159번째 — silent dispatch lens 회귀).
 *
 * 발견 (1 silent undefined read):
 * - src/components/StatsPanel.tsx line 325-326: `<div key={syn.name} ...>{syn.name}</div>`.
 * - syn은 `stats.activeSynergies` (getActiveRelicSynergies 반환) — 즉 RELIC_SYNERGIES entry 그대로.
 * - RELIC_SYNERGIES entry 구조: `{ label, requires, bonus, desc }`. **`name` 필드 없음**.
 * - 결과: `syn.name`은 항상 undefined → React key 충돌 + UI에 시너지 이름 빈 칸 렌더.
 * - cycle 394 코멘트가 "syn.name 사용"이라고 잘못 추정한 부분 — 실제로는 silent UI 결손.
 *
 * 패턴 (cycle 222-395 시리즈 159번째):
 * - cycle 193 (SEASON_XP.codexDiscover dispatch 0건 fix) / cycle 218 (victory 사운드)
 *   silent dispatch lens 변형 — read 사이트는 있으나 producer 없어 결과 silent.
 * - cycle 396: StatsPanel render에서 정의된 필드(label) 대신 미정의(name)를 read.
 *
 * 수정 (src/components/StatsPanel.tsx):
 * - line 325 React key: `syn.name` → `syn.label`.
 * - line 326 표시 텍스트: `{syn.name}` → `{syn.label}`.
 *
 * 회귀 가드:
 * - getActiveRelicSynergies 동작 / RELIC_SYNERGIES schema (label) 보존.
 * - StatsPanel은 'cycle 394 RELIC_SYNERGIES id 0건'에 영향 없음.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 396: StatsPanel syn.name 0건 (silent undefined 제거)', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    // synergy block 추출 — activeSynergies map 영역
    const blockStart = source.indexOf('stats.activeSynergies.map');
    const blockEnd = source.indexOf('</div>\n                    ))}', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/syn\.name/.test(block),
        'StatsPanel synergy 블록에서 syn.name 0건');
});

test('cycle 396: StatsPanel syn.label 사용 (fix 검증)', async () => {
    const source = await readSrc('src/components/StatsPanel.tsx');
    const blockStart = source.indexOf('stats.activeSynergies.map');
    const blockEnd = source.indexOf('</div>\n                    ))}', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(/syn\.label/.test(block),
        'syn.label로 변경됨');
    assert.ok(/syn\.desc/.test(block),
        'syn.desc 보존 (RELIC_SYNERGIES 필드)');
});

test('cycle 396: RELIC_SYNERGIES label 필드 producer 보존 (회귀 가드)', async () => {
    const { RELIC_SYNERGIES } = await import('../src/data/relics.js');
    for (const syn of RELIC_SYNERGIES) {
        assert.ok(typeof syn.label === 'string', `${syn.bonus?.effect || '?'} label string`);
        assert.equal(syn.name, undefined, 'name 필드는 RELIC_SYNERGIES에 미정의');
    }
});

test('cycle 395 회귀 가드: WEAPONLESS_ADVENTURER_SPRITES 0건 보존', async () => {
    const source = await readSrc('src/utils/avatarSpriteCandidates.ts');
    assert.ok(!/WEAPONLESS_ADVENTURER_SPRITES/.test(source),
        'cycle 395 WEAPONLESS_ADVENTURER_SPRITES 0건 보존');
});
