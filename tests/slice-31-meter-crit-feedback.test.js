import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import StatusBar from '../src/components/StatusBar.tsx';
import CritPulse from '../src/components/CritPulse.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * Slice 31: 미터 fill 애니메이션 + 치명타 스크린 펄스 — 게임 필 감사 GF-01에서 소스 정규식 가드를 행동 테스트로 바꿨다.
 *
 * 예전 가드는 "GameRoot가 새 critical 로그 id를 감지해 펄스를 켠다"를 소스 글자로 고정했다. 그 판정은 적 강타 ·
 * 보스 단계 공개에 금빛을 띄우고 내 치명타는 놓쳤다. 이제 펄스는 두 색조다 — 내 치명타 금빛('crit-pulse'),
 * 적 강타 붉은빛('heavy-hit-pulse') — 그리고 무엇이 켜지는지는 리듀서의 차례 기록이 정한다.
 * 리듀서 전이 → 펄스가 켜지는 시점은 Chromium에서 잰다: tests/combat-feedback-presentation.test.js(GF-01 두 테스트).
 */

test('slice 31: 상태 미터 막대는 값 변화를 부드럽게 옮긴다(width tween)', () => {
    const player = makePlayerFixture({ name: '리베이아', hp: 30, maxHp: 120, mp: 5, maxMp: 20, level: 3 });
    const html = renderStatic(createElement(StatusBar, { player, stats: { maxHp: 120, maxMp: 20 }, enemy: null }));
    for (const variant of ['hp', 'mp', 'exp']) {
        const meter = html.slice(html.indexOf(`data-testid="status-metric-${variant}"`));
        assert.match(meter, /class="[^"]*transition-\[width\][^"]*" style="width:\d+(\.\d+)?%"/, `${variant} 막대 tween`);
    }
    assert.match(html, /style="width:25%"/, '생명 30/120은 25%');
});

test('slice 31 → GF-01: 펄스는 꺼져 있으면 그리지 않는다', () => {
    assert.equal(renderStatic(createElement(CritPulse, { active: false })), '');
    assert.equal(renderStatic(createElement(CritPulse, { active: false, tone: 'heavy' })), '');
});

test('slice 31 → GF-01: 내 치명타는 금빛, 적 강타는 붉은빛 — 둘 다 입력을 막지 않는다', () => {
    const crit = renderStatic(createElement(CritPulse, { active: true }));
    assert.ok(crit.includes('data-testid="crit-pulse"'));
    // 2026-10 에테르 유리: 색은 토큰 채널이다(금빛 = --aether-gold-hi, 붉은빛 = --aether-life-lo).
    assert.ok(crit.includes('--aether-gold-hi-rgb'), '금빛 비네트');
    assert.ok(!crit.includes('--aether-life-lo-rgb'));
    assert.ok(crit.includes('pointer-events-none'));

    const heavy = renderStatic(createElement(CritPulse, { active: true, tone: 'heavy' }));
    assert.ok(heavy.includes('data-testid="heavy-hit-pulse"'));
    assert.ok(!heavy.includes('data-testid="crit-pulse"'), '적 강타는 치명타 펄스가 아니다');
    assert.ok(heavy.includes('--aether-life-lo-rgb'), '붉은 비네트');
    assert.ok(!heavy.includes('--aether-gold-hi-rgb'), '적 강타에 금빛을 쓰지 않는다');
    assert.ok(heavy.includes('pointer-events-none'));
});
