import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
    formatSkillPower,
    formatSkillText,
    getSkillEffectLabel,
    getSkillMetrics,
} from '../src/utils/skillPresentation.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relativePath) => readFile(path.join(ROOT, relativePath), 'utf8');

test('기술 수치와 효과는 전투 화면과 같은 플레이어 언어로 표시된다', () => {
    assert.equal(formatSkillText('ATK/DEF 30% 상승, MP 20 회복'), '공격력과 방어력 30% 상승, 기력 20 회복');
    assert.equal(formatSkillText('데미지 증가, 기절 1→3턴'), '피해 증가, 기절 1턴에서 3턴');
    assert.equal(formatSkillPower(1.5), '위력 150%');
    assert.equal(formatSkillPower(), null);
    assert.equal(getSkillEffectLabel('stun'), '기절');
    assert.deepEqual(getSkillMetrics({ name: '강타', mp: 10, mult: 1.5, effect: 'stun' }), [
        '기력 10',
        '위력 150%',
        '기절',
    ]);
});

test('성장 후보 선택과 실제 적용은 별도 action으로 분리된다', async () => {
    const source = await readSrc('src/components/SkillTreePreview.tsx');

    assert.match(source, /onClick=\{\(\) => setSelectedChoice\(choice\)\}/);
    assert.match(source, /data-testid=\{`skill-growth-confirm-\$\{skillName\}`\}/);
    assert.match(source, /onClick=\{\(\) => selectedBranch\?\.choice && canConfirm && onConfirm\?\./);
    assert.doesNotMatch(source, /onClick=\{\(\) => actions\?\.chooseSkillBranch\?\.\(skillName, branch\.choice\)\}/);
    assert.match(source, /min-h-\[48px\]/);
});

test('전직 계보는 전체 직업 표 대신 현재 직업에서 이어지는 경로만 보여 준다', async () => {
    const source = await readSrc('src/components/ClassTree.tsx');

    assert.match(source, /const nextJobs = currentClass\?\.next \|\| \[\]/);
    assert.match(source, /nextJobs\.map\(/);
    assert.match(source, /대표 기술/);
    assert.match(source, /다음 계보/);
    assert.doesNotMatch(source, /Object\.entries\(DB\.CLASSES\)|overflow-x-auto|grid-cols-4/);
});
