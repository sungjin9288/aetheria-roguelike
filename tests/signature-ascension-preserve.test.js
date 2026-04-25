import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * AscensionScreen — signature codex 보존을 명시적으로 노출.
 *
 * progressionHandlers.ASCEND는 codex를 보존하지만(line 80), AscensionScreen은
 * "런 진행도는 초기화 / 누적 통계는 유지"라는 generic 문구만 보여줘 플레이어가
 * "내가 모은 전설 각인이 사라지나?"라는 trust 안락사 모먼트를 겪는다.
 *
 * 계약:
 *   1. AscensionScreen이 getSignatureDiscoveryProgress import
 *   2. discoveredCount > 0일 때만 signature 보존 라인 렌더 (silence over noise)
 *   3. data-testid="ascension-signature-preserve" 노출
 *   4. "전설 각인" + "보존|유지" 키워드 + 발견 수치
 *   5. ✦ 마커 + gold 팔레트 (chain 일관성)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('AscensionScreen imports getSignatureDiscoveryProgress', async () => {
    const source = await readSrc('src/components/AscensionScreen.jsx');
    assert.ok(
        /import\s*\{[^}]*getSignatureDiscoveryProgress[^}]*\}\s*from\s*['"][^'"]*signatureItems/.test(source),
        'AscensionScreen should import getSignatureDiscoveryProgress'
    );
});

test('AscensionScreen exposes ascension-signature-preserve testid', async () => {
    const source = await readSrc('src/components/AscensionScreen.jsx');
    assert.ok(
        /ascension-signature-preserve/.test(source),
        'should expose data-testid="ascension-signature-preserve"'
    );
});

test('AscensionScreen render is gated on discoveredCount > 0', async () => {
    const source = await readSrc('src/components/AscensionScreen.jsx');
    // signature 발견이 0개면 banner 미표시 — discovered > 0 조건이 걸려야 함
    const gateMatch = source.match(
        /(discovered\s*>\s*0|discovered\s*&&|signatureProgress\.discovered)[\s\S]{0,300}ascension-signature-preserve/
    );
    assert.ok(
        gateMatch,
        'signature preserve banner should be conditionally rendered behind discovered > 0 gate'
    );
});

test('AscensionScreen banner mentions 전설 각인 + 보존/유지', async () => {
    const source = await readSrc('src/components/AscensionScreen.jsx');
    const blockMatch = source.match(/ascension-signature-preserve[\s\S]{0,1200}/);
    assert.ok(blockMatch, 'preserve banner block not found');
    const block = blockMatch[0];
    assert.ok(/전설 각인/.test(block), 'banner should reference "전설 각인"');
    assert.ok(/보존|유지/.test(block), 'banner should use 보존 or 유지 to convey safety');
});

test('AscensionScreen banner uses ✦ glyph + gold palette', async () => {
    const source = await readSrc('src/components/AscensionScreen.jsx');
    const blockMatch = source.match(/ascension-signature-preserve[\s\S]{0,900}/);
    assert.ok(blockMatch);
    const block = blockMatch[0];
    assert.ok(/✦/.test(block), 'banner should include ✦ glyph');
    assert.ok(
        /#f6e7a2|246,\s*231,\s*162/.test(block),
        'banner should use #f6e7a2 / rgba(246,231,162) gold palette'
    );
});
