import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 322: 55 files unused React default import 일괄 정리
 *   (cycle 222-321 silent dead config 시리즈 91번째 — cleanup lens 연속).
 *
 * 발견 (unused default imports):
 * - tsconfig "jsx": "react-jsx" → automatic runtime, JSX 사용에 React import 불필요.
 * - 55 .tsx 파일에서 `import React, { ... }` 또는 `import React from 'react'`
 *   형태로 React default를 import하지만 어디에서도 React.X 호출 0건.
 *
 * 패턴 (cycle 222-321 silent dead config 시리즈 91번째):
 * - cycle 321: 8 files 10 unused imports cleanup.
 * - cycle 322: 55 files unused React default — 단일 cycle 최대 file 갯수 정리.
 *
 * 수정 방식:
 * - `import React, { ... } from 'react';` → `import { ... } from 'react';`
 * - `import React from 'react';` (단일 default) → 해당 라인 삭제.
 *
 * 회귀 가드:
 * - JSX 컴파일 정상 (jsx-runtime 자동 import).
 * - tsc / lint / unit / build-guard 모두 통과.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 322: 주요 컴포넌트의 unused React default 제거', async () => {
    const samples = [
        'src/App.tsx',
        'src/components/Dashboard.tsx',
        'src/components/TerminalView.tsx',
        'src/components/ControlPanel.tsx',
    ];
    for (const f of samples) {
        const source = await readSrc(f);
        // React.X 호출이 0건이면 import에서 React default도 0건이어야 함.
        const reactUses = (source.match(/\bReact\./g) || []).length;
        if (reactUses === 0) {
            assert.ok(!/^import React\b/m.test(source),
                `${f}: React.X 사용 0건이면 React default import도 0건`);
        }
    }
});

test('cycle 322: jsx-runtime 자동 import (tsconfig "jsx": "react-jsx")', async () => {
    const tsconfig = await readSrc('tsconfig.json');
    assert.ok(/"jsx":\s*"react-jsx"/.test(tsconfig),
        'tsconfig jsx: react-jsx (automatic runtime) 보존');
});

test('cycle 322: React.X 사용하는 파일은 React import 보존', async () => {
    // React.useState나 React.FC 등을 직접 쓰는 파일은 import 유지되어야 함.
    // 본 batch에서는 그런 파일이 없을 가능성이 높지만, 회귀 가드.
    const dirs = ['src/components', 'src/hooks'];
    for (const dir of dirs) {
        const fs = await import('node:fs/promises');
        const entries = await fs.readdir(path.join(ROOT, dir), { recursive: true, withFileTypes: true });
        for (const e of entries) {
            if (!e.isFile()) continue;
            if (!/\.(tsx?|jsx?)$/.test(e.name)) continue;
            const full = path.join(e.parentPath || dir, e.name);
            const source = await fs.readFile(full, 'utf8');
            const reactUses = (source.match(/\bReact\./g) || []).length;
            if (reactUses > 0) {
                assert.ok(/^import React\b/m.test(source),
                    `${full}: React.X 사용 시 React import 보존`);
            }
        }
    }
});

test('cycle 321 회귀 가드: 8 files unused imports 정리 보존', async () => {
    const codexSrc = await readSrc('src/components/Codex.tsx');
    assert.ok(!/^import \{ BALANCE \} from/m.test(codexSrc),
        'cycle 321 Codex.tsx BALANCE 제거 보존');
    assert.ok(!/^import \{ MSG \} from/m.test(codexSrc),
        'cycle 321 Codex.tsx MSG 제거 보존');
});
