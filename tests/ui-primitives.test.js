// 2026-10 디자인 기반 — 에테르 유리 기본 부품(ActionButton · Gauge · Chip)의 렌더 계약.
//
// 부품은 모양을 CSS 클래스(`.ae-btn-*` · `.ae-gauge-*` · `.ae-chip-*`, src/index.css)로만 정하고, 글자는 부르는 쪽이 MSG로 넘긴다.
// 여기서는 실제로 그린 HTML로 확인한다 — 변형 · 크기 클래스, 버튼 속성 전달, 미터의 접근성 값, 잔상 · 눈금 조건.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import ActionButton from '../src/components/ui/ActionButton.tsx';
import Chip from '../src/components/ui/Chip.tsx';
import Gauge from '../src/components/ui/Gauge.tsx';
import { getGaugePercent } from '../src/components/ui/gaugeMath.ts';
import SeasonPassPanel from '../src/components/tabs/SeasonPassPanel.tsx';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/** 첫 여는 태그의 속성 → 값. */
const rootAttributes = (html) => {
    const open = html.match(/^<[a-z]+([^>]*)>/u);
    assert.ok(open, `여는 태그가 있다: ${html.slice(0, 80)}`);
    return Object.fromEntries([...open[1].matchAll(/([\w-]+)="([^"]*)"/gu)].map(([, key, value]) => [key, value]));
};

const classList = (attributes) => (attributes.class ?? '').split(/\s+/u).filter(Boolean);

test('ActionButton: 변형 · 크기마다 클래스가 하나씩 붙고 기본은 glass · md · type=button이다', () => {
    const base = rootAttributes(renderStatic(createElement(ActionButton, { label: '탐험' })));
    assert.equal(base.type, 'button', '폼 안에서도 제출하지 않는다');
    assert.deepEqual(classList(base), ['ae-btn', 'ae-btn-glass']);
    assert.equal(base['data-variant'], 'glass');
    assert.equal(base['data-size'], 'md');

    for (const variant of ['primary', 'glass', 'ghost', 'danger']) {
        for (const size of ['md', 'lg']) {
            const attributes = rootAttributes(renderStatic(createElement(ActionButton, { label: '행동', variant, size })));
            const classes = classList(attributes);
            assert.ok(classes.includes(`ae-btn-${variant}`), `${variant}/${size}`);
            assert.equal(classes.includes('ae-btn-lg'), size === 'lg', `${variant}/${size} 크기`);
            assert.equal(classes.filter((name) => /^ae-btn-(?:primary|glass|ghost|danger)$/u.test(name)).length, 1);
        }
    }
});

test('ActionButton: 버튼 속성(data-testid · disabled · aria · type · className)을 그대로 넘긴다', () => {
    const html = renderStatic(createElement(ActionButton, {
        label: '도주',
        variant: 'ghost',
        'data-testid': 'combat-flee',
        disabled: true,
        'aria-describedby': 'flee-hint',
        type: 'submit',
        className: 'w-full',
    }));
    const attributes = rootAttributes(html);
    assert.equal(attributes['data-testid'], 'combat-flee');
    assert.ok('disabled' in attributes || /<button[^>]*\sdisabled[\s>=]/u.test(html), '비활성 속성');
    assert.equal(attributes['aria-describedby'], 'flee-hint');
    assert.equal(attributes.type, 'submit', '부르는 쪽이 정한 type이 이긴다');
    assert.deepEqual(classList(attributes), ['ae-btn', 'ae-btn-ghost', 'w-full']);
    assert.match(html, />도주<\/button>$/u, '부제가 없으면 글자만 그린다');
});

test('ActionButton: 아이콘은 보조 기술에 숨기고, 부제는 두 번째 줄로 그린다', () => {
    const html = renderStatic(createElement(ActionButton, {
        label: '출발',
        sublabel: '수정 동굴',
        icon: createElement('svg', { 'data-icon': 'compass' }),
        variant: 'primary',
        size: 'lg',
    }));
    assert.match(html, /<span class="ae-btn-icon" aria-hidden="true"><svg data-icon="compass"><\/svg><\/span>/u);
    assert.match(html, /<span class="ae-btn-text"><span>출발<\/span><span class="ae-btn-sublabel">수정 동굴<\/span><\/span>/u);
    assert.doesNotMatch(renderStatic(createElement(ActionButton, { label: '출발' })), /ae-btn-icon|ae-btn-text/u);
});

test('getGaugePercent: 0 ~ 100으로 자르고 최대가 0 이하 · 수가 아니면 0이다', () => {
    assert.equal(getGaugePercent(50, 200), 25);
    assert.equal(getGaugePercent(1, 3), 33.3);
    assert.equal(getGaugePercent(250, 200), 100);
    assert.equal(getGaugePercent(-5, 200), 0);
    assert.equal(getGaugePercent(10, 0), 0);
    assert.equal(getGaugePercent(10, -1), 0);
    assert.equal(getGaugePercent(Number.NaN, 100), 0);
    assert.equal(getGaugePercent(10, Number.POSITIVE_INFINITY), 0);
});

test('Gauge: role=meter와 값 범위를 보조 기술에 알리고, 넘친 값은 최대로 자른다', () => {
    const html = renderStatic(createElement(Gauge, {
        kind: 'life', value: 260, max: 200, label: '생명', valueText: '생명 200 / 200', 'data-testid': 'hp-gauge',
    }));
    const attributes = rootAttributes(html);
    assert.equal(attributes.role, 'meter');
    assert.equal(attributes['aria-label'], '생명');
    assert.equal(attributes['aria-valuemin'], '0');
    assert.equal(attributes['aria-valuemax'], '200');
    assert.equal(attributes['aria-valuenow'], '200');
    assert.equal(attributes['aria-valuetext'], '생명 200 / 200');
    assert.equal(attributes['data-testid'], 'hp-gauge');
    assert.deepEqual(classList(attributes), ['ae-gauge', 'ae-gauge-life', 'ae-sunk']);
    assert.match(html, /data-gauge-part="fill" style="width:100%"/u);
});

test('Gauge: 종류 · 크기 클래스, 잔상은 지금 값보다 클 때만, 눈금은 요청할 때만', () => {
    for (const kind of ['life', 'will', 'exp', 'ether']) {
        const classes = classList(rootAttributes(renderStatic(createElement(Gauge, { kind, value: 1, max: 2, label: '막대', size: 'lg' }))));
        assert.ok(classes.includes(`ae-gauge-${kind}`), kind);
        assert.ok(classes.includes('ae-gauge-lg'), `${kind} lg`);
    }

    const hit = renderStatic(createElement(Gauge, { kind: 'life', value: 60, max: 200, trail: 120, ticks: true, label: '적 생명' }));
    assert.match(hit, /data-gauge-part="trail" style="width:60%"/u);
    assert.match(hit, /data-gauge-part="fill" style="width:30%"/u);
    assert.match(hit, /class="ae-gauge-ticks" data-gauge-part="ticks" aria-hidden="true"/u);
    assert.ok(hit.indexOf('data-gauge-part="trail"') < hit.indexOf('data-gauge-part="fill"'), '잔상이 채움 아래에 깔린다');

    const healed = renderStatic(createElement(Gauge, { kind: 'life', value: 150, max: 200, trail: 120, label: '생명' }));
    assert.doesNotMatch(healed, /data-gauge-part="trail"/u, '회복(잔상 < 지금 값)은 잔상이 없다');
    assert.doesNotMatch(healed, /data-gauge-part="ticks"/u);

    const empty = rootAttributes(renderStatic(createElement(Gauge, { kind: 'will', value: 5, max: 0, labelledBy: 'mp-label' })));
    assert.equal(empty['aria-labelledby'], 'mp-label');
    assert.equal(empty['aria-label'], undefined);
    assert.equal(empty['aria-valuemax'], '0');
    assert.equal(empty['aria-valuenow'], '0', '최대가 0이면 지금 값도 0이다');
});

test('Chip: 의미 색마다 클래스 하나, 중립은 기본 칩, 아이콘은 숨긴다', () => {
    const neutral = rootAttributes(renderStatic(createElement(Chip, null, '대기')));
    assert.deepEqual(classList(neutral), ['ae-chip']);
    assert.equal(neutral['data-tone'], 'neutral');

    for (const tone of ['ether', 'gold', 'threat', 'good']) {
        const attributes = rootAttributes(renderStatic(createElement(Chip, { tone, 'data-testid': `chip-${tone}` }, '표시')));
        assert.deepEqual(classList(attributes), ['ae-chip', `ae-chip-${tone}`]);
        assert.equal(attributes['data-testid'], `chip-${tone}`);
    }

    const withIcon = renderStatic(createElement(Chip, { tone: 'threat', icon: createElement('svg') }, '정예'));
    assert.match(withIcon, /<span class="ae-chip-icon" aria-hidden="true"><svg><\/svg><\/span>정예<\/span>$/u);
});

test('실제 사용처: 시즌 패스 경험 막대는 Gauge이고 이름은 경험 문구가 준다', () => {
    const player = makePlayerFixture({ seasonPass: { tier: 3, xp: 650, claimed: [1, 2], isPremium: false, seasonId: 'S1' } });
    const html = renderStatic(createElement(SeasonPassPanel, { player, dispatch: () => {}, onClaimSeasonReward: () => {} }));

    const gauge = html.match(/<div role="meter"([^>]*)data-testid="season-xp-gauge"[^>]*>/u);
    assert.ok(gauge, '시즌 경험 막대가 미터로 그려진다');
    const labelledBy = gauge[0].match(/aria-labelledby="([^"]+)"/u)?.[1];
    assert.ok(labelledBy, '막대 이름은 다른 요소가 준다');
    const label = html.match(new RegExp(`<span id="${labelledBy.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}"[^>]*>([^<]*)</span>`, 'u'));
    assert.ok(label, '이름을 준 요소가 같은 화면에 있다');
    assert.match(label[1], /시즌 경험/u);
    assert.match(gauge[0], /aria-valuenow="50"/u, '이번 단계 안의 경험(650 − 3단계 × 200)');

    assert.match(html, /<button[^>]*data-testid="season-claim-3"[^>]*class="ae-btn ae-btn-glass shrink-0"/u, '받기 단추는 ActionButton이다');
});
