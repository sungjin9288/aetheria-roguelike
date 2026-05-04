import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 127: PremiumShop testid 노출 — cycle 125-126 testid sweep 연장.
 *
 * PremiumShop은 에테르 크리스탈 상점 — 인벤 확장 / 합성 보호권 / 즉시 부활권 +
 * 코스메틱 칭호 구매 UI. 결제 액션 흐름이라 e2e 자동화 가치가 높지만 testid 0건.
 *
 * 추가 (cycle 18+ 명명 패턴 일관):
 * - data-testid="premium-shop" — 패널 루트.
 * - data-testid={`premium-buy-${item.id}`} — 유틸리티 구매 버튼.
 * - data-testid={`premium-title-buy-${title.id}`} — 코스메틱 칭호 구매 버튼.
 * - data-testid="premium-shop-close" — 닫기 버튼 (X icon).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('PremiumShop: premium-shop root testid 노출', async () => {
    const source = await readSrc('src/components/PremiumShop.tsx');
    assert.match(source, /data-testid\s*=\s*["']premium-shop["']/);
});

test('PremiumShop: premium-buy-{item.id} testid 노출', async () => {
    const source = await readSrc('src/components/PremiumShop.tsx');
    assert.match(source, /data-testid\s*=\s*\{`premium-buy-\$\{[^}]+\}`\}/);
});

test('PremiumShop: premium-title-buy-{title.id} testid 노출', async () => {
    const source = await readSrc('src/components/PremiumShop.tsx');
    assert.match(source, /data-testid\s*=\s*\{`premium-title-buy-\$\{[^}]+\}`\}/);
});

test('PremiumShop: premium-shop-close testid 노출', async () => {
    const source = await readSrc('src/components/PremiumShop.tsx');
    assert.match(source, /data-testid\s*=\s*["']premium-shop-close["']/);
});
