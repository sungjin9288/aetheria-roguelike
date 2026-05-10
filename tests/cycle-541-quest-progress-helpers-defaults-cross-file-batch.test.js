import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 541: getQuestProgressText + getQuestProgressPercent 4 defaults
 *   cross-file batch unreachable (cycle 222-540 silent dead config 시리즈
 *   283번째 — redundant default annotation 청소 메가 시리즈 36번째).
 *   cross-file 동일 helper 패턴 정리.
 *
 * 발견 (4 defaults batch, 2 files 같은 helper 패턴):
 * - src/components/tabs/QuestTab.tsx (line 20, 26):
 *     · getQuestProgressText (quest, progress: any = 0)
 *     · getQuestProgressPercent (progress: any = 0, goal: any = 1)
 * - src/components/tabs/QuestBoardPanel.tsx (line 17, 23):
 *     · getQuestProgressText (quest, progress: any = 0)  ← 동일 helper 중복
 *     · getQuestProgressPercent (progress: any = 0, goal: any = 1)
 *       ← 동일 helper 중복
 * - 호출 사이트 (모두 명시 전달):
 *     · QuestTab.tsx:76 — getQuestProgressPercent(entry.progress,
 *       entry.quest.goal) — 2 args 명시.
 *     · QuestTab.tsx:285 — getQuestProgressText(entry.quest, entry.progress)
 *       — 2 args 명시.
 *     · QuestBoardPanel.tsx:201 — getQuestProgressText(entry.quest,
 *       entry.progress) — 2 args 명시.
 *     · QuestBoardPanel.tsx:205 — getQuestProgressPercent(entry.progress,
 *       entry.quest.goal) — 2 args 명시.
 *     · 다른 caller 0건 (private 모듈 helper).
 * - 결과: 4 default 모두 도달 불가.
 *
 * 패턴 (cycle 222-540 시리즈 283번째):
 * - cycle 502-540: default 청소 메가 시리즈 39사이클.
 * - cycle 541: cross-file duplicated helper batch — QuestTab과 QuestBoardPanel
 *   에 동일 helper 정의가 중복(cycle 313이 export 제거하면서 분리). 동일
 *   pattern이라 single-cycle 4-default batch.
 *
 * 수정 (양쪽 파일):
 * - getQuestProgressText signature: progress: any = 0 → progress: any.
 * - getQuestProgressPercent signature: progress / goal defaults 모두 제거.
 * - body의 Math.min/Math.max guard 보존.
 *
 * 회귀 가드:
 * - 4 internal callsite 동작 그대로.
 * - body 'Level' ternary + Math.max(0, progress) defensive 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 541: QuestTab.tsx 2 defaults 0건', async () => {
    const source = await readSrc('src/components/tabs/QuestTab.tsx');
    const txtSig = source.slice(source.indexOf('const getQuestProgressText'),
                                  source.indexOf('=>', source.indexOf('const getQuestProgressText')));
    assert.ok(!/progress:\s*any\s*=\s*0/.test(txtSig),
        'QuestTab getQuestProgressText progress default 0 제거');

    const pctSig = source.slice(source.indexOf('const getQuestProgressPercent'),
                                  source.indexOf('=>', source.indexOf('const getQuestProgressPercent')));
    assert.ok(!/progress:\s*any\s*=\s*0/.test(pctSig),
        'QuestTab getQuestProgressPercent progress default 0 제거');
    assert.ok(!/goal:\s*any\s*=\s*1/.test(pctSig),
        'QuestTab getQuestProgressPercent goal default 1 제거');
});

test('cycle 541: QuestBoardPanel.tsx 2 defaults 0건', async () => {
    const source = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    const txtSig = source.slice(source.indexOf('const getQuestProgressText'),
                                  source.indexOf('=>', source.indexOf('const getQuestProgressText')));
    assert.ok(!/progress:\s*any\s*=\s*0/.test(txtSig),
        'QuestBoardPanel getQuestProgressText progress default 0 제거');

    const pctSig = source.slice(source.indexOf('const getQuestProgressPercent'),
                                  source.indexOf('=>', source.indexOf('const getQuestProgressPercent')));
    assert.ok(!/progress:\s*any\s*=\s*0/.test(pctSig),
        'QuestBoardPanel getQuestProgressPercent progress default 0 제거');
    assert.ok(!/goal:\s*any\s*=\s*1/.test(pctSig),
        'QuestBoardPanel getQuestProgressPercent goal default 1 제거');
});

test('cycle 541: 정합성 가드 — 4 callsite 보존', async () => {
    const qt = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(/getQuestProgressPercent\(entry\.progress,\s*entry\.quest\.goal\)/.test(qt),
        'QuestTab getQuestProgressPercent callsite 보존');
    assert.ok(/getQuestProgressText\(entry\.quest,\s*entry\.progress\)/.test(qt),
        'QuestTab getQuestProgressText callsite 보존');

    const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    assert.ok(/getQuestProgressText\(entry\.quest,\s*entry\.progress\)/.test(qb),
        'QuestBoardPanel getQuestProgressText callsite 보존');
    assert.ok(/getQuestProgressPercent\(entry\.progress,\s*entry\.quest\.goal\)/.test(qb),
        'QuestBoardPanel getQuestProgressPercent callsite 보존');
});

test('cycle 541: body defensive guards 보존', async () => {
    const qt = await readSrc('src/components/tabs/QuestTab.tsx');
    assert.ok(/Math\.min\(100,\s*\(Math\.max\(0,\s*progress\)\s*\/\s*Math\.max\(1,\s*goal\)\)/.test(qt),
        'QuestTab Math.min/Math.max defensive 보존');

    const qb = await readSrc('src/components/tabs/QuestBoardPanel.tsx');
    assert.ok(/Math\.min\(100,\s*\(Math\.max\(0,\s*progress\)\s*\/\s*Math\.max\(1,\s*goal\)\)/.test(qb),
        'QuestBoardPanel Math.min/Math.max defensive 보존');
});

test('cycle 541: cycle 502-539 회귀 가드 — default 청소 시리즈 보존', async () => {
    const ai = await readSrc('src/services/aiService.ts');
    assert.ok(!/const callProxy[^=]*trackLabel:\s*any\s*=\s*'ai-call'/.test(ai),
        'cycle 539 callProxy trackLabel default 0건');

    const helpers = await readSrc('src/reducers/handlers/helpers.ts');
    assert.ok(!/applyDailyProtocolProgress[^=]*amount:\s*any\s*=\s*1/.test(helpers),
        'cycle 538 applyDailyProtocolProgress amount default 0건');
});
