import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const requirementsPath = new URL('../requirements-art.txt', import.meta.url);
const workflowPath = new URL('../.github/workflows/ci.yml', import.meta.url);

test('CI prepares the pinned Python art runtime before unit tests', () => {
    assert.ok(existsSync(requirementsPath), 'requirements-art.txt must pin the CI art runtime');
    assert.equal(readFileSync(requirementsPath, 'utf8'), 'Pillow==12.1.1\n');

    const workflow = readFileSync(workflowPath, 'utf8');
    const setupPython = workflow.indexOf('uses: actions/setup-python@v7');
    const installArtRuntime = workflow.indexOf('python -m pip install --disable-pip-version-check -r requirements-art.txt');
    const unitTests = workflow.indexOf('run: npm run test:unit');

    assert.match(workflow, /PYTHON_VERSION: '3\.12\.12'/);
    assert.match(workflow, /python-version: \$\{\{ env\.PYTHON_VERSION \}\}/);
    assert.match(workflow, /cache-dependency-path: requirements-art\.txt/);
    assert.ok(setupPython >= 0, 'CI must set up Python before running art tests');
    assert.ok(installArtRuntime > setupPython, 'CI must install Pillow after setting up Python');
    assert.ok(unitTests > installArtRuntime, 'CI must install Pillow before unit tests');
});

// 2026-10-26: ubuntu-latest(26.04)에는 setup-python의 3.12.12가 없다 — Python을 고정하는 작업은 러너도 고정한다.
test('Python 아트 런타임을 쓰는 CI 작업은 3.12.12가 있는 러너(ubuntu-24.04)에서 돈다', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    const jobs = workflow.split(/\n  (?=[a-z][\w-]*:\n)/u).slice(1);
    const pythonJobs = jobs.filter((job) => job.includes('uses: actions/setup-python@v7'));
    assert.ok(pythonJobs.length >= 2, `Python을 쓰는 작업을 찾았다 (${pythonJobs.length})`);
    for (const job of pythonJobs) {
        assert.match(job, /\n    runs-on: ubuntu-24\.04\n/u, job.split('\n')[0]);
    }
});
