import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';

import ExpeditionDebriefCard from '../src/components/ExpeditionDebriefCard.tsx';
import SystemTab from '../src/components/tabs/SystemTab.tsx';
import { normalizeExpeditionSummary } from '../src/utils/expeditionLedger.ts';
import { getTitlePassiveLabel } from '../src/utils/gameUtils.ts';
import { TITLE_PASSIVES } from '../src/data/titles.ts';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

for (const endLevel of [1, 2]) {
    test(`기기 귀환 기록은 레벨 ${endLevel}의 성장과 생명을 한글로 표시한다`, () => {
        const summary = normalizeExpeditionSummary({
            id: 'language-qa', startedAt: 1000, endedAt: 61000,
            destination: '고요한 숲', returnLocation: '시작의 마을',
            startLevel: 1, endLevel, expGained: 80, lowestHp: 50, lowestHpPercent: 30,
        });
        assert.ok(summary);
        const html = renderStatic(createElement(ExpeditionDebriefCard, {
            summary, recommendation: { kind: 'rest', label: '휴식', detail: '' },
            onClose() {}, onPrimaryAction() {},
        }));
        const text = html.replace(/<[^>]*>/g, '');
        assert.ok(text.includes(endLevel === 1 ? '레벨 1' : '레벨 1 → 2'));
        assert.ok(text.includes('경험'));
        assert.ok(text.includes('+80'));
        assert.ok(text.includes('생명 50 · 30%'));
        assert.doesNotMatch(text, /\b(?:LV|EXP|HP)\b/);
    });
}

test('기기 설정의 현재 칭호와 목록은 능력치 약어를 풀어 표시한다', () => {
    const html = renderStatic(createElement(SystemTab, {
        player: makePlayerFixture({ activeTitle: 'first_blood', titles: ['first_blood', 'warlord'] }),
        stats: { maxHp: 150, maxMp: 50 },
        actions: { leaderboard: [], isAdmin: () => false },
        runtime: { viewport: 'mobile', gameState: 'idle', syncStatus: 'synced', isAiThinking: false },
    }));
    const section = html.slice(html.indexOf('data-testid="system-title-section"'), html.indexOf('data-testid="system-relic-list"'));
    assert.ok(section.includes('공격력 +1'));
    assert.ok(section.includes('공격력 +4 · 치명타 +1%'));
    assert.doesNotMatch(section, /\b(?:ATK|DEF|HP|MP|CRIT)\b/);
});

test('칭호 표시 변환은 모든 기존 수치와 데이터 원본을 보존한다', () => {
    const before = structuredClone(TITLE_PASSIVES);
    for (const [token, passive] of Object.entries(TITLE_PASSIVES)) {
        const label = getTitlePassiveLabel(token);
        assert.doesNotMatch(label, /\b(?:ATK|DEF|HP|MP|CRIT)\b/, token);
        assert.deepEqual(label.match(/[+\d.%]+/g), passive.label.match(/[+\d.%]+/g), token);
    }
    assert.deepEqual(TITLE_PASSIVES, before);
    assert.equal(getTitlePassiveLabel(null), '패시브 없음');
    assert.equal(getTitlePassiveLabel('missing-title'), '패시브 없음');
});
