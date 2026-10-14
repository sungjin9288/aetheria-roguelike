// 2026-10-14 출시 전 통합 수용 — 추적 증빙은 CI가 검증한다.
// Wave 103이 증빙이 해시로 고정한 소스(src/utils/signatureSetBonus.ts)를 바꾸고 증빙을 다시 쓰지 않았는데,
// unit 스위트는 증빙 바이트를 비교하지 않고 CI는 증빙 검증을 돌리지 않아 그대로 머지됐다.
// 이 계약은 (1) 묶음 목록이 package.json의 모든 `--verify docs/evidence/` 스크립트를 덮고
// (2) CI가 그 묶음을 실제로 부른다는 것을 지킨다. 바이트 비교 자체는 CI job이 한다(여기서 돌리면 수 분).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { listTrackedEvidenceScripts } from '../scripts/verify-tracked-evidence.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

test('묶음은 package.json의 증빙 검증 스크립트를 모두 덮는다 (+ 아트 검증)', () => {
    const scripts = listTrackedEvidenceScripts(pkg);
    const expected = Object.entries(pkg.scripts)
        .filter(([, command]) => command.includes('--verify docs/evidence/'))
        .map(([name]) => name);
    assert.ok(expected.length >= 13, `증빙 검증 스크립트가 줄었다: ${expected.length}`);
    for (const name of expected) assert.ok(scripts.includes(name), `${name}이 묶음에서 빠졌다`);
    for (const name of ['art:verify', 'art:monsters:verify']) assert.ok(scripts.includes(name), `${name}이 묶음에서 빠졌다`);
    assert.equal(new Set(scripts).size, scripts.length, '중복 없이 한 번씩');
    for (const name of scripts) assert.ok(pkg.scripts[name], `${name}은 package.json에 있어야 한다`);
    assert.equal(pkg.scripts['evidence:verify'], 'node scripts/verify-tracked-evidence.mjs');
});

test('묶음 목록은 새 증빙 검증 스크립트를 손으로 적지 않아도 들인다', () => {
    const extended = { scripts: { ...pkg.scripts, 'future:verify': 'node scripts/x.mjs --verify docs/evidence/qa/x.json' } };
    assert.ok(listTrackedEvidenceScripts(extended).includes('future:verify'));
});

test('CI의 tracked-evidence job이 묶음을 부르고 Pillow를 먼저 설치한다', () => {
    const jobStart = workflow.indexOf('\n  tracked-evidence:\n');
    assert.ok(jobStart >= 0, 'ci.yml에 tracked-evidence job이 있어야 한다');
    const nextJob = workflow.slice(jobStart + 1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
    const job = nextJob >= 0 ? workflow.slice(jobStart, jobStart + 1 + nextJob) : workflow.slice(jobStart);
    const install = job.indexOf('pip install --disable-pip-version-check -r requirements-art.txt');
    const run = job.indexOf('run: npm run evidence:verify');
    assert.ok(run >= 0, 'tracked-evidence job이 npm run evidence:verify를 돌려야 한다');
    assert.ok(install >= 0 && install < run, '아트 검증 전에 Pillow를 설치해야 한다');
    assert.doesNotMatch(job, /continue-on-error/, '증빙 불일치는 CI를 붉게 해야 한다');
});
