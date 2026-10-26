// 2026-10 Wave 131(원장 §143) — 한 개념, 한 이름.
//
// 통합 수용 5차(§142)가 능력치 화면에서 "주전 임무 · … 보스 수비전 퀘스트와 잘 맞습니다"를 찾았다. 같은 개념을 화면 · 기록이 두 이름으로
// 부르고 있었다: 탭 · 게시판은 '임무'인데 수락 · 완료 기록은 "퀘스트"(자연 플레이 40판 12,760줄), '계승 정수'를 "에센스 +5",
// '정예'를 "엘리트 몬스터 [정예] 개체", "도주" 기록에 '도망' 단추, "묘비" 기록에 '무덤' 탭, 적의 '방어 자세'를 보스 브리핑은 "가드"로,
// '반격'을 "카운터"로, 계승을 "프레스티지 · 환생 · 승천"으로 불렀다. 은어(폭딜 · 파밍 · 루틴 · 세팅 · 루프 · 런)와 띄어쓰기 두 벌
// (상태 이상 · 상태이상)도 같은 종류다.
//
// 화면 이름은 탭 · 게시판 · 단추가 쓰는 쪽이다(아래 VARIANTS의 canon). 고유 이름(아이템 · 기술 · 유물 · 조합 · 칭호 · 업적 이름 · 지역 ·
// 몬스터 · 직업 · 회차 규칙)은 그대로다 — "하급 체력 물약"은 생명을 회복하는 물약의 이름이고 "다섯 번째 환생"은 업적의 이름이다.
//
// 다섯 겹이다: ① MSG 전수 ② 그대로 그리는 시스템 데이터 전수(서사 — 이벤트 · 이야기 · 지역 전승 — 는 낱말 그대로 쓰는 동사가 있어
// 뺀다) ③ 화면 · 판정 코드의 문자열(AST, 명령어 입력 별칭은 뺀다) ④ 실제 자연 플레이 기록 전수 ⑤ 본편 장 판정은 제목 머리표가
// 아니라 장 id다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import ts from 'typescript';

import { MSG } from '../src/data/messages.ts';
import { DB } from '../src/data/db.ts';
import { CLASSES } from '../src/data/classes.ts';
import { RELICS, RELIC_SYNERGIES } from '../src/data/relics.ts';
import { BOSS_BRIEFS } from '../src/data/monsters.ts';
import { ACHIEVEMENTS, QUESTS } from '../src/data/quests.ts';
import { ARCHETYPE_LABELS, TRAIT_DEFINITIONS } from '../src/data/traits.ts';
import { PREMIUM_SHOP } from '../src/data/premiumShop.ts';
import { FIRST_VISIT_REWARDS } from '../src/data/firstVisitRewards.ts';
import { MIRROR_ENDLESS_NODES, MIRROR_NODES } from '../src/data/mirror.ts';
import { TITLES } from '../src/data/titles.ts';
import { ALL_ASCENSION_RULES } from '../src/data/ascensionRules.ts';
import { MAIN_STORY_QUEST_IDS, STORY_CHAPTERS, isMainStoryQuest } from '../src/data/storyChapters.ts';
import { PRESTIGE_MILESTONES } from '../src/utils/ascensionPreview.ts';
import { formatRelicText } from '../src/utils/relicPresentation.ts';
import { calculateFullStats } from '../src/utils/statsCalculator.ts';
import StatsPanel from '../src/components/StatsPanel.tsx';
import RunSummaryCard from '../src/components/RunSummaryCard.tsx';
import { buildRunSummary } from '../src/utils/gameUtils.ts';
import { getJourneySurfaceText } from '../src/utils/journeyScope.ts';
import { JOB_PATHS, runNaturalPlay } from '../scripts/naturalPlay/driver.mjs';
import { renderStatic, makePlayerFixture } from './helpers/render.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

// 화면에 남으면 안 되는 두 번째 이름 → 화면 이름.
const VARIANTS = [
    { re: /퀘스트/u, canon: '임무' },
    { re: /에센스/u, canon: '계승 정수' },
    { re: /인벤/u, canon: '가방' },
    { re: /엘리트/u, canon: '정예' },
    { re: /프레스티지|승천|환생|랭크/u, canon: '계승' },
    { re: /쿨타임|쿨다운/u, canon: '재사용 대기' },
    { re: /크리티컬|(?<![가-힣])크리(?![가-힣])/u, canon: '치명타' },
    { re: /스킬/u, canon: '기술' },
    { re: /버프/u, canon: '강화 · 약화 · 상태이상' },
    { re: /시너지/u, canon: '조합' },
    { re: /클래스/u, canon: '직업' },
    { re: /경험치/u, canon: '경험' },
    { re: /티어/u, canon: '등급' },
    { re: /상태 이상/u, canon: '상태이상' },
    { re: /안전 지대/u, canon: '안전지대' },
    { re: /월드맵/u, canon: '지도' },
    { re: /무덤/u, canon: '묘비' },
    { re: /캠프파이어/u, canon: '모닥불' },
    { re: /드랍/u, canon: '드롭' },
    { re: /폭딜|파밍|세팅|루틴|루프/u, canon: '단기 화력 · 노릴 가치 · 구성 · 수단 · 흐름' },
    { re: /가드|카운터|방어 태세/u, canon: '방어 자세 · 반격' },
    { re: /(?<![가-힣])런(?![던])/u, canon: '여정' },
    { re: /mid-game/u, canon: '중반' },
    { re: /\[스토리\]/u, canon: '[이야기]' },
    { re: /마나/u, canon: '기력' },
    { re: /체력/u, canon: '생명' },
    // 2026-10 통합 감사(town-nav UX-09): 화면을 바꾸는 패널의 이전으로는 '뒤로'(MSG.UI_BACK), 덮는 화면은 '닫기'(MSG.UI_CLOSE)다 —
    //   머리글 다섯 곳의 '복귀'와 경로 보드 · 거울 · 교환소 바닥의 '돌아가기'가 같은 동작을 다른 이름으로 불렀다.
    //   '복귀를 환영합니다'(돌아온 플레이어 · 귀환 브리핑)는 다른 개념이라 낱말 단독일 때만 막는다.
    { re: /(?<![가-힣])복귀(?![가-힣])|돌아가기/u, canon: '뒤로 · 닫기' },
    // 소유자 결정 2026-10-26 D17: 덮는 화면을 닫는 것은 '닫기', 앞 화면으로 가는 것은 '뒤로'다 — 그 밖의 이름(나가기 · 뒤로 가기 · 이전 화면)도 막는다.
    { re: /(?<![가-힣])나가기(?![가-힣])|뒤로 ?가기|이전 화면/u, canon: '뒤로 · 닫기' },
    // 통합 수용 6차(원장 §144): 한 판은 '여정'이다 — 사망 화면이 "이번 모험 기록" · "새 모험 시작"과 "다음 여정에 남는 것"을 함께 말했다.
    //   '모험 기록'(기록 콘솔) · '모험 도감' · 직업 '모험가'는 다른 개념의 이름이다.
    { re: /모험(?!가| 기록| 도감)/u, canon: '여정' },
    // Wave 134(원장 §147): 진 엔딩 화면 제목은 '진 엔딩'이고 종장 기록 한 줄만 '진엔딩'이었다.
    { re: /진엔딩/u, canon: '진 엔딩' },
    // 2026-10 감사 UX-14: 사망 화면 한 장이 다음 판을 '다음 시도' · '다음 시도 추천'과 '다음 여정에 남는 것'으로 함께 불렀다.
    { re: /다음 시도/u, canon: '다음 여정' },
    // 2026-10 감사 UX-14: 가방 화면 · 빈 칸 이름은 '퀵슬롯'이고 저장소 문서만 '빠른 칸'이라 불렀다 — 화면 이름(단추 · 칸 라벨)이 이긴다.
    { re: /빠른 ?칸/u, canon: '퀵슬롯' },
];
// 서사(이벤트 선택지 · 결과 문장)는 "다른 길을 탐색한다" · "도망간다"처럼 낱말 그대로 쓴다 — 시스템 문장에서만 막는다.
const SYSTEM_ONLY_VARIANTS = [
    { re: /도망/u, canon: '도주' },
    { re: /탐색/u, canon: '탐험' },
];

// 고유 이름은 지운 뒤에 본다(긴 이름부터 — "하급 체력 물약" 안의 "체력"은 이름의 일부다).
const collectItemNames = (value, sink) => {
    if (Array.isArray(value)) value.forEach((entry) => collectItemNames(entry, sink));
    else if (value && typeof value === 'object') {
        if (typeof value.name === 'string') sink.push(value.name);
        Object.values(value).forEach((entry) => collectItemNames(entry, sink));
    }
};
const PROPER_NAMES = (() => {
    const names = [];
    collectItemNames(DB.ITEMS, names);
    for (const [className, def] of Object.entries(CLASSES)) {
        names.push(className);
        for (const skill of def.skills || []) names.push(skill.name);
        for (const [skillName, branches] of Object.entries(def.skillBranches || {})) {
            names.push(skillName);
            for (const branch of branches) names.push(branch.label);
        }
    }
    names.push(
        ...RELICS.map((relic) => relic.name),
        ...RELIC_SYNERGIES.map((synergy) => synergy.label),
        ...TITLES.map((title) => title.name),
        ...ACHIEVEMENTS.map((achievement) => achievement.title),
        ...Object.keys(DB.MAPS),
        ...Object.keys(DB.MONSTERS || {}),
        ...Object.values(TRAIT_DEFINITIONS).map((trait) => trait.skill?.name),
        ...[...MIRROR_NODES, ...MIRROR_ENDLESS_NODES].map((node) => node.name),
        ...ALL_ASCENSION_RULES.map((rule) => rule.name),
        // 직업 장비 맞춤 단계의 이름(utils/jobOutfitAffinity.ts — 내보내지 않는 표).
        '마나의 결', '마나의 조율자',
        // "체력 물약"(아이템 이름)을 가리키는 말 — 그 물약이 필요하다는 이벤트 · 안내.
        '체력 회복 물약',
        // 게임 전체의 모험을 말하는 문구와 이름(임무 · 시즌 구간 · 첫 사망 이야기 제목) — 한 판(여정)이 아니다.
        '달빛 아래 펼쳐지는 모험', '모험을 준비하고 있습니다', '평소의 모험', '깊어지는 모험', '신중한 모험', '돌아오는 것도 모험이다',
    );
    return [...new Set(names.filter((name) => typeof name === 'string' && name.trim()))].sort((a, b) => b.length - a.length);
})();
const stripNames = (text) => PROPER_NAMES.reduce((rest, name) => (rest.includes(name) ? rest.split(name).join(' ') : rest), String(text));

const findVariant = (text, variants = [...VARIANTS, ...SYSTEM_ONLY_VARIANTS]) => {
    const stripped = stripNames(text);
    const hit = variants.find(({ re }) => re.test(stripped));
    return hit ? `${stripped.match(hit.re)[0]} → ${hit.canon}` : null;
};

// ── ① MSG 전수.
const SAMPLE_ARGS = [
    ['가나다', 3, '라마바', 4, '사아자'],
    [3, 4, 5, 6, 7],
    ['가나다', '라마바', '사아자', '차카타', '파하'],
    [3, '가나다', 4, '라마바'],
    [true, 3],
];
const collectMsgOutputs = () => {
    const outputs = [];
    const take = (where, value, depth) => {
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
        } else if (value && typeof value === 'object' && depth < 3) {
            for (const [key, entry] of Object.entries(value)) take(`${where}.${key}`, entry, depth + 1);
        }
    };
    for (const [key, value] of Object.entries(MSG)) take(`MSG.${key}`, value, 0);
    return outputs;
};

test('[MSG 전수] 한 개념의 두 번째 이름(퀘스트 · 에센스 · 엘리트 · 프레스티지 · 쿨타임 · 가드 …)이 없다', () => {
    const outputs = collectMsgOutputs();
    assert.ok(outputs.length > 1000, String(outputs.length));
    const offenders = [...new Set(outputs.flatMap(({ where, text }) => {
        const hit = findVariant(text);
        return hit ? [`${where}: ${hit} | ${text.slice(0, 80)}`] : [];
    }))];
    assert.deepEqual(offenders, []);
    // 고친 자리가 화면 이름을 말한다(빈 문장으로 통과하지 않게).
    assert.equal(MSG.QUEST_ACCEPTED('슬라임 소탕'), '임무 수락: 슬라임 소탕');
    assert.equal(MSG.QUEST_DONE('슬라임 소탕'), '임무 완료: 슬라임 소탕');
    assert.equal(MSG.ESSENCE_REWARD(5), '계승 정수 +5');
    assert.equal(MSG.ELITE_PREFIX_APPEAR('재앙의'), '⚠️ [재앙의] 정예 개체가 나타났습니다!');
    assert.equal(MSG.COMBAT_ACTION_ESCAPE, '도주');
    assert.equal(MSG.ENEMY_TELEGRAPH_GUARD_HIGH(40), '방어 자세 (40%)');
    assert.equal(MSG.RUN_SUMMARY_RESTART, '새 여정 시작');
    assert.equal(MSG.JOURNEY_KEPT_LINE('도감'), '다음 여정에 남는 것: 도감');
    assert.equal(MSG.RUN_REFLECTION_LABELS.next, '다음 여정');
    assert.equal(MSG.RUN_SUMMARY_NEXT_JOURNEY_LABEL, '다음 여정 추천');
    assert.match(MSG.QUICK_SLOT_EMPTY_LABEL(1), /^퀵슬롯 1 /u);
});

// ── ② 그대로 그리는 시스템 데이터 전수.
const walkStrings = (where, value, sink, skipKeys = /^(id|key|type|target|effect|stat|icon|tone|lootTheme|mechanics|name|title|label|color|cond)$/u) => {
    if (typeof value === 'string') sink.push({ where, text: value });
    else if (Array.isArray(value)) value.forEach((entry, index) => walkStrings(`${where}[${index}]`, entry, sink, skipKeys));
    else if (value && typeof value === 'object') {
        for (const [key, entry] of Object.entries(value)) {
            if (skipKeys.test(key)) continue;
            walkStrings(`${where}.${key}`, entry, sink, skipKeys);
        }
    }
};
const collectSystemData = () => {
    const sink = [];
    walkStrings('BOSS_BRIEFS', BOSS_BRIEFS, sink, /^(recommendedBuilds)$/u);
    QUESTS.forEach((quest) => walkStrings(`QUESTS.${quest.id}`, { title: quest.title, desc: quest.desc, hook: quest.hook }, sink, /^$/u));
    ACHIEVEMENTS.forEach((achievement) => walkStrings(`ACHIEVEMENTS.${achievement.id}`, { desc: achievement.desc }, sink));
    walkStrings('TRAIT_DEFINITIONS', TRAIT_DEFINITIONS, sink);
    walkStrings('ARCHETYPE_LABELS', ARCHETYPE_LABELS, sink, /^$/u);
    walkStrings('PREMIUM_SHOP', PREMIUM_SHOP, sink, /^(id|key|type|icon)$/u);
    walkStrings('FIRST_VISIT_REWARDS', FIRST_VISIT_REWARDS, sink);
    [...MIRROR_NODES, ...MIRROR_ENDLESS_NODES].forEach((node) => walkStrings(`MIRROR.${node.id}`, { name: node.name, desc: node.desc }, sink, /^$/u));
    for (const [className, def] of Object.entries(CLASSES)) {
        walkStrings(`CLASSES.${className}.desc`, def.desc, sink);
        (def.skills || []).forEach((skill) => walkStrings(`CLASSES.${className}.${skill.name}`, skill.desc, sink));
        for (const [skillName, branches] of Object.entries(def.skillBranches || {})) {
            branches.forEach((branch) => walkStrings(`CLASSES.${className}.${skillName}.${branch.choice}`, branch.desc, sink));
        }
    }
    RELICS.forEach((relic) => walkStrings(`RELICS.${relic.id}`, [relic.desc, formatRelicText(relic.desc)], sink));
    RELIC_SYNERGIES.forEach((synergy) => walkStrings(`RELIC_SYNERGIES.${synergy.label}`, [synergy.desc, formatRelicText(synergy.desc)], sink));
    for (const [mapName, map] of Object.entries(DB.MAPS)) walkStrings(`MAPS.${mapName}.desc`, map.desc, sink);
    PRESTIGE_MILESTONES.forEach((milestone) => walkStrings(`PRESTIGE_MILESTONES.${milestone.rank}`, milestone.description, sink));
    return sink;
};

test('[데이터 전수] 그대로 그리는 시스템 문장(보스 브리핑 · 임무 · 업적 · 성향 · 직업 기술 · 유물 · 지역 · 상점 · 거울)에 두 번째 이름이 없다', () => {
    const strings = collectSystemData();
    assert.ok(strings.length > 900, String(strings.length));
    const offenders = strings.flatMap(({ where, text }) => {
        const hit = findVariant(text);
        return hit ? [`${where}: ${hit} | ${text.slice(0, 80)}`] : [];
    });
    assert.deepEqual(offenders, []);
    // 고친 자리가 실제로 화면 이름을 말한다.
    assert.match(TRAIT_DEFINITIONS.fortress.questFocus, /임무와 잘 맞습니다/u);
    assert.deepEqual(BOSS_BRIEFS['아이스 드래곤'].warningChips, ['빙결 누적', '반격']);
    assert.match(BOSS_BRIEFS['고대 호수의 수호신'].rewardHint, /중반 보스입니다/u);
    assert.equal(MIRROR_NODES.find((node) => node.id === 'essence_flow').name, '정수 공명');
    assert.match(DB.MAPS['영혼의 강'].desc, /묘비에 더 많은 아이템과 골드가 남습니다/u);
});

// ── ③ 화면 · 판정 코드의 문자열(AST) — 주석은 AST에 없다.
// 명령어 입력 별칭과 선택지 분류 낱말은 플레이어가 치거나 이벤트 문장에서 찾는 말이라 그대로 둔다.
const CODE_EXEMPT = {
    'src/utils/commandParser.ts': new Set(['퀘스트', '인벤', '스킬', '스킬변경', '탐색']),
    'src/utils/aiEventUtils.ts': new Set(['도망']),
    // 타이틀 화면의 시작 단추는 게임 전체를 연다(캐릭터 · 세이브를 만든다). AI 요청 문맥의 기본 낱말은 화면에 그리지 않는다.
    'src/components/IntroScreen.tsx': new Set(['모험 시작']),
    'src/services/aiService.ts': new Set(['모험']),
};
// QA 시드 API는 프로덕션 번들에서 빠진다.
const CODE_EXCLUDED_FILES = new Set(['src/hooks/useGameTestApi.ts']);
const collectCodeStrings = () => {
    const files = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(ts|tsx)$/u.test(entry.name)) files.push(full);
        }
    };
    for (const top of ['components', 'utils', 'hooks', 'systems', 'reducers', 'services', 'platform']) walk(path.join(ROOT, 'src', top));
    const strings = [];
    for (const file of files) {
        const rel = path.relative(ROOT, file).split(path.sep).join('/');
        if (CODE_EXCLUDED_FILES.has(rel)) continue;
        const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        const visit = (node) => {
            let text = null;
            if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) text = node.text;
            else if (ts.isJsxText(node)) text = node.getText();
            else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) text = node.text;
            if (text && /[가-힣]/u.test(text) && !CODE_EXEMPT[rel]?.has(text.trim())) {
                strings.push({ where: `${rel}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`, text: text.replace(/\s+/gu, ' ').trim() });
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    return strings;
};

test('[코드 전수] 화면 · 판정 코드의 문자열에 두 번째 이름이 없다 — 명령어 입력 별칭만 예외다', () => {
    const strings = collectCodeStrings();
    assert.ok(strings.length > 2000, String(strings.length));
    const offenders = strings.flatMap(({ where, text }) => {
        const hit = findVariant(text);
        return hit ? [`${where}: ${hit} | ${text.slice(0, 80)}`] : [];
    });
    assert.deepEqual(offenders, []);
    // 본편 장의 머리표는 표시일 뿐이다 — 데이터(quests.ts) 밖에서 머리표 글자로 판정하지 않는다.
    const tagOutsideData = strings.filter(({ text }) => /\[(이야기|스토리)\]/u.test(text));
    assert.deepEqual(tagOutsideData, []);
});

// ── ④ 실제 경로 — 자연 플레이 기록 전수.
test('[실제 경로] 자연 플레이 기록에 두 번째 이름이 없고, 고친 문장이 실제로 나온다', async () => {
    const lines = new Set();
    const seenLogs = new WeakSet();
    const onDispatch = (prev, _action, next) => {
        if (next.logs === prev.logs) return;
        for (const log of next.logs || []) {
            if (!log || typeof log !== 'object' || seenLogs.has(log)) continue;
            seenLogs.add(log);
            if (typeof log.text === 'string') lines.add(log.text);
        }
    };
    for (const pathName of ['knight', 'archmage']) {
        await runNaturalPlay({ seed: 2, jobPath: JOB_PATHS[pathName], runs: 1, maxSteps: 3000, onDispatch });
    }
    assert.ok(lines.size > 1000, String(lines.size));
    const offenders = [...lines].flatMap((text) => {
        const hit = findVariant(text, VARIANTS);
        return hit ? [`${hit} | ${text.slice(0, 80)}`] : [];
    });
    assert.deepEqual(offenders.slice(0, 12), []);
    const seen = (pattern) => [...lines].some((text) => pattern.test(text));
    assert.ok(seen(/^임무 수락: /u), '임무 수락 기록');
    assert.ok(seen(/^임무 완료: /u), '임무 완료 기록');
    assert.ok(seen(/정예 개체가 나타났습니다!$/u), '정예 출현 기록');
});

// ── ⑤ 본편 장은 id로 판정한다.
test('[본편 장] 판정은 장 id이고, 머리표 [이야기]는 정확히 그 16개 임무에만 붙는다', () => {
    const chapterIds = STORY_CHAPTERS.map((chapter) => chapter.questId);
    assert.equal(MAIN_STORY_QUEST_IDS.size, 16);
    assert.deepEqual([...MAIN_STORY_QUEST_IDS].sort((a, b) => a - b), [...chapterIds].sort((a, b) => a - b));
    const tagged = QUESTS.filter((quest) => String(quest.title).includes('[이야기]')).map((quest) => quest.id);
    assert.deepEqual(tagged.sort((a, b) => a - b), [...chapterIds].sort((a, b) => a - b));
    for (const quest of QUESTS.filter((entry) => tagged.includes(entry.id))) assert.match(quest.title, /^\[이야기\] \S/u);
    // 제목이 아니라 id를 본다.
    assert.equal(isMainStoryQuest({ id: 81, title: '머리표 없는 제목' }), true);
    assert.equal(isMainStoryQuest({ id: '81' }), true);
    assert.equal(isMainStoryQuest({ id: 1, title: '[이야기] 가짜' }), false);
    assert.equal(isMainStoryQuest({ id: 'bounty_1', title: '현상수배' }), false);
    assert.equal(isMainStoryQuest(null), false);
});

// ── ⑥ 렌더: 능력치 화면의 장비 세트 설명은 플레이어 언어로 그린다(데이터 "ATK 10% 증가" — 장비 행은 증빙이 고정한다).
test('[렌더] 능력치 화면의 장비 세트 줄은 약어 없이 "공격력 · 방어력 · 최대 생명"을 말한다', () => {
    for (const set of DB.ITEMS.sets) {
        const player = makePlayerFixture({});
        const stats = { ...calculateFullStats(player), activeSet: set };
        const html = renderStatic(createElement(StatsPanel, { player, stats }));
        const line = html.match(/data-active-set-prefix="[^"]*"[\s\S]*?<\/div>\s*<\/div>/u)?.[0] || html;
        assert.ok(html.includes(`${set.prefix} 세트`), set.prefix);
        assert.doesNotMatch(line, /(?<![A-Za-z])(ATK|DEF|HP)(?![A-Za-z])/u, set.prefix);
    }
    const fire = DB.ITEMS.sets.find((set) => set.prefix === '불타는');
    const player = makePlayerFixture({});
    const html = renderStatic(createElement(StatsPanel, { player, stats: { ...calculateFullStats(player), activeSet: fire } }));
    assert.match(html, /화염의 결속 \(2세트\): 공격력 10% 증가/u);
});

// ── ⑦ 렌더: 사망 화면은 끝난 한 판을 '여정' 하나로 부른다(통합 수용 6차, 원장 §144).
test('[렌더] 사망 화면은 한 판을 "여정"으로 부른다 — 머리말 · 종료 줄 · 남는 것 · 다시 시작 단추가 같은 이름이다', () => {
    const player = makePlayerFixture({ level: 52, loc: '북부 요새', meta: { prestigeRank: 3 } });
    const html = renderStatic(createElement(RunSummaryCard, { runSummary: buildRunSummary(player, player.loc), onRestart: () => {} }));
    const visible = html.replace(/<[^>]+>/gu, ' ').replace(/&#x27;|&quot;|&amp;/gu, ' ');
    const aria = [...html.matchAll(/aria-label="([^"]*)"/gu)].map((match) => match[1]);
    for (const text of [visible, ...aria]) assert.equal(findVariant(text), null, text.slice(0, 120));
    assert.ok(visible.includes('이번 여정 기록'));
    assert.ok(visible.includes('북부 요새에서 여정 종료'));
    assert.ok(visible.includes('새 여정 시작'));
    assert.ok(html.includes(MSG.JOURNEY_KEPT_LINE(getJourneySurfaceText('death', 'kept'))));
    assert.ok(aria.includes('이번 여정 성과'));
    assert.ok(!/모험/u.test(visible.replace(/모험가|모험 기록|모험 도감/gu, '')), '사망 화면에 한 판의 두 번째 이름이 없다');
});
