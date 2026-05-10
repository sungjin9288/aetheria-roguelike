import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 438: codex 엔트리 obtainedAt 출력 dead 정리
 *   (cycle 222-437 silent dead config 시리즈 197번째 — function output dead field
 *   cleanup lens 회귀, cycle 333-356/435 패턴).
 *
 * 발견 (1 dead output field — 4 production producers):
 * - src/utils/gameUtils.ts:154 (registerCodex), :458/:468 (migrateData bootstrap):
 *     `{ discovered: true, obtainedAt: Date.now() }`
 * - src/reducers/handlers/rewardHandlers.ts:20 (CLAIM_CODEX_REWARD):
 *     `{ discovered: true, obtainedAt: Date.now() }`
 * - 호출 사이트 (codex 엔트리 consumer) 분석:
 *     · Codex.tsx / WeaponCodex.tsx / etc.: codex[cat][name] 키 존재만 검사
 *       (truthy check, Object.keys count). entry 내부 필드 read 0건.
 *     · production .obtainedAt read: 0건.
 *     · tests/game-utils.test.js / signature-achievements.test.js는 fixture로
 *       설정하지만 어설션 read 0건.
 * - 결과: obtainedAt 필드는 4 producer가 작성하지만 어디로도 흐르지 않는 dead.
 *
 * 패턴 (cycle 222-437 시리즈 197번째):
 * - cycle 333-356 시리즈: 함수 출력 dead 필드 cleanup.
 * - cycle 435: makeBattleRecord ts 출력 dead.
 * - cycle 436: getDailyDeals isDailyDeal 마커 dead.
 * - cycle 438: codex obtainedAt 출력 dead — 동일 lens 회귀 (4 producer batch).
 *
 * 수정:
 * - gameUtils.ts (registerCodex / migrateData 2 sites): obtainedAt 제거.
 * - rewardHandlers.ts (CLAIM_CODEX_REWARD): obtainedAt 제거.
 * - 결과 entry 형태: `{ discovered: true }` 단일 필드.
 *
 * 회귀 가드:
 * - codex[cat][name] 엔트리 자체 유지 (truthy check 동작).
 * - discovered: true 보존.
 * - migrate / register / reward 모든 path 동작 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 438: gameUtils.ts에서 obtainedAt 0건', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.ok(!/obtainedAt/.test(source), 'gameUtils.ts obtainedAt 0건');
});

test('cycle 438: rewardHandlers.ts에서 obtainedAt 0건', async () => {
    const source = await readSrc('src/reducers/handlers/rewardHandlers.ts');
    assert.ok(!/obtainedAt/.test(source), 'rewardHandlers.ts obtainedAt 0건');
});

test('cycle 438: registerCodex 동작 — discovered: true entry 노출', async () => {
    const { registerCodex } = await import('../src/utils/gameUtils.ts');
    const player = { stats: { codex: { weapons: {}, armors: {}, shields: {}, monsters: {}, recipes: {}, materials: {} } } };
    const updated = registerCodex(player, 'weapons', 'Test Sword');
    assert.ok(updated.stats.codex.weapons['Test Sword'], 'codex 엔트리 추가됨');
    assert.equal(updated.stats.codex.weapons['Test Sword'].discovered, true, 'discovered: true 보존');
    assert.equal(updated.stats.codex.weapons['Test Sword'].obtainedAt, undefined, 'obtainedAt 0건');
});

test('cycle 438: migrateData 동작 — codex bootstrap discovered만', async () => {
    const { migrateData } = await import('../src/utils/gameUtils.ts');
    const raw = {
        version: 1.0,
        player: {
            inv: [{ name: 'Sword', type: 'weapon', tier: 1 }],
            equip: { weapon: { name: 'Sword', type: 'weapon' } },
            stats: { kills: 0, killRegistry: {} },
        },
    };
    const migrated = migrateData(raw);
    const codex = migrated.player.stats.codex;
    if (codex?.weapons?.Sword) {
        assert.equal(codex.weapons.Sword.discovered, true, 'bootstrap discovered: true');
        assert.equal(codex.weapons.Sword.obtainedAt, undefined, 'bootstrap obtainedAt 0건');
    }
});

test('cycle 438: 정합성 가드 — production .obtainedAt read 0건', async () => {
    const { readdir } = await import('node:fs/promises');
    async function* walk(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const fp = path.join(dir, entry.name);
            if (entry.isDirectory()) yield* walk(fp);
            else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) yield fp;
        }
    }
    let reads = 0;
    for await (const fp of walk(path.join(ROOT, 'src'))) {
        const content = await readFile(fp, 'utf8').catch(() => '');
        if (/obtainedAt/.test(content)) reads += 1;
    }
    assert.equal(reads, 0, 'src/ 어디서도 obtainedAt 참조 0건');
});

test('cycle 437 회귀 가드: EventPanel default mobileFocused 0건', async () => {
    const source = await readSrc('src/components/EventPanel.tsx');
    const fnIdx = source.indexOf('const EventPanel =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const block = source.slice(fnIdx, fnEnd);
    assert.ok(!/mobileFocused = false/.test(block), 'cycle 437 default 제거 보존');
});
