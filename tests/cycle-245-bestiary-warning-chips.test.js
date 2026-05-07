import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 245: BOSS_BRIEFS의 warningChips / recommendedBuilds dead config fix
 *   (cycle 222-244 silent dead config 시리즈 17번째).
 *
 * 발견 (UX dead config):
 * - src/data/monsters.ts BOSS_BRIEFS: ~25 bosses가 warningChips (전투 키워드 hints,
 *   예: "화상 누적", "강타 폭증")와 recommendedBuilds (추천 빌드, 예: "방패 요새",
 *   "비전 공명")를 정의.
 * - src/utils/runProfile.ts getBossBriefing이 두 필드를 read해 returned 구조에 합산
 *   (line 506-507).
 * - 그러나 Bestiary.tsx와 MonsterCodex.tsx 모두 bossBrief의 'signature' / 'counterHint' /
 *   'phaseHint'만 render하고, warningChips와 recommendedBuilds는 dispatch 0건.
 * - 결과: 데이터 정의 + flow는 살아있지만 UI 표시 0건 — 플레이어는 보스별 위협
 *   키워드/추천 빌드를 영원히 못 봄.
 *
 * 패턴 (cycle 222-244 silent dead config 시리즈 17번째):
 * - cycle 222-244: 데이터 정의 vs dispatch 누락 lens.
 * - cycle 245: UI render 누락 lens (data → util → struct 까지는 살아있고 UI surface만 dead).
 *
 * 수정:
 * - Bestiary.tsx의 bossBrief 블록에 warningChips / recommendedBuilds 칩 그룹 2개 추가.
 * - MonsterCodex.tsx 동일 패턴 추가.
 *
 * 회귀 가드:
 * - 기존 signature / counterHint / phaseHint 표시 유지.
 * - 빈 배열 시 섹션 미표시 (silence over noise).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 245: Bestiary가 warningChips를 render', async () => {
    const source = await readSrc('src/components/Bestiary.tsx');
    assert.ok(/bossBrief\.warningChips/.test(source),
        'Bestiary는 m.bossBrief.warningChips를 read해야 함');
    assert.ok(/warningChips[\s\S]{0,200}\.map/.test(source),
        'Bestiary는 warningChips를 .map으로 칩 렌더해야 함');
});

test('cycle 245: Bestiary가 recommendedBuilds를 render', async () => {
    const source = await readSrc('src/components/Bestiary.tsx');
    assert.ok(/bossBrief\.recommendedBuilds/.test(source),
        'Bestiary는 m.bossBrief.recommendedBuilds를 read해야 함');
    assert.ok(/recommendedBuilds[\s\S]{0,200}\.map/.test(source),
        'Bestiary는 recommendedBuilds를 .map으로 칩 렌더해야 함');
});

test('cycle 245: MonsterCodex가 warningChips를 render', async () => {
    const source = await readSrc('src/components/codex/MonsterCodex.tsx');
    assert.ok(/bossBrief\.warningChips/.test(source),
        'MonsterCodex는 m.bossBrief.warningChips를 read해야 함');
    assert.ok(/warningChips[\s\S]{0,200}\.map/.test(source),
        'MonsterCodex는 warningChips를 .map으로 렌더해야 함');
});

test('cycle 245: MonsterCodex가 recommendedBuilds를 render', async () => {
    const source = await readSrc('src/components/codex/MonsterCodex.tsx');
    assert.ok(/bossBrief\.recommendedBuilds/.test(source),
        'MonsterCodex는 m.bossBrief.recommendedBuilds를 read해야 함');
    assert.ok(/recommendedBuilds[\s\S]{0,200}\.map/.test(source),
        'MonsterCodex는 recommendedBuilds를 .map으로 렌더해야 함');
});

test('cycle 245: Bestiary 기존 signature / counterHint / phaseHint 표시 회귀 가드', async () => {
    const source = await readSrc('src/components/Bestiary.tsx');
    assert.ok(/bossBrief\.signature/.test(source), 'signature 표시 유지');
    assert.ok(/bossBrief\.counterHint/.test(source), 'counterHint 표시 유지');
    assert.ok(/bossBrief\.phaseHint/.test(source), 'phaseHint 표시 유지');
});

test('cycle 245: BOSS_BRIEFS 데이터 보존 — 최소 ~20 bosses warningChips 정의', async () => {
    const source = await readSrc('src/data/monsters.ts');
    const matches = source.match(/warningChips:\s*\[/g);
    assert.ok(matches && matches.length >= 20,
        `BOSS_BRIEFS에 warningChips 정의 ${matches?.length || 0}건 (≥20 기대 — 데이터 회귀 가드)`);
});
