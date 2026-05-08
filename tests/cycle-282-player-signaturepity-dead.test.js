import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 282: Player.signaturePity / SignaturePity 인터페이스 dead 필드 cleanup
 *   (cycle 222-281 silent dead config 시리즈 52번째 — cleanup lens 연속).
 *
 * 발견 (top-level vs nested 혼동):
 * - src/types/player.ts Player interface line 155: `signaturePity?: SignaturePity | number`.
 * - 그러나 active signaturePity는 player.stats.signaturePity (nested) — top-level 접근 0건.
 * - SignaturePity 인터페이스 (line 53)는 Player.signaturePity 외 consumer 없음.
 * - 모든 production read: `player?.stats?.signaturePity` (number 형식).
 *
 * 패턴 (cycle 222-281 silent dead config 시리즈 52번째):
 * - cycle 280: PlayerStats 타입 dead 필드 제거.
 * - cycle 281: PlayerMeta 타입 dead 필드 제거.
 * - cycle 282: Player 타입 dead 필드 제거 (cleanup lens 연속).
 *
 * 수정 (src/types/player.ts):
 * - Player interface에서 signaturePity 필드 제거.
 * - SignaturePity interface 제거 (consumer 0건).
 *
 * 회귀 가드:
 * - player.stats.signaturePity dispatch 동작 유지 (cycle 75 mercy 카운터).
 * - getSignaturePityMultiplier / SIGNATURE_PITY constant 동작 유지.
 * - [key: string]: any index signature 유지로 동적 필드 호환.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 282: Player interface에서 signaturePity 제거', async () => {
    const source = await readSrc('src/types/player.ts');
    const playerBlock = source.match(/export interface Player \{[\s\S]+?\n\}/);
    assert.ok(playerBlock, 'Player interface 발견');
    assert.ok(!/signaturePity\?:\s*SignaturePity/.test(playerBlock[0]),
        'Player.signaturePity 제거됨');
});

test('cycle 282: SignaturePity interface 제거', async () => {
    const source = await readSrc('src/types/player.ts');
    assert.ok(!/export interface SignaturePity/.test(source),
        'SignaturePity interface 제거됨');
});

test('cycle 282: player.stats.signaturePity dispatch 유지 (회귀 가드)', async () => {
    const sources = await Promise.all([
        readSrc('src/utils/adventureGuide.ts'),
        readSrc('src/components/codex/LegendaryCodex.tsx'),
        readSrc('src/hooks/gameActions/exploreActions.ts'),
    ]);
    sources.forEach((src, i) => {
        assert.ok(/player[\?.]+stats[\?.]+signaturePity/.test(src),
            `[file ${i}] player.stats.signaturePity dispatch 유지`);
    });
});

test('cycle 282: getSignaturePityMultiplier / SIGNATURE_PITY 유지 (회귀 가드)', async () => {
    const source = await readSrc('src/utils/signaturePity.ts');
    assert.ok(/getSignaturePityMultiplier/.test(source),
        'getSignaturePityMultiplier 함수 유지');
    assert.ok(/SIGNATURE_PITY/.test(source),
        'SIGNATURE_PITY constant 유지');
});

test('cycle 280-281 회귀 가드: 이전 cleanup 동작 유지', async () => {
    const source = await readSrc('src/types/player.ts');
    // cycle 299: PlayerStats / PlayerMeta export 제거 (private) → 정의 유지.
    const statsBlock = source.match(/(?:export )?interface PlayerStats[\s\S]+?\n\}/);
    const metaBlock = source.match(/(?:export )?interface PlayerMeta[\s\S]+?\n\}/);
    assert.ok(statsBlock && !/comboCount\?:\s*number;/.test(statsBlock[0]),
        'cycle 280 PlayerStats.comboCount 0건');
    assert.ok(statsBlock && !/discoveries\?:\s*number;/.test(statsBlock[0]),
        'cycle 280 PlayerStats.discoveries 0건');
    assert.ok(metaBlock && !/totalPrestigeAtk\?:/.test(metaBlock[0]),
        'cycle 281 PlayerMeta.totalPrestigeAtk 0건');
});
