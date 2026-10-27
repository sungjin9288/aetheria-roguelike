import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';

import { MSG } from '../src/data/messages.ts';
import MirrorPanel from '../src/components/MirrorPanel.tsx';
import PremiumShop from '../src/components/PremiumShop.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * 소유자 결정 2026-10-26 D17(UX-09): 닫기 · 뒤로 이름은 둘이다 — 위에 덮는 화면(시트 · 오버레이 · 순간 카드)을 닫는 것은 '닫기',
 *   앞 화면으로 돌아가는 것은 '뒤로'다. 아이콘만 있는 X 단추도 접근 이름이 '닫기'로 끝난다.
 *   다른 이름(복귀 · 돌아가기 · 나가기 · 뒤로 가기 · 이전 화면)은 tests/one-concept-one-name-contract.test.js의 VARIANTS가 막는다.
 */

const ROOT = path.resolve(import.meta.dirname, '..');

test('두 이름은 MSG 하나씩이다', () => {
    assert.equal(MSG.UI_CLOSE, '닫기');
    assert.equal(MSG.UI_BACK, '뒤로');
});

test('[MSG 전수] 닫기 단추 이름(…_CLOSE_ARIA · …_CLOSE_LABEL)은 모두 "닫기"로 끝난다', () => {
    // DIFFICULTY_LABEL_CLOSE는 체감 난이도 단계 '박빙'(close fight)이라 단추 이름이 아니다.
    const keys = Object.keys(MSG).filter((key) => /_CLOSE(_ARIA|_LABEL)?$/u.test(key) && key !== 'DIFFICULTY_LABEL_CLOSE');
    assert.ok(keys.length >= 5, keys.join(','));
    for (const key of keys) {
        const value = MSG[key];
        assert.equal(typeof value, 'string', key);
        assert.ok(value === MSG.UI_CLOSE || value.endsWith(` ${MSG.UI_CLOSE}`), `${key}: ${value}`);
    }
});

test('[부재] 컴포넌트는 닫기 · 뒤로 단추 이름을 직접 적지 않는다 — MSG에서 읽는다', () => {
    const offenders = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.tsx')) {
                const source = fs.readFileSync(full, 'utf8');
                for (const match of source.matchAll(/aria-label="([^"]*[가-힣][^"]*)"/gu)) {
                    if (/닫기|뒤로|돌아|나가|이전/u.test(match[1])) offenders.push(`${path.relative(ROOT, full)}: ${match[1]}`);
                }
            }
        }
    };
    walk(path.join(ROOT, 'src', 'components'));
    assert.deepEqual(offenders, []);
});

test('[렌더] 덮는 화면(에테르 거울 · 교환소)의 닫기는 "<무엇> 닫기" 접근 이름과 보이는 이름 "닫기"를 함께 든다', () => {
    const player = makePlayerFixture({ name: '용사', premiumCurrency: 5 });
    for (const [html, testId, name] of [
        [renderStatic(createElement(MirrorPanel, { player, onClose: () => {}, onPurchase: () => {} })), 'mirror-panel-close', MSG.MIRROR_PANEL_CLOSE_ARIA],
        [renderStatic(createElement(PremiumShop, { player, onClose: () => {} })), 'premium-shop-close', MSG.PREMIUM_SHOP_CLOSE_ARIA],
    ]) {
        const at = html.indexOf(`data-testid="${testId}"`);
        assert.ok(at >= 0, testId);
        const button = html.slice(html.lastIndexOf('<button', at), html.indexOf('</button>', at));
        assert.ok(button.includes(`aria-label="${name}"`), testId);
        assert.ok(button.endsWith(MSG.UI_CLOSE), `${testId}: 보이는 이름`);
    }
});
