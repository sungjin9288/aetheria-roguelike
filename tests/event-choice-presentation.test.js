import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildCampfireEvent } from '../src/utils/campfireEvent.js';
import { buildScoutEvent } from '../src/utils/scoutEvents.js';
import { buildBossChallengeEvent } from '../src/utils/bossGauge.js';
import {
    formatEventText,
    getEventChoicePreview,
    getEventPanelCopy,
} from '../src/utils/eventPresentation.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relativePath) => readFile(path.join(ROOT, relativePath), 'utf8');

test('event text converts internal stat and reward units into player language', () => {
    assert.equal(
        formatEventText('보상 (+50EXP +200G), 피해 -30HP, 회복 +12MP, ATK +3, DEF +2'),
        '보상 (경험 +50 골드 +200), 피해 생명 -30, 회복 기력 +12, 공격력 +3, 방어력 +2',
    );
    assert.equal(formatEventText('내기 수락 (500G)'), '내기 수락 (골드 500)');
    assert.equal(formatEventText('Lv. 12'), '레벨 12');
});

test('event heading reflects the current encounter without exposing internal event labels', () => {
    assert.deepEqual(getEventPanelCopy({}), { title: '뜻밖의 조우', kind: '조우' });
    assert.deepEqual(getEventPanelCopy({ isCampfire: true }), { title: '모닥불 앞에서', kind: '휴식처' });
    assert.deepEqual(getEventPanelCopy({ isScout: true }), { title: '앞길 정찰', kind: '정찰' });
    assert.deepEqual(
        getEventPanelCopy({ isBossGaugeChallenge: true, bossName: '호수의 수호신' }),
        { title: '호수의 수호신의 흔적', kind: '보스' },
    );
    assert.deepEqual(
        getEventPanelCopy({ _chainId: 'ancient_prophecy', title: '예언의 돌판' }),
        { title: '예언의 돌판', kind: '이야기' },
    );
});

test('ordinary events reveal useful outcome categories without disclosing exact hidden results', () => {
    const event = {
        choices: ['조사한다', '숨을 고른다', '억지로 연다', '지나친다'],
        outcomes: [
            { choiceIndex: 0, gold: 40 },
            { choiceIndex: 1, hp: 20, mp: 10 },
            { choiceIndex: 2, hp: -30 },
            { choiceIndex: 3 },
        ],
    };

    assert.deepEqual(getEventChoicePreview(event, 0), { text: '보상 가능', tone: 'reward' });
    assert.deepEqual(getEventChoicePreview(event, 1), { text: '회복 가능', tone: 'recovery' });
    assert.deepEqual(getEventChoicePreview(event, 2), { text: '생명 손실 위험', tone: 'danger' });
    assert.deepEqual(getEventChoicePreview(event, 3), { text: '결과는 선택 뒤에 드러남', tone: 'unknown' });
});

test('known campfire, scout, and boss rules are explained before commitment', () => {
    const campfire = buildCampfireEvent({ maxHp: 200, maxMp: 100 });
    assert.deepEqual(getEventChoicePreview(campfire, 0), { text: '생명 +80 · 기력 +40', tone: 'recovery' });
    assert.match(getEventChoicePreview(campfire, 1).text, /다음 전투 공격력 \+\d+% · \d+턴/);

    const scout = buildScoutEvent({ stats: {} }, { type: 'dungeon' }, () => 0.99);
    assert.deepEqual(getEventChoicePreview(scout, 0), { text: '전투 확정 · 처치 보상 증가', tone: 'reward' });
    assert.deepEqual(getEventChoicePreview(scout, 1), { text: '전투 없이 이변과 유물 탐색', tone: 'story' });

    const boss = buildBossChallengeEvent('호수의 수호신');
    assert.deepEqual(getEventChoicePreview(boss, 0), { text: '호수의 수호신 전투 시작', tone: 'danger' });
    assert.deepEqual(getEventChoicePreview(boss, 1), { text: '이번에는 물러남 · 다음 탐험에 다시 선택', tone: 'unknown' });
});

test('story-chain previews describe progression and reward type without exposing outcome prose', () => {
    const chainEvent = {
        _chainId: 'dragon_legacy',
        choices: ['받는다', '거절한다'],
        outcomes: [
            { type: 'chain_advance', reward: { type: 'relic' }, log: '숨겨진 결말' },
            { type: 'chain_advance_fail', reward: null, log: '또 다른 결말' },
        ],
    };

    assert.deepEqual(getEventChoicePreview(chainEvent, 0), { text: '이야기 진행 · 유물 보상', tone: 'reward' });
    assert.deepEqual(getEventChoicePreview(chainEvent, 1), { text: '이야기의 흐름이 달라질 수 있음', tone: 'danger' });
});

test('event screen and result log keep the same natural player vocabulary', async () => {
    const [panel, actions, smokeInjector] = await Promise.all([
        readSrc('src/components/EventPanel.tsx'),
        readSrc('src/hooks/gameActions/eventActions.ts'),
        readSrc('src/hooks/useGameTestApi.ts'),
    ]);

    for (const label of ['탐험 중 마주친 일', '지금 상황', '어떤 길을 택하시겠습니까?', '예상 결과']) {
        assert.match(panel, new RegExp(label));
    }
    assert.match(panel, /getEventChoicePreview/);
    assert.doesNotMatch(panel, /Decision Window|>Event<|>Prompt<|Choice \{idx \+ 1\}|>\s*Commit\s*</);

    assert.match(actions, /formatEventText\(selectedOutcome\.log/);
    assert.match(actions, /이야기 보상 ·/);
    assert.doesNotMatch(actions, /`ATK \+|`DEF \+|`HP \+|`MP \+|\[체인 보상\]/);
    assert.doesNotMatch(smokeInjector, /\[TEST EVENT\]/);
});
