import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Slice 25: 시그니처 아트 결 통일 + 트렌디 UI 패스
 *
 * 진단: 상점/도감의 시그니처(전설) 25종이 평면 도형 수준 플레이스홀더라
 * 아바타/장비 family의 풍부한 픽셀 결과 충돌 — 전설 등급이 가장 빈약해 보임.
 *
 * 수정:
 * - scripts/generate_signature_pixel_art.py — family 아트와 동일한 원본
 *   아이콘 풀(public/assets/items)에서 hue-shift 리컬러(tone 정체성, S/V
 *   텍스처 보존) + 전설 오라/스파클로 25종 전부 재생성. 파일명 유지로
 *   코드 변경 0건.
 * - ItemIcon 레어리티 플레이트 강화 (보더/래디얼/글로우 1단계 상향).
 * - 결정 CTA 모던화: aether-cta-primary/gold (그라디언트 + 프레스 스케일,
 *   high-readability 모드 감쇠).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

const readPngSize = async (relPath) => {
    const buffer = await readFile(path.join(ROOT, relPath));
    // PNG IHDR: width/height는 16-19, 20-23 바이트 (big-endian)
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

test('slice 25: 시그니처 25종 — 레지스트리 전수 재생성 (160px, 플레이스홀더 아님)', async () => {
    const registry = JSON.parse(await readSrc('src/data/signatureRegistry.json'));
    const entries = Object.values(registry.entries);
    assert.equal(entries.length, 25, '레지스트리 25종');
    for (const entry of entries) {
        const relPath = `public/assets/equipment-exact/${entry.spriteKey}.png`;
        const info = await stat(path.join(ROOT, relPath));
        // 기존 평면 플레이스홀더는 1-3KB — 풍부한 픽셀 아트는 5KB+
        assert.ok(info.size > 5000,
            `${entry.spriteKey} 파일 크기 ${info.size}B — 플레이스홀더 의심 (≤5KB)`);
        const { width, height } = await readPngSize(relPath);
        assert.equal(width, 160, `${entry.spriteKey} 폭 160`);
        assert.equal(height, 160, `${entry.spriteKey} 높이 160`);
    }
});

test('slice 25: 생성 스크립트 — 레지스트리 spriteKey 전수 base 매핑', async () => {
    const script = await readSrc('scripts/generate_signature_pixel_art.py');
    const registry = JSON.parse(await readSrc('src/data/signatureRegistry.json'));
    for (const entry of Object.values(registry.entries)) {
        assert.ok(script.includes(`"${entry.spriteKey}"`),
            `${entry.spriteKey} base 매핑 존재`);
    }
});

test('slice 25: CTA 모던 토큰 — primary/gold + high 모드 감쇠', async () => {
    const css = await readSrc('src/index.css');
    assert.ok(/\.aether-cta-primary\s*\{/.test(css), 'aether-cta-primary 정의');
    assert.ok(/\.aether-cta-gold\s*\{/.test(css), 'aether-cta-gold 정의');
    assert.ok(/\[data-readability-mode="high"\][^{]*\.aether-cta-primary/.test(css),
        'high 모드 CTA 감쇠');
});

test('slice 25: 결정 CTA 적용 — 퀘스트 보드 + 상점', async () => {
    const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    assert.ok((qb.match(/aether-cta-primary/g) || []).length >= 2,
        '작전 개시 + 임무 수락 CTA 적용');
    const sp = await readSrc('src/components/ShopPanel.tsx');
    assert.ok((sp.match(/aether-cta-gold/g) || []).length >= 2,
        '상점 구매 버튼 CTA 적용');
});

test('slice 25: ItemIcon 레어리티 플레이트 강화', async () => {
    const icon = await readSrc('src/components/icons/ItemIcon.tsx');
    assert.ok(/\$\{color\}66/.test(icon), '레어리티 보더 강화 (40 → 66)');
    assert.ok(/\$\{color\}2e/.test(icon), '래디얼 워시 강화');
});
