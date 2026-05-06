import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrateData } from '../src/utils/gameUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * cycle 206: meta.trueEndingFragments dead field 제거 (cycle 120/124/195 패턴 follow-up).
 *
 * 발견 (dead 데이터):
 * - migrateData(gameUtils.ts:514): `target.meta.trueEndingFragments = ...` 초기화.
 * - 그러나 src/ 전체에서 이 필드를 read하는 코드가 0건.
 * - 진 엔딩 파편 메커니즘은 실제로는 inv counting (combatBossHandlers.ts:15
 *   `inv.filter(i.name === '원시의 파편').length`)로 구현되어 있음.
 * - meta.trueEndingFragments는 v5.0 schema 잔해 — wire-up 안 된 채 init만 되던 dead 필드.
 *
 * 패턴:
 * - cycle 120: dead 'discoveries' migrate 제거.
 * - cycle 124: dead 'comboCount' migrate 제거 (combatFlags.comboCount로 대체).
 * - cycle 195: dead constants 6종 제거 (MILESTONE_KILLS / EXP_LEVEL_CAP_50 등).
 *
 * 수정 (src/utils/gameUtils.ts):
 * - migrateData에서 trueEndingFragments 초기화 라인 + 주석 제거.
 *
 * 영향 범위:
 * - 기존 save에 trueEndingFragments 값이 있어도 무해 (read 코드 없음).
 * - 신규 save는 이 필드 없이 진행. 진 엔딩 메커니즘은 inv 기반으로 그대로 동작.
 */

test('cycle 206: migrateData가 meta.trueEndingFragments를 더 이상 set하지 않음', () => {
    const fresh = { meta: { essence: 0, rank: 0, prestigeRank: 0, bonusAtk: 0, bonusHp: 0, bonusMp: 0 }, stats: {} };
    const migrated = migrateData(fresh);
    assert.equal(
        Object.prototype.hasOwnProperty.call(migrated.meta || {}, 'trueEndingFragments'),
        false,
        'migrateData가 새 save에 trueEndingFragments 필드를 추가하면 안 됨 (dead field)',
    );
});

test('cycle 206: 기존 save의 trueEndingFragments 값은 보존(무해 ignore) — 회귀 가드', () => {
    const legacy = {
        meta: { essence: 100, rank: 0, prestigeRank: 1, bonusAtk: 5, bonusHp: 50, bonusMp: 25, trueEndingFragments: 2 },
        stats: {},
    };
    const migrated = migrateData(legacy);
    // 기존 값을 stripping하지 않음 (단지 더 이상 set 안 함)
    assert.equal(migrated.meta.trueEndingFragments, 2,
        '기존 save의 값은 그대로 유지 (의도적 cleanup 아님, init만 멈춤)');
});

test('cycle 206: src/ 어디에서도 trueEndingFragments read 안 함 (regression guard)', () => {
    // 빌드 산출물(dist/ios/android) 제외, src/만 검사.
    const SRC_DIR = path.join(ROOT, 'src');
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(full);
        }
    };
    walk(SRC_DIR);

    const offenders = [];
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes('trueEndingFragments')) {
            offenders.push(path.relative(ROOT, file));
        }
    }
    assert.deepEqual(offenders, [],
        `trueEndingFragments는 dead field이므로 src/ 어디에서도 참조되면 안 됨. offender: ${JSON.stringify(offenders)}`);
});

test('cycle 206: 진 엔딩 inv-based 메커니즘 회귀 가드 (combatBossHandlers는 inv counting 유지)', () => {
    // 별도 import 검증 — 진 엔딩 기능 자체는 inv 기반으로 정상 작동.
    const file = path.join(ROOT, 'src/hooks/combatActions/combatBossHandlers.ts');
    const content = fs.readFileSync(file, 'utf-8');
    assert.ok(
        content.includes(`'원시의 파편'`),
        'combatBossHandlers.ts는 inv 기반 shard counting 유지',
    );
});
