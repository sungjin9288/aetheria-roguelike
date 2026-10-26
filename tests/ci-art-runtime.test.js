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

// 2026-10-26: ubuntu-latest(26.04)에는 setup-python의 3.12.12가 없고 Playwright 1.59.1이 chromium을 설치하지 못한다 —
//   CI 작업은 모두 고정한 러너에서 돈다.
test('CI 작업은 모두 Python 3.12.12 · Playwright chromium이 있는 러너(ubuntu-24.04)에서 돈다', () => {
    const workflow = readFileSync(workflowPath, 'utf8');
    const runners = [...workflow.matchAll(/\n    runs-on: (\S+)\n/gu)].map((match) => match[1]);
    assert.ok(runners.length >= 5, `작업의 러너를 모두 찾았다 (${runners.length})`);
    assert.deepEqual([...new Set(runners)], ['ubuntu-24.04']);
    assert.ok(workflow.includes('uses: actions/setup-python@v7') && workflow.includes('npx playwright install'), 'Python · Playwright를 쓰는 작업이 있다');
});
