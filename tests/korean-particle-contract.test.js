// 2026-10 Wave 129(원장 §140) — 이름 · 숫자 뒤의 조사는 받침에 맞춘다.
//
// 화면 문구가 이름 뒤에 조사를 고정으로 붙이던 동안 받침과 어긋났다 — Lv5 전직 단추 "도적로 전직", 안전지대 출발 단추
// "수정 동굴으로 출발"(여섯 출구), 기술 분기 "화염구을 어떻게 바꿀까?". 나머지는 "슬라임이(가) 3 피해를 가했습니다"처럼 둘 다
// 적었다. 조사는 `src/data/koreanParticles.ts` 하나가 고른다.
//
// 이 계약은 세 겹이다: ① 판정기 진리표(받침 · ㄹ · 숫자 읽기 · 괄호 · 판정 불가) ② 실제 이름 전수(직업 · 지역 · 몬스터 ·
// 유물 · 기술 · 아이템)를 테스트 안의 독립 오라클과 대조 ③ src 전체의 부재 불변식(고정 조사 · 괄호 병기).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';

import { getFinalSound, josa, withJosa } from '../src/data/koreanParticles.ts';
import { MSG } from '../src/data/messages.ts';
import { DB } from '../src/data/db.ts';
import { CLASSES } from '../src/data/classes.ts';
import { RELICS } from '../src/data/relics.ts';
import { GS } from '../src/reducers/gameStates.ts';
import { INITIAL_STATE } from '../src/reducers/gameReducer.ts';
import { getAvailableCommands } from '../src/utils/commandSuggestions.ts';
import { getTownActionPresentation } from '../src/utils/townActionPresentation.ts';
import JobChangePanel from '../src/components/tabs/JobChangePanel.tsx';
import { renderStatic } from './helpers/render.ts';

// ── 독립 오라클: 한글 음절의 종성만 본다(판정기와 따로 구현 — 같은 실수를 공유하지 않게).
const jongseongOf = (word) => {
    const code = String(word).trim().codePointAt(String(word).trim().length - 1);
    assert.ok(code >= 0xac00 && code <= 0xd7a3, `오라클은 한글 음절로 끝나는 이름만 판정한다: ${word}`);
    return (code - 0xac00) % 28;
};
const expectEuroRo = (word) => (jongseongOf(word) === 0 || jongseongOf(word) === 8 ? '로' : '으로');
const expectEulReul = (word) => (jongseongOf(word) === 0 ? '를' : '을');
const expectIGa = (word) => (jongseongOf(word) === 0 ? '가' : '이');
const expectEunNeun = (word) => (jongseongOf(word) === 0 ? '는' : '은');
const expectGwaWa = (word) => (jongseongOf(word) === 0 ? '와' : '과');

test('[판정기] 받침 · ㄹ 받침 · 받침 없음 — 쌍마다 맞는 형태를 고른다', () => {
    const table = [
        ['검', '을/를', '을'], ['사과', '을/를', '를'], ['물', '을/를', '을'],
        ['슬라임', '이/가', '이'], ['늑대', '이/가', '가'], ['거미떼', '이/가', '가'],
        ['도적', '은/는', '은'], ['마법사', '은/는', '는'],
        ['철검', '과/와', '과'], ['롱소드', '과/와', '와'],
        // '으로/로'만 ㄹ 받침에서 '로'다.
        ['숲', '으로/로', '으로'], ['호수', '으로/로', '로'], ['동굴', '으로/로', '로'], ['폐허', '으로/로', '로'],
        ['도적', '으로/로', '으로'], ['어쌔신', '으로/로', '으로'], ['마법사', '으로/로', '로'], ['그림자 주군', '으로/로', '으로'],
    ];
    for (const [word, pair, expected] of table) assert.equal(josa(word, pair), expected, `${word} + ${pair}`);
    assert.equal(withJosa('수정 동굴', '으로/로'), '수정 동굴로');
    assert.equal(withJosa('도적', '으로/로'), '도적으로');
});

test('[판정기] 숫자는 읽는 소리로 판정한다 — 끝자리 · 0으로 끝나는 자리 이름 · 쉼표 · 소수점', () => {
    const table = [
        [1, '으로/로', '로'], [7, '으로/로', '로'], [8, '으로/로', '로'], [3, '으로/로', '으로'], [10, '으로/로', '으로'],
        [2, '을/를', '를'], [5, '을/를', '를'], [9, '을/를', '를'], [3, '을/를', '을'], [6, '을/를', '을'], [1, '을/를', '을'],
        [10, '이/가', '이'], [100, '이/가', '이'], [1000, '이/가', '이'], [0, '이/가', '이'],
        ['1,234', '을/를', '를'], ['12,000', '이/가', '이'], ['1.5', '으로/로', '로'], ['x2', '으로/로', '로'], ['x3', '으로/로', '으로'],
        ['강철 검 +3', '을/를', '을'], ['2/10', '이/가', '이'], ['2/5', '이/가', '가'],
    ];
    for (const [word, pair, expected] of table) assert.equal(josa(word, pair), expected, `${word} + ${pair}`);
});

test('[판정기] 닫는 괄호 · 따옴표는 건너뛰고, 끝소리를 알 수 없으면 두 형태를 함께 적는다', () => {
    assert.equal(josa('[불꽃 검]', '은/는'), '은');
    assert.equal(josa('「혈맹 불사」', '이/가'), '가');
    assert.equal(josa('"엘릭서"', '을/를'), '를');
    assert.equal(josa('+30%', '은/는'), '는');
    assert.equal(getFinalSound('HP'), null);
    assert.equal(josa('HP', '을/를'), '을(를)');
    assert.equal(josa('', '이/가'), '이(가)');
    assert.equal(josa(undefined, '으로/로'), '(으)로');
});

test('[전수] 직업 18개 — 전직 단추는 받침에 맞는 "(으)로 전직"이다(도적 · 무당 · 어쌔신 · 팔라딘 · 그림자 주군)', () => {
    const names = Object.keys(CLASSES);
    assert.ok(names.length >= 18, String(names.length));
    for (const name of names) assert.equal(MSG.JOB_CHANGE_CONFIRM(name), `${name}${expectEuroRo(name)} 전직`, name);
    assert.equal(MSG.JOB_CHANGE_CONFIRM('도적'), '도적으로 전직');
});

test('[전수] 지역 52곳 — 출발 · 이동 문구는 받침에 맞는 "(으)로"다', () => {
    const names = Object.keys(DB.MAPS);
    assert.ok(names.length >= 52, String(names.length));
    for (const name of names) {
        const ro = expectEuroRo(name);
        assert.equal(MSG.TOWN_DEPART(name), `${name}${ro} 출발`, name);
        assert.equal(MSG.TOWN_DEPART_FIRST(name), `${name}${ro} 첫 출발`, name);
        assert.equal(MSG.MAP_MOVE_TO(name), `${name}${ro} 이동`, name);
        assert.equal(MSG.COMMAND_SUGGEST_MOVE(name), `→ ${name}${ro} 이동`, name);
    }
});

test('[전수] 몬스터 · 유물 · 기술 · 아이템 이름 — 전투 기록 · 보상 · 분기 문구의 조사가 받침에 맞는다', () => {
    const monsters = Object.keys(DB.MONSTERS).filter((name) => /[가-힣]$/u.test(name));
    assert.ok(monsters.length > 100, String(monsters.length));
    for (const name of monsters) {
        assert.equal(MSG.COMBAT_ENEMY_GUARD(name), `${name}${expectIGa(name)} 방어 자세를 취했습니다.`, name);
        assert.equal(MSG.ELITE_ENRAGE_LOG(name), `${name}${expectIGa(name)} 광폭화합니다! 공격이 거세집니다!`, name);
    }
    const relics = RELICS.map((relic) => relic.name).filter((name) => /[가-힣]$/u.test(name));
    assert.ok(relics.length > 50, String(relics.length));
    for (const name of relics) {
        assert.equal(MSG.CHAIN_REWARD_RELIC(name), `이야기 보상 · 유물 ${name}${expectEulReul(name)} 얻었습니다.`, name);
        assert.equal(MSG.CHAIN_RELIC_ALREADY_OWNED(name), `${name}${expectEunNeun(name)} 이미 보유하고 있습니다. 다른 선택을 골라주세요.`, name);
    }
    const skills = new Set(Object.values(CLASSES).flatMap((def) => (def.skills || []).map((skill) => skill.name)).filter((name) => /[가-힣]$/u.test(name)));
    assert.ok(skills.size > 40, String(skills.size));
    for (const name of skills) assert.equal(MSG.SKILL_BRANCH_QUESTION(name), `${name}${expectEulReul(name)} 어떻게 바꿀까?`, name);
    const items = [...new Set(Object.values(DB.ITEMS).flat().map((item) => item?.name).filter((name) => typeof name === 'string' && /[가-힣]$/u.test(name)))];
    assert.ok(items.length > 100, String(items.length));
    for (const name of items) {
        assert.equal(MSG.CODEX_COMPARE_EQUIPPED(name), `현재 ${name}${expectGwaWa(name)} 비교`, name);
        assert.equal(MSG.ITEM_USE_BUFF(name), `${name}${expectEulReul(name)} 사용해 강화 효과를 얻었습니다.`, name);
    }
});

test('[실제 경로] 안전지대 출발 단추 · 이동 자동완성 · 전직 단추가 받침에 맞는 조사를 그린다', () => {
    // 출발 단추: 받침이 없거나 ㄹ인 출구(수정 동굴 · 고대 하수도 · 피라미드 · 얼음 성채 · 기계 폐도 · 붕괴된 마법 요새)도 '로'.
    const safeExits = Object.entries(DB.MAPS)
        .filter(([, map]) => map.type === 'safe')
        .flatMap(([loc, map]) => (map.exits || []).map((exit) => ({ loc, exit })));
    const roExits = safeExits.filter(({ exit }) => expectEuroRo(exit) === '로');
    assert.ok(roExits.length >= 6, `받침 없거나 ㄹ인 안전지대 출구 ${roExits.length}`);
    for (const { loc, exit } of safeExits) {
        const player = { ...structuredClone(INITIAL_STATE.player), loc, hp: 100, maxHp: 100, mp: 100, maxMp: 100, equip: { weapon: { name: '검' }, armor: { name: '갑옷' } } };
        const presentation = getTownActionPresentation({
            player,
            mapData: DB.MAPS[loc],
            stats: { maxHp: 100, maxMp: 100 },
            guidance: { title: '', detail: '', primaryAction: null },
            preparation: { tracker: { questId: 999 }, canDepart: true, isClaimable: false, destination: exit },
            hasGrave: false,
            classes: DB.CLASSES,
            recipes: [],
            consumables: [],
        });
        assert.equal(presentation.primary.kind, 'open_move');
        assert.equal(presentation.primary.label, `${exit}${expectEuroRo(exit)} 출발`, `${loc} → ${exit}`);
    }
    // 이동 자동완성: 여행자의 쉼터의 출구.
    const commands = getAvailableCommands(GS.IDLE, { ...structuredClone(INITIAL_STATE.player), loc: '여행자의 쉼터' });
    for (const exit of DB.MAPS['여행자의 쉼터'].exits) {
        assert.ok(commands.some((entry) => entry.cmd === exit && entry.desc === `→ ${exit}${expectEuroRo(exit)} 이동`), exit);
    }
    // 전직 단추: 도적 Lv30의 첫 후보는 어쌔신 — "어쌔신으로 전직".
    const rogue = { ...structuredClone(INITIAL_STATE.player), name: '조사', job: '도적', level: 30, loc: '시작의 마을' };
    const html = renderStatic(createElement(JobChangePanel, { player: rogue, actions: {} }));
    assert.ok(html.includes('어쌔신으로 전직'), '어쌔신으로 전직');
    assert.equal(html.includes('어쌔신로 전직'), false);
});

test('[부재] src는 이름 · 숫자 뒤에 조사를 고정으로 붙이거나 괄호로 둘 다 적지 않는다(판정기 파일 제외)', () => {
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(ts|tsx)$/.test(entry.name) && !full.endsWith(path.join('data', 'koreanParticles.ts'))) files.push(full);
        }
    };
    walk('src');
    // Wave 130: 이름을 감싼 대괄호 · 따옴표 뒤도 이름의 받침을 따른다("[길 잃은 순례]을" · "'에테르의 신'와"). 닫는 소괄호는
    //   덧붙인 설명이라 조사가 그 앞 낱말을 따른다("강화(공격력 +18% · 3턴)가") — 잡지 않는다.
    const fixed = /(\$\{[^}]+\}|\{[A-Za-z_][\w.?()' |]*\})[\]」』"'”’]*(으로|로|을|를|이|가|은|는|과|와)(?=[\s.,!?·)`'"]|$)/u;
    const combined = /이\(가\)|을\(를\)|은\(는\)|과\(와\)|와\(과\)|\(으\)로/u;
    const offenders = [];
    for (const file of files) {
        fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
            const code = line.replace(/\/\/.*$/u, '').trim();
            if (!code || code.startsWith('*') || code.startsWith('/*')) return;
            if (fixed.test(code) || combined.test(code)) offenders.push(`${file}:${index + 1}: ${code.slice(0, 120)}`);
        });
    }
    assert.deepEqual(offenders, [], `조사는 data/koreanParticles.ts의 josa · withJosa로 고른다:\n${offenders.join('\n')}`);
});
