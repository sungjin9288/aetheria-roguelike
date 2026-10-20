// 2026-10 Wave 130(원장 §141) — 화면 문장은 플레이어 언어다.
//
// 자연 플레이 40판(904,379줄)이 실제로 만든 기록 · 이벤트 문장을 전수 감사했다. 조사 오류는 둘뿐이었지만 영어 약어가 많았다:
// 전투 · 유물 기록의 "+43 HP" · "MP 소모 없음" · "ATK +50%"(3만 줄 이상), 상태 이상 키가 그대로 찍힌 "[bleed] 추가 피해"
// (8,611줄), "[Phase 2]", 난이도 안내의 "[GM]". 그 "[GM]" 안내는 기세 단계가 그대로인 동안 전투 시작마다 반복됐다(39,064줄 —
// 전체 기록의 6.3%, 압도 단계에서 전투의 88%). 처치 정수가 쌓는 단계는 "계승 단계 N 달성"이라 불려 계승(회차) 단계와 이름이
// 겹쳤고(28,162줄), 숫자 뒤 조사 판정기가 MSG 안에 하나 더 있었다(Wave 129가 놓친 두 번째 판정기).
//
// 이 계약은 네 겹이다: ① MSG 전수 · 그대로 그리는 데이터 전수에 영어 약어가 없다 ② 변환기(formatEventText)는 낱말을 바꾸면
// 조사도 다시 고른다 ③ 엔진 경로(상태 이상 라벨 · 기세 안내 · 정수 사다리)의 행동 ④ 실제 자연 플레이 기록 전수.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createElement } from 'react';

import { MSG } from '../src/data/messages.ts';
import { repickJosa } from '../src/data/koreanParticles.ts';
import { DB } from '../src/data/db.ts';
import { CLASSES } from '../src/data/classes.ts';
import { RELICS } from '../src/data/relics.ts';
import { BOSS_BRIEFS } from '../src/data/monsters.ts';
import { ACHIEVEMENTS, QUESTS } from '../src/data/quests.ts';
import { TRAIT_DEFINITIONS } from '../src/data/traits.ts';
import { PREMIUM_SHOP } from '../src/data/premiumShop.ts';
import { EVENT_CHAINS } from '../src/data/eventChains.ts';
import { FALLBACK_EVENT_POOL } from '../src/data/aiEventPools.ts';
import { ALL_ASCENSION_RULES } from '../src/data/ascensionRules.ts';
import { AT } from '../src/reducers/actionTypes.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { CombatEngine } from '../src/systems/CombatEngine.ts';
import {
    applyDynamicDifficulty,
    calcPerformanceScore,
    getDifficultyMults,
    withDifficultyNotice,
} from '../src/systems/DifficultyManager.ts';
import { formatEventText } from '../src/utils/eventPresentation.ts';
import StatsPanel from '../src/components/StatsPanel.tsx';
import { JOB_PATHS, runNaturalPlay } from '../scripts/naturalPlay/driver.mjs';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

// 플레이어 문장에 남으면 안 되는 영어 약어 — 능력치(생명 · 기력 · 공격력 · 방어력 · 치명타 · 경험) · 레벨 · 페이즈 · 골드 단위 G · [GM].
const LATIN_ABBREVIATION = /(?<![A-Za-z])(HP|MP|ATK|DEF|CRIT|EXP|GM|NRG|Phase|Lv)(?![A-Za-z])|\d\s?G(?![A-Za-z])/u;
// 상태 이상 효과 키가 그대로 찍힌 꼬리표("[bleed] 추가 피해").
const RAW_STATUS_TAG = /\[(bleed|burn|poison|stun|freeze|curse|fear|blind)\]/u;

const findLatin = (text) => {
    const match = String(text).match(LATIN_ABBREVIATION);
    return match ? match[0] : null;
};

// ── 독립 오라클(판정기와 따로): 한글 음절 종성 · 숫자 읽기.
const DIGIT_SOUND = { 0: 'closed', 1: 'rieul', 2: 'open', 3: 'closed', 4: 'open', 5: 'open', 6: 'closed', 7: 'rieul', 8: 'rieul', 9: 'open' };
const soundOf = (ch) => {
    if (ch in DIGIT_SOUND) return DIGIT_SOUND[ch];
    if (ch === '%') return 'open';
    const code = ch.codePointAt(0);
    if (code < 0xac00 || code > 0xd7a3) return null;
    const jong = (code - 0xac00) % 28;
    return jong === 0 ? 'open' : jong === 8 ? 'rieul' : 'closed';
};
const PAIR_OF = { 을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 과: ['과', '와'], 와: ['과', '와'], 으로: ['으로', '로'], 로: ['으로', '로'] };
const expectedParticle = (sound, particle) => {
    const [closed, open] = PAIR_OF[particle];
    if (closed === '으로') return sound === 'closed' ? closed : open;
    return sound === 'open' ? open : closed;
};
const PARTICLE_AT_BOUNDARY = /(으로|을|를|이|가|은|는|과|와|로)(?=$|[\s.,!?…:;)\]」』"'”’·~\-/])/gu;
const NAME_BOUNDARY_BEFORE = /[\s(\[{「『《〈"'“‘·:/>→,]/u;
const CLOSERS = /[\]」』"'”’]+$/u;

/** 아는 이름 · 숫자 뒤 조사가 끝소리와 어긋난 곳(이름 목록 밖 낱말은 보지 않는다 — '마을' · '사이'처럼 조사로 끝나는 낱말이 있다). */
const findParticleMismatches = (text, names) => {
    const found = [];
    PARTICLE_AT_BOUNDARY.lastIndex = 0;
    let match;
    while ((match = PARTICLE_AT_BOUNDARY.exec(text))) {
        const particle = match[1];
        const before = text.slice(0, match.index).replace(CLOSERS, '');
        const sound = before ? soundOf(before.slice(-1)) : null;
        if (!sound || expectedParticle(sound, particle) === particle) continue;
        if (/[0-9%]$/u.test(before)) {
            found.push(`${before.slice(-8)}${particle}`);
            continue;
        }
        for (let length = Math.min(24, before.length); length >= 1; length -= 1) {
            const candidate = before.slice(-length);
            const previous = before.slice(-length - 1, -length);
            if (names.has(candidate) && (previous === '' || NAME_BOUNDARY_BEFORE.test(previous))) {
                found.push(`${candidate}${particle}`);
                break;
            }
        }
    }
    return found;
};

const STATIC_NAMES = new Set([
    ...Object.keys(CLASSES),
    ...Object.keys(DB.MAPS),
    ...Object.keys(DB.MONSTERS || {}),
    ...RELICS.map((relic) => relic.name),
    ...Object.values(CLASSES).flatMap((def) => (def.skills || []).map((skill) => skill.name)),
    ...Object.values(DB.ITEMS).flat().map((item) => item?.name),
    ...ALL_ASCENSION_RULES.map((rule) => rule.name),
].filter((name) => typeof name === 'string' && name.trim()));

// ── MSG 전수: 문자열 · 함수(표본 인자) · 중첩 객체.
const SAMPLE_ARGS = [
    ['가나다', 3, '라마바', 4, '사아자'],
    [3, 4, 5, 6, 7],
    ['가나다', '라마바', '사아자', '차카타', '파하'],
    [3, '가나다', 4, '라마바'],
    [true, 3],
    [false, 3],
];
const collectMsgOutputs = () => {
    const outputs = [];
    const take = (where, value) => {
        if (typeof value === 'string') outputs.push({ where, text: value });
        else if (typeof value === 'function') {
            for (const args of SAMPLE_ARGS) {
                try {
                    const result = value(...args);
                    if (typeof result === 'string') outputs.push({ where, text: result });
                } catch {
                    // 인자 모양이 맞지 않는 표본은 건너뛴다.
                }
            }
        }
    };
    for (const [key, value] of Object.entries(MSG)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            for (const [inner, entry] of Object.entries(value)) take(`MSG.${key}.${inner}`, entry);
        } else if (Array.isArray(value)) {
            value.flat(2).forEach((entry, index) => take(`MSG.${key}[${index}]`, entry));
        } else {
            take(`MSG.${key}`, value);
        }
    }
    return outputs;
};

test('[MSG 전수] 영어 약어(HP · MP · ATK · Phase · [GM] · Lv · 숫자 뒤 G) · 상태 이상 키 · "스킬"이 없다', () => {
    const outputs = collectMsgOutputs();
    assert.ok(outputs.length > 1000, String(outputs.length));
    const offenders = outputs.flatMap(({ where, text }) => {
        const latin = findLatin(text);
        if (latin) return [`${where}: ${latin} | ${text.slice(0, 80)}`];
        if (RAW_STATUS_TAG.test(text)) return [`${where}: 상태 이상 키 | ${text.slice(0, 80)}`];
        if (text.includes('스킬')) return [`${where}: 스킬 | ${text.slice(0, 80)}`];
        return [];
    });
    assert.deepEqual([...new Set(offenders)], []);
});

test('[데이터 전수] 변환 없이 그리는 문장(보스 브리핑 · 업적 · 임무 · 성향 · 크리스탈 상점)에 영어 약어가 없다', () => {
    const offenders = [];
    const walk = (where, value) => {
        if (typeof value === 'string') {
            const latin = findLatin(value);
            if (latin) offenders.push(`${where}: ${latin} | ${value.slice(0, 80)}`);
            return;
        }
        if (Array.isArray(value)) value.forEach((entry, index) => walk(`${where}[${index}]`, entry));
        else if (value && typeof value === 'object') {
            for (const [key, entry] of Object.entries(value)) {
                if (/^(id|key|type|target|effect|stat|icon|tone|lootTheme|mechanics)$/u.test(key)) continue;
                walk(`${where}.${key}`, entry);
            }
        }
    };
    walk('BOSS_BRIEFS', BOSS_BRIEFS);
    ACHIEVEMENTS.forEach((achievement) => walk(`ACHIEVEMENTS.${achievement.id}`, { title: achievement.title, desc: achievement.desc }));
    QUESTS.forEach((quest) => walk(`QUESTS.${quest.id}`, { title: quest.title, desc: quest.desc, hook: quest.hook }));
    walk('TRAIT_DEFINITIONS', TRAIT_DEFINITIONS);
    walk('PREMIUM_SHOP', PREMIUM_SHOP);
    assert.deepEqual(offenders, []);
    // 고친 자리가 실제로 생명 · 기력 · 골드를 말한다(빈 문장으로 통과하지 않게).
    assert.match(BOSS_BRIEFS['시간의 파수꾼'].counterHint, /생명을 넉넉히/u);
    assert.equal(QUESTS.find((quest) => quest.id === 62).desc, '생명 20% 이하에서 승리 5회');
    assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === 'ach_gold_1000').desc, '누적 골드 1,000 달성');
});

test('[변환기] formatEventText는 낱말을 바꾸면 뒤의 조사도 새 낱말에 맞춘다', () => {
    assert.equal(formatEventText('운이 좋았다! 1000G를 손에 쥐었다. (+500G)'), '운이 좋았다! 골드 1000을 손에 쥐었다. (골드 +500)');
    assert.equal(formatEventText('300G가 남았다'), '골드 300이 남았다');
    assert.equal(formatEventText('2000G에 제시합니다'), '골드 2000에 제시합니다');
    assert.equal(formatEventText('HP를 넉넉히'), '생명을 넉넉히');
    assert.equal(formatEventText('MP가 부족하다'), '기력이 부족하다');
    assert.equal(formatEventText('ATK로 바뀐다'), '공격력으로 바뀐다');
    assert.equal(formatEventText('HP가득'), '생명가득', '뒤에 한글이 이어지는 글자는 조사가 아니다');
    assert.equal(formatEventText('(+60EXP +200G)'), '(경험 +60 골드 +200)');
    // 데이터 전수: 이벤트 체인 · 폴백 풀의 모든 문장을 거친 결과에 영어 약어 · 어긋난 숫자 조사가 없다.
    const texts = [];
    const walk = (value) => {
        if (typeof value === 'string') texts.push(value);
        else if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(EVENT_CHAINS);
    walk(FALLBACK_EVENT_POOL);
    assert.ok(texts.length > 300, String(texts.length));
    const offenders = texts.flatMap((raw) => {
        const formatted = formatEventText(raw);
        const latin = findLatin(formatted);
        const mismatches = findParticleMismatches(formatted, STATIC_NAMES);
        return latin || mismatches.length ? [`${latin || ''} ${mismatches.join(',')} | ${formatted.slice(0, 80)}`] : [];
    });
    assert.deepEqual(offenders, []);
});

test('[판정기 하나] MSG.NUMBER_PARTICLE은 koreanParticles 판정과 같고, MSG에 끝자리 표가 따로 없다', () => {
    for (const particle of ['을', '를', '이', '가', '은', '는', '과', '와']) {
        for (let amount = 0; amount <= 2000; amount += 1) {
            assert.equal(MSG.NUMBER_PARTICLE(particle, amount), repickJosa(amount, particle), `${amount}${particle}`);
        }
    }
    const source = fs.readFileSync('src/data/messages.ts', 'utf8');
    assert.doesNotMatch(source, /NUMBER_FINAL_CONSONANT_DIGITS/u);
    // Wave 130에서 고친 조사: 대괄호 · 따옴표로 감싼 이름도 받침을 따른다.
    assert.equal(MSG.ASCENSION_RULE_CONQUERED('길 잃은 순례'), '📜 회차 규칙 [길 잃은 순례]를 정복했습니다.');
    assert.equal(MSG.ASCENSION_RULE_CONQUERED('강적의 길'), '📜 회차 규칙 [강적의 길]을 정복했습니다.');
    assert.match(MSG.ASCEND_DONE(10, '에테르의 신'), /'에테르의 신'과 영구 성장/u);
});

test('[상태 이상 라벨] 지속 피해 기술의 추가 피해 기록은 한국어 라벨이다(효과 키를 찍지 않는다)', () => {
    const [job, skill] = Object.entries(CLASSES)
        .flatMap(([name, def]) => (def.skills || []).map((entry) => [name, entry]))
        .find(([, entry]) => entry.effect === 'bleed' && entry.mult > 0);
    const player = {
        hp: 1000, maxHp: 1000, mp: 9999, maxMp: 9999, status: [], job, equip: {}, skillChoices: {},
        skillLoadout: { selected: 0, cooldowns: {} },
    };
    const enemy = { name: '검증용 몬스터', hp: 1_000_000, maxHp: 1_000_000, atk: 10, def: 0, pattern: { guardChance: 0, heavyChance: 0 } };
    const result = CombatEngine.performSkill(player, enemy, { atk: 500, def: 0, relics: [], activeSynergies: [], maxMp: 9999 }, skill, () => 0.5);
    const texts = result.logs.map((entry) => entry.text);
    assert.ok(texts.some((text) => text.startsWith(`[${MSG.DOT_LABELS.bleed}] 추가 피해 +`)), texts.join('\n'));
    assert.ok(!texts.some((text) => RAW_STATUS_TAG.test(text)), texts.join('\n'));
});

test('[기세 안내] 단계가 바뀔 때만 알린다 — 같은 단계가 이어지는 동안은 조용하다', () => {
    const overwhelm = Array.from({ length: 20 }, () => ({ result: 'win', hpRatio: 1 }));
    // 위기: 승리의 남은 생명 0은 점수 계산에서 0.5로 읽힌다(`hpRatio || 0.5`) — 0.01을 쓴다(map-badge-title-text-contract F14와 같은 픽스처).
    const crisis = [{ result: 'win', hpRatio: 0.01 }, ...Array.from({ length: 9 }, () => ({ result: 'death', hpRatio: 0 }))];
    const enemy = { name: '적', baseName: '적', hp: 100, maxHp: 100, atk: 10, def: 1, exp: 10, gold: 10 };
    const playerWith = (recentBattles, difficultyNotice) => makePlayerFixture({
        level: 30,
        stats: { ...structuredClone(INITIAL_STATE.player.stats), recentBattles, ...(difficultyNotice ? { difficultyNotice } : {}) },
    });
    const run = (player) => {
        const logs = [];
        const result = applyDynamicDifficulty(enemy, player, (type, text) => logs.push(text));
        return { logs, label: result.noticeLabel };
    };
    const first = run(playerWith(overwhelm));
    assert.equal(first.label, MSG.DIFFICULTY_LABEL_OVERWHELM);
    assert.deepEqual(first.logs, [MSG.DIFFICULTY_GM_OVERWHELM], '처음 그 단계에 들어서면 알린다');
    assert.deepEqual(run(playerWith(overwhelm, first.label)).logs, [], '알린 단계가 그대로면 조용하다');
    const shifted = run(playerWith(crisis, first.label));
    assert.deepEqual(shifted.logs, [MSG.DIFFICULTY_GM_CRISIS], '다른 단계로 바뀌면 다시 알린다');
    // 기록: 같은 단계면 같은 참조, 다르면 남긴다.
    const recorded = withDifficultyNotice(playerWith(overwhelm), first.label);
    assert.equal(recorded.stats.difficultyNotice, first.label);
    assert.equal(withDifficultyNotice(recorded, first.label), recorded);
    assert.equal(getDifficultyMults(calcPerformanceScore(recorded)).label, first.label);
});

test('[정수 사다리] 처치 정수의 단계는 기록 · 능력치 화면 모두 "정수 사다리"다(계승 단계와 이름이 겹치지 않는다)', () => {
    assert.equal(MSG.LEGACY_RANK(117), '정수 사다리 117단계 달성');
    const player = makePlayerFixture({ meta: { ...structuredClone(INITIAL_STATE.player.meta), rank: 42, essence: 10 } });
    const html = renderStatic(createElement(StatsPanel, { player, stats: { atk: 10, def: 5, maxHp: 100, maxMp: 50, crit: 0.05 } }));
    assert.ok(html.includes(MSG.STATS_ESSENCE_LADDER_RANK(42)), '요약 칩');
    assert.ok(html.includes(`>${MSG.STATS_ESSENCE_LADDER_LABEL}<`), '칸 이름');
    assert.equal(html.includes('>계승 단계<'), false);
});

test('[실제 경로] 자연 플레이 기록 전수 — 영어 약어 · 상태 이상 키 · 이름 뒤 조사 · 기세 안내 반복이 없다', async () => {
    const GM_LABEL_BY_TEXT = new Map([
        [MSG.DIFFICULTY_GM_OVERWHELM, MSG.DIFFICULTY_LABEL_OVERWHELM],
        [MSG.DIFFICULTY_GM_CRISIS, MSG.DIFFICULTY_LABEL_CRISIS],
        [MSG.DIFFICULTY_GM_DISADVANTAGE, MSG.DIFFICULTY_LABEL_DISADVANTAGE],
    ]);
    const names = new Set(STATIC_NAMES);
    const seen = new WeakSet();
    const offenders = [];
    const repeatedNotices = [];
    let lines = 0;
    let gmLines = 0;
    let combats = 0;
    let statusBonusLines = 0;
    let ladderLines = 0;
    const check = (text, source) => {
        lines += 1;
        const latin = findLatin(text);
        if (latin) offenders.push(`${source} ${latin} | ${text.slice(0, 90)}`);
        if (RAW_STATUS_TAG.test(text)) offenders.push(`${source} 상태 이상 키 | ${text.slice(0, 90)}`);
        const mismatches = findParticleMismatches(text, names);
        if (mismatches.length) offenders.push(`${source} 조사 ${mismatches.join(',')} | ${text.slice(0, 90)}`);
        if (text.startsWith(`[${MSG.DOT_LABELS.bleed}] 추가 피해`) || text.startsWith(`[${MSG.DOT_LABELS.burn}] 추가 피해`)) statusBonusLines += 1;
        if (text.startsWith('정수 사다리 ')) ladderLines += 1;
    };
    const onDispatch = (prev, action, next) => {
        if (next.enemy && next.enemy !== prev.enemy) {
            if (next.enemy.name) names.add(next.enemy.name);
            if (next.enemy.baseName) names.add(next.enemy.baseName);
        }
        if (action.type === AT.SET_GAME_STATE && action.payload === 'combat' && prev.gameState !== 'combat') combats += 1;
        if (action.type === AT.ADD_LOG && GM_LABEL_BY_TEXT.has(action.payload?.text)) {
            gmLines += 1;
            if (GM_LABEL_BY_TEXT.get(action.payload.text) === prev.player?.stats?.difficultyNotice) repeatedNotices.push(action.payload.text);
        }
        if (next.logs !== prev.logs) {
            for (const log of next.logs) {
                if (seen.has(log)) continue;
                seen.add(log);
                check(log.text, `log:${log.type}`);
            }
        }
        if (next.currentEvent && next.currentEvent !== prev.currentEvent) {
            const event = next.currentEvent;
            [event.desc, ...(event.choices || [])].forEach((text) => typeof text === 'string' && check(formatEventText(text), 'event'));
        }
    };
    for (const path of ['knight', 'archmage']) {
        await runNaturalPlay({ seed: 1, jobPath: JOB_PATHS[path], runs: 1, maxSteps: 3000, onDispatch });
    }
    assert.ok(lines > 10_000, `기록 ${lines}줄`);
    assert.ok(combats > 500, `전투 ${combats}번`);
    // 검사가 공허하지 않다: 고친 문장이 실제로 나왔다.
    assert.ok(gmLines >= 1, '기세 안내가 한 번은 나온다');
    assert.ok(statusBonusLines >= 1, '지속 피해 추가 피해 기록이 나온다');
    assert.ok(ladderLines >= 1, '정수 사다리 기록이 나온다');
    assert.deepEqual(offenders.slice(0, 20), []);
    assert.deepEqual(repeatedNotices, [], '알린 단계를 다시 알리지 않는다');
    assert.ok(gmLines * 10 < combats, `기세 안내 ${gmLines}번 · 전투 ${combats}번 — 반복되지 않는다`);
});
