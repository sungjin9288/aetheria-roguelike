import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 417: EquipmentPanel SLOT_CONFIG `icon` 출력 dead 정리 + 미사용 import cleanup
 *   (cycle 222-416 silent dead config 시리즈 178번째 — function output dead lens 회귀).
 *
 * 발견 (3 dead 출력 필드 + 2 dead imports):
 * - src/components/EquipmentPanel.tsx SLOT_CONFIG (line 21-25): 3 entry —
 *   weapon/armor/offhand. 각 entry에 `icon: Sword/Shield/Sparkles` 필드.
 * - 렌더 사이트는 `slot.key`, `slot.label`, `slot.item`, `slot.canEnhance`,
 *   `slot.requirement`, `slot.isSignature`만 read.
 * - `slot.icon` src/, tests/ 어디에서도 read 0건.
 * - cascade: SLOT_CONFIG.icon 제거 후 Sword / Shield (lucide-react) imports
 *   미사용. Sparkles는 line 261/375 다른 JSX에서 사용 보존.
 *
 * 패턴 (cycle 222-416 시리즈 178번째):
 * - cycle 393: PREMIUM_SHOP entry 10 dead.
 * - cycle 416: ACTION_BUTTONS entry 8 dead.
 * - cycle 417: SLOT_CONFIG entry icon 3 dead — 동일 lens 회귀 + cascade unused imports.
 *
 * 수정 (src/components/EquipmentPanel.tsx):
 * - SLOT_CONFIG 3 entry에서 `icon: Sword/Shield/Sparkles` 라인 제거.
 * - lucide-react import에서 `Sword`, `Shield` 제거 (Sparkles는 다른 곳에서 사용).
 *
 * 회귀 가드:
 * - SLOT_CONFIG key / label 활성 필드 보존.
 * - Sparkles import 보존 (line 261/375 사용).
 * - Target / ChevronDown / ChevronUp 다른 import는 사용 사이트 따라 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 417: SLOT_CONFIG에서 icon 0건', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    const blockStart = source.indexOf('const SLOT_CONFIG');
    const blockEnd = source.indexOf('];', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/\bicon:/.test(block),
        'SLOT_CONFIG에서 icon 필드 0건');
});

test('cycle 417: SLOT_CONFIG 활성 필드 보존 (key/label)', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    const blockStart = source.indexOf('const SLOT_CONFIG');
    const blockEnd = source.indexOf('];', blockStart);
    const block = source.slice(blockStart, blockEnd);
    for (const field of ['key', 'label']) {
        const re = new RegExp(`\\b${field}:`);
        assert.ok(re.test(block), `${field} 필드 보존`);
    }
});

test('cycle 417: 3 entry (weapon/armor/offhand) 보존', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    const blockStart = source.indexOf('const SLOT_CONFIG');
    const blockEnd = source.indexOf('];', blockStart);
    const block = source.slice(blockStart, blockEnd);
    for (const key of ['weapon', 'armor', 'offhand']) {
        const re = new RegExp(`key:\\s*'${key}'`);
        assert.ok(re.test(block), `${key} entry 보존`);
    }
});

test('cycle 417: Sword / Shield imports 제거 + Sparkles 보존', async () => {
    const source = await readSrc('src/components/EquipmentPanel.tsx');
    // 첫 import 라인만 검사 (lucide-react)
    const importMatch = source.match(/import \{[^}]+\} from 'lucide-react';/);
    assert.ok(importMatch, 'lucide-react import 발견');
    const importBlock = importMatch[0];
    assert.ok(!/\bSword\b/.test(importBlock), 'Sword import 0건');
    assert.ok(!/\bShield\b/.test(importBlock), 'Shield import 0건');
    assert.ok(/\bSparkles\b/.test(importBlock), 'Sparkles import 보존');
});

test('cycle 416 회귀 가드: ACTION_BUTTONS tag/detail 0건', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    const blockStart = source.indexOf('const ACTION_BUTTONS');
    const blockEnd = source.indexOf('];', blockStart);
    const block = source.slice(blockStart, blockEnd);
    assert.ok(!/\btag:/.test(block),
        'cycle 416 ACTION_BUTTONS.tag 0건 보존');
    assert.ok(!/\bdetail:/.test(block),
        'cycle 416 ACTION_BUTTONS.detail 0건 보존');
});
