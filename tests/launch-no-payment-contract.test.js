import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import * as tossFramework from '@apps-in-toss/web-framework';
import { PREMIUM_SHOP } from '../src/data/premiumShop.js';

/**
 * 2026-10-06 소유자 결정 — "결제 기능은 스토어 등록 이후에 유저들의 반응을 보고 추가한다".
 *
 * 출시 빌드에는 실제 돈을 받는 경로가 없다(원장 §68.2). 에테르 교환소는 플레이로 얻은 크리스털만 쓰는 게임 안 교환이다.
 * 이 파일은 그 상태가 결정 없이 바뀌지 않게 하는 부재 불변식이다 — 결제를 넣을 때는 이 계약을 함께 고쳐 결정을 남길 것.
 */

const walk = (dir, pattern = /\.(ts|tsx|js|mjs)$/, out = []) => {
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) {
            if (!['node_modules', 'Pods', 'build', 'DerivedData'].includes(entry)) walk(path, pattern, out);
        } else if (pattern.test(entry)) out.push(path);
    }
    return out;
};

test('토스 SDK의 결제 API(IAP · 결제창 · 정기 결제)를 src 어디에서도 가져오지 않는다', () => {
    // SDK가 내보내는 결제 계열 이름을 SDK에서 직접 읽는다 — 새 결제 API가 생겨도 이 목록이 따라간다.
    const paymentExports = Object.keys(tossFramework).filter((name) => /iap|purchase|payment|checkout|billing/i.test(name));
    assert.ok(paymentExports.length > 0, 'SDK에 결제 API가 있어야 이 계약이 의미가 있다');
    const offenders = [];
    for (const file of walk('src')) {
        const source = readFileSync(file, 'utf8');
        for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@apps-in-toss\/web-framework['"]/g)) {
            const names = match[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[0]).filter(Boolean);
            for (const name of names) if (paymentExports.includes(name)) offenders.push(`${file}: ${name}`);
        }
        if (/from\s*['"]@apps-in-toss\/web-framework['"]/.test(source) && /import\s*\*\s*as/.test(source)) {
            offenders.push(`${file}: namespace import`);
        }
    }
    assert.deepEqual(offenders, []);
});

test('결제 SDK 의존성 · 네이티브 결제 권한이 없다', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    assert.deepEqual(deps.filter((name) => /purchase|billing|iap|storekit|revenuecat|payment/i.test(name)), []);
    const manifest = 'android/app/src/main/AndroidManifest.xml';
    if (existsSync(manifest)) assert.doesNotMatch(readFileSync(manifest, 'utf8'), /com\.android\.vending\.BILLING/);
    const gradle = 'android/app/build.gradle';
    if (existsSync(gradle)) assert.doesNotMatch(readFileSync(gradle, 'utf8'), /billing/i);
    if (existsSync('ios')) {
        const iosSources = walk('ios', /\.(swift|m|mm|h|plist|pbxproj|entitlements)$/);
        assert.ok(iosSources.some((file) => file.endsWith('.swift')), 'iOS 소스를 실제로 읽어야 한다');
        assert.deepEqual(iosSources.filter((file) => /StoreKit|SKPayment/.test(readFileSync(file, 'utf8'))), []);
    }
});

test('에테르 교환소의 모든 상품은 크리스털로만 바꾼다 — 돈 가격을 가진 상품이 없다', () => {
    const { cosmeticTitles, ...services } = PREMIUM_SHOP;
    const offers = [...Object.values(services), ...cosmeticTitles];
    assert.ok(offers.length > 0);
    for (const offer of offers) {
        assert.ok(Number.isFinite(offer.cost) && offer.cost > 0, `${offer.id} 크리스털 비용`);
        for (const key of Object.keys(offer)) assert.doesNotMatch(key, /price|krw|usd|sku|productId/i, `${offer.id}.${key}`);
    }
});

/**
 * 2026-10-06 소유자 결정 — 보상형 광고(귀환 보급: 광고 1회 = 하급 체력 물약 1개)도 "결제처럼 반응 보고 결정"이다(원장 §72).
 * 코드는 그대로 두고, 토스 빌드에 광고 그룹 ID(`VITE_TOSS_REWARDED_AD_GROUP_ID`)를 넣을 때만 켜진다. 출시 범위 밖이므로
 * 저장소의 어떤 빌드 설정(환경 파일 · 워크플로 · 패키지 스크립트 · 토스 설정)도 그 값을 정하지 않는다 — 켤 때 이 계약을 함께 고칠 것.
 */
test('보상형 광고는 출시 범위 밖이다 — 추적되는 빌드 설정 어디에도 광고 그룹 ID 값이 없다', () => {
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
    assert.ok(tracked.length > 100, '전제: git 추적 파일 목록');
    const configFiles = tracked.filter((file) => !/^(src|tests|docs|scripts\/art_sources|public)\//.test(file)
        && !/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|mp3|ogg|wav|json\.gz|ait|zip|jar|keystore)$/i.test(file));
    const offenders = [];
    for (const file of configFiles) {
        if (!existsSync(file) || statSync(file).size > 2_000_000) continue;
        const source = readFileSync(file, 'utf8');
        if (/VITE_TOSS_REWARDED_AD_GROUP_ID\s*[=:]\s*['"]?[A-Za-z0-9_-]/.test(source)) offenders.push(file);
    }
    assert.deepEqual(offenders, []);
    assert.equal(tracked.some((file) => /(^|\/)\.env(\.|$)/.test(file) && !/\.example$/.test(file)), false, '추적되는 .env 파일이 없다');
});
