import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
    getActiveClassSkillNames,
    getClassIdentity,
    getClassStatGrade,
} from '../src/utils/classPresentation.js';
import { CLASSES } from '../src/data/classes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('전직 비교 문구는 내부 배율 대신 플레이 성향을 보여 준다', () => {
    assert.equal(getClassStatGrade(0.7), '낮음');
    assert.equal(getClassStatGrade(1), '보통');
    assert.equal(getClassStatGrade(1.4), '높음');
    assert.equal(getClassStatGrade(1.8), '매우 높음');
    assert.deepEqual(getClassIdentity(CLASSES['전사'].desc), {
        focus: '체력 · 공격 중심',
        identity: '전선을 지키는 용사',
    });
    assert.deepEqual(getActiveClassSkillNames(CLASSES['전사'], 2), ['파워배시', '광폭화']);
});

test('후보 선택과 전직 확정은 다른 행동으로 분리된다', async () => {
    const [card, panel] = await Promise.all([
        readSrc('src/components/ClassCard.tsx'),
        readSrc('src/components/tabs/JobChangePanel.tsx'),
    ]);

    assert.match(card, /onClick=\{\(\) => onSelect\(jobName\)\}/);
    assert.doesNotMatch(card, /actions\?\.jobChange|actions\.jobChange/);
    assert.doesNotMatch(card, /disabled=\{disabled\}/);
    assert.match(panel, /data-testid="job-change-decision"/);
    assert.match(panel, /data-testid="job-change-confirm"/);
    assert.match(panel, /onClick=\{\(\) => !selectedIsLocked && actions\?\.jobChange\(selectedName\)\}/);
    assert.match(panel, /disabled=\{selectedIsLocked\}/);
});

test('모바일 전직 화면은 후보를 2열로 비교하고 장기 계보를 미리 보여 준다', async () => {
    const panel = await readSrc('src/components/tabs/JobChangePanel.tsx');

    assert.match(panel, /data-testid="job-change-options" className="grid grid-cols-2 gap-2"/);
    assert.match(panel, /다음 계보/);
    assert.ok(panel.includes("selected.next.join(' 또는 ')"));
    assert.match(panel, /전직하면 생명과 기력이 모두 회복되고/);
    assert.match(panel, /min-h-\[48px\]/);
});
