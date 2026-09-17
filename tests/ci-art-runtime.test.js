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
