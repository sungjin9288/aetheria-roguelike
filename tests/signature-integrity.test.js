import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SIGNATURE_ITEM_REGISTRY } from '../src/data/signatureItems.js';

/**
 * Signature 자산 무결성 검증.
 *
 * signatureRegistry.json의 모든 spriteKey가 실제 PNG 파일로 존재해야 한다.
 * (item view, wearable overlay 양쪽 모두)
 *
 * 회귀 시나리오:
 * - registry에 신규 아이템 추가했는데 generate_signature_sprites.py를 안 돌림
 * - slug rename 후 PNG 이름이 안 맞음
 * - git add를 빼먹은 PNG
 *
 * 이 테스트가 실패하면 sprite 생성 스크립트를 먼저 실행해야 한다:
 *   python3 scripts/generate_signature_sprites.py
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ITEM_DIR = path.join(REPO_ROOT, 'public', 'assets', 'equipment-exact');
const WEARABLE_DIR = path.join(REPO_ROOT, 'public', 'assets', 'equipment-wearable-exact');

const fileExists = (absPath) => {
    try {
        const stats = statSync(absPath);
        return stats.isFile() && stats.size > 0;
    } catch {
        return false;
    }
};

test('every registered signature has an item-view PNG in equipment-exact/', () => {
    const missing = [];
    for (const [itemName, meta] of Object.entries(SIGNATURE_ITEM_REGISTRY)) {
        const pngPath = path.join(ITEM_DIR, `${meta.spriteKey}.png`);
        if (!fileExists(pngPath)) {
            missing.push(`${itemName} → ${meta.spriteKey}.png`);
        }
    }
    assert.equal(
        missing.length,
        0,
        `Missing item-view PNG(s):\n${missing.join('\n')}\nRun: python3 scripts/generate_signature_sprites.py`
    );
});

test('every registered signature has a wearable-overlay PNG in equipment-wearable-exact/', () => {
    const missing = [];
    for (const [itemName, meta] of Object.entries(SIGNATURE_ITEM_REGISTRY)) {
        const pngPath = path.join(WEARABLE_DIR, `${meta.spriteKey}.png`);
        if (!fileExists(pngPath)) {
            missing.push(`${itemName} → ${meta.spriteKey}.png`);
        }
    }
    assert.equal(
        missing.length,
        0,
        `Missing wearable-overlay PNG(s):\n${missing.join('\n')}\nRun: python3 scripts/generate_signature_sprites.py`
    );
});

test('signature sprite keys follow signature-* naming convention', () => {
    for (const [itemName, meta] of Object.entries(SIGNATURE_ITEM_REGISTRY)) {
        assert.match(
            meta.spriteKey,
            /^signature-[a-z]+-[a-z0-9-]+$/,
            `"${itemName}" has non-conforming spriteKey "${meta.spriteKey}"`
        );
    }
});

test('signature tone values are all known palette keys', () => {
    const knownTones = new Set([
        'holy', 'fire', 'frost', 'shadow', 'arcane', 'nature',
        'earth', 'steel', 'rust', 'wood', 'bone', 'leather',
        'cloth', 'canvas', 'straw',
    ]);
    for (const [itemName, meta] of Object.entries(SIGNATURE_ITEM_REGISTRY)) {
        assert.equal(
            knownTones.has(meta.tone),
            true,
            `"${itemName}" has unknown tone "${meta.tone}"`
        );
    }
});

test('signature categories are all from the allowed vocabulary', () => {
    const allowedCategories = new Set(['unique-weapon', 'boss-drop', 'set-core']);
    for (const [itemName, meta] of Object.entries(SIGNATURE_ITEM_REGISTRY)) {
        assert.equal(
            allowedCategories.has(meta.category),
            true,
            `"${itemName}" has unknown category "${meta.category}"`
        );
    }
});
