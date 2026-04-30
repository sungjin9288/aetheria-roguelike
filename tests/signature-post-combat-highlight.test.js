import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * PostCombatCard — signature 각인이 loot에 포함됐을 때 "Legendary" 전용 row로 강조.
 *
 * 기존에는 lootSummary = "아이템1 · 아이템2 외 N" 한 줄에 signature가 묻혀 있었음.
 * 보스를 잡고 얻는 가장 큰 순간을 시각적으로 두드러지게 만들기 위해
 * Field Report 상단에 gold-bordered row를 추가한다.
 *
 * 계약:
 *   1. isSignatureItem을 import
 *   2. droppedItems 중 signature 이름만 골라 별도 변수로 분리
 *   3. 일반 lootSummary에서는 signature 제외 (중복 방지)
 *   4. signature가 있으면 Sparkles 아이콘 + "Legendary" 레이블 row 렌더
 *   5. 렌더 조건이 signatureLoot.length > 0 도 포함 (일반 loot 없이 signature만 떨어진 케이스 커버)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('PostCombatCard imports isSignatureItem', async () => {
    const source = await readSrc('src/components/PostCombatCard.tsx');
    assert.ok(
        /import\s*\{[^}]*isSignatureItem[^}]*\}\s*from\s*['"]\.\.\/data\/signatureItems\.js['"]/.test(source),
        'should import isSignatureItem from signatureItems.js'
    );
});

test('PostCombatCard imports Sparkles icon', async () => {
    const source = await readSrc('src/components/PostCombatCard.tsx');
    assert.ok(
        /import\s*\{[^}]*Sparkles[^}]*\}\s*from\s*['"]lucide-react['"]/.test(source),
        'should import Sparkles from lucide-react'
    );
});

test('PostCombatCard splits droppedItems into signatureLoot and nonSignatureLoot', async () => {
    const source = await readSrc('src/components/PostCombatCard.tsx');
    assert.ok(
        /signatureLoot/.test(source),
        'should derive signatureLoot variable'
    );
    assert.ok(
        /nonSignatureLoot/.test(source),
        'should derive nonSignatureLoot variable'
    );
    // signature 필터링 근거: isSignatureItem({ name })
    assert.ok(
        /isSignatureItem\(\s*\{\s*name/.test(source),
        'should call isSignatureItem with { name } shape'
    );
});

test('PostCombatCard lootSummary is built from nonSignatureLoot (excludes signatures)', async () => {
    const source = await readSrc('src/components/PostCombatCard.tsx');
    // lootSummary = nonSignatureLoot.length > 0 ? ... : null
    assert.ok(
        /lootSummary\s*=\s*nonSignatureLoot\.length/.test(source),
        'lootSummary should be derived from nonSignatureLoot to avoid duplication'
    );
});

test('PostCombatCard renders Legendary row with gold styling when signatureLoot is non-empty', async () => {
    const source = await readSrc('src/components/PostCombatCard.tsx');
    assert.ok(
        /signatureLoot\.length\s*>\s*0/.test(source),
        'should guard Legendary row render behind signatureLoot.length > 0'
    );
    // Gold palette marker
    assert.ok(
        /f6e7a2/.test(source),
        'Legendary row should use the gold palette (#f6e7a2)'
    );
    // "Legendary" 레이블 또는 ✦ 마커
    assert.ok(
        /Legendary|전설 각인/.test(source),
        'should label the row with "Legendary" or "전설 각인"'
    );
});

test('PostCombatCard primary panel renders when signatureLoot exists even if no other loot', async () => {
    const source = await readSrc('src/components/PostCombatCard.tsx');
    // 기존 조건 (lootSummary || primarySignal)에 signatureLoot 분기도 포함돼야 함
    assert.ok(
        /signatureLoot\.length\s*>\s*0/.test(source),
        'panel render gate should include signatureLoot.length > 0'
    );
});
