import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 323: 3 leftover unused imports 정리 (cycle 321/322 paired completion)
 *   (cycle 222-322 silent dead config 시리즈 92번째 — cleanup lens 연속).
 *
 * 발견 (3 leftover unused imports):
 * - src/utils/exploreUtils.ts:1 `Monster` type — 사용 0건.
 * - src/components/SkillTreePreview.tsx:3 `RefreshCw` icon — JSX 0건.
 * - src/components/Codex.tsx:2 `Shield` icon — JSX 0건.
 *
 * 패턴 (cycle 222-322 silent dead config 시리즈 92번째):
 * - cycle 322: 55 files unused React default 일괄 정리.
 * - cycle 323: 남은 unused named imports 3건 정리 (cycle 321/322 paired completion).
 *
 * 회귀 가드:
 * - 각 파일의 active import는 그대로.
 * - tsc / lint / unit / build-guard 모두 통과.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 323: exploreUtils.ts Monster type import 제거', async () => {
    const source = await readSrc('src/utils/exploreUtils.ts');
    // import 라인에서 Monster 0건.
    const importMatch = source.match(/^import type \{ ([^}]+) \} from '\.\.\/types\/index\.js';/m);
    assert.ok(importMatch, 'GameMap/Relic import 라인 발견');
    assert.ok(!/\bMonster\b/.test(importMatch[1]),
        'Monster import 제거됨');
    assert.ok(/GameMap/.test(importMatch[1]), 'GameMap 보존');
    assert.ok(/Relic/.test(importMatch[1]), 'Relic 보존');
});

test('cycle 323: SkillTreePreview.tsx RefreshCw import 제거', async () => {
    const source = await readSrc('src/components/SkillTreePreview.tsx');
    const importMatch = source.match(/^import \{ ([^}]+) \} from 'lucide-react';/m);
    assert.ok(importMatch, 'lucide-react import 발견');
    assert.ok(!/\bRefreshCw\b/.test(importMatch[1]),
        'RefreshCw import 제거됨');
});

test('cycle 323: Codex.tsx Shield icon import 제거', async () => {
    const source = await readSrc('src/components/Codex.tsx');
    const importMatch = source.match(/^import \{ ([^}]+) \} from 'lucide-react';/m);
    assert.ok(importMatch, 'lucide-react import 발견');
    assert.ok(!/\bShield\b/.test(importMatch[1]),
        'Shield icon import 제거됨');
});

test('cycle 322 회귀 가드: React default 정리 보존', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const reactUses = (source.match(/\bReact\./g) || []).length;
    if (reactUses === 0) {
        assert.ok(!/^import React\b/m.test(source),
            'cycle 322 Dashboard React default 제거 보존');
    }
});
