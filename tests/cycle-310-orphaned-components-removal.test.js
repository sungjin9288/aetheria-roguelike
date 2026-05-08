import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 310: 2 orphaned components 제거 (Bestiary + FocusPanel) + 빈 dashboard/ 디렉토리 정리
 *   (cycle 222-309 silent dead config 시리즈 80번째 — cleanup lens 연속).
 *
 * 발견 (orphaned components):
 * - src/components/Bestiary.tsx (307 lines): import / <Bestiary> JSX 0건.
 *   몬스터 도감 컴포넌트지만 어디에도 mount 안 됨. (참고: 도감 기능은
 *   src/components/codex/MonsterCodex.tsx 등이 active.)
 * - src/components/dashboard/FocusPanel.tsx (204 lines): import / <FocusPanel> JSX 0건.
 *   Adventure guide / difficulty 패널이지만 mount 안 됨. (참고: src/components/FocusPanelHeader.tsx
 *   는 다른 컴포넌트 — 5 active import.)
 * - src/components/dashboard/ 디렉토리: FocusPanel.tsx 제거 후 빈 디렉토리.
 *
 * 패턴 (cycle 222-309 silent dead config 시리즈 80번째, 가장 큰 단일 file 제거):
 * - cycle 309: RemoteConfigLoader 41 lines dead module 제거.
 * - cycle 310: 2 orphaned components 511 lines 제거 — 단일 cycle 최대 lines 감소.
 *
 * 수정:
 * - src/components/Bestiary.tsx: 파일 삭제 (307 lines).
 * - src/components/dashboard/FocusPanel.tsx: 파일 삭제 (204 lines).
 * - src/components/dashboard/: 빈 디렉토리 제거.
 *
 * 회귀 가드:
 * - src/components/FocusPanelHeader.tsx (5 active imports) 영향 없음 — 별개 컴포넌트.
 * - src/components/codex/ 도감 컴포넌트들 영향 없음.
 * - adventureGuide / difficulty 시스템은 다른 컴포넌트 (AdventureGuide* 등) 통해 active.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const fileExists = async (relPath) => {
    try {
        await access(path.join(ROOT, relPath));
        return true;
    } catch {
        return false;
    }
};

const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 310: Bestiary.tsx 파일 제거', async () => {
    assert.equal(await fileExists('src/components/Bestiary.tsx'), false,
        'Bestiary.tsx 제거됨');
});

test('cycle 310: dashboard/FocusPanel.tsx 파일 제거', async () => {
    assert.equal(await fileExists('src/components/dashboard/FocusPanel.tsx'), false,
        'FocusPanel.tsx 제거됨');
});

test('cycle 310: dashboard/ 빈 디렉토리 제거', async () => {
    assert.equal(await fileExists('src/components/dashboard'), false,
        'dashboard/ 디렉토리 제거됨');
});

test('cycle 310: FocusPanelHeader 별개 컴포넌트 활성 보존 (회귀 가드)', async () => {
    assert.equal(await fileExists('src/components/FocusPanelHeader.tsx'), true,
        'FocusPanelHeader.tsx 보존');
    const source = await readSrc('src/components/FocusPanelHeader.tsx');
    assert.ok(/export default FocusPanelHeader/.test(source),
        'FocusPanelHeader export 유지');
});

test('cycle 310: codex/ 도감 컴포넌트 활성 보존 (회귀 가드)', async () => {
    assert.equal(await fileExists('src/components/codex/MonsterCodex.tsx'), true,
        'MonsterCodex 보존 (Bestiary와 별개 active 도감)');
});

test('cycle 309 회귀 가드: RemoteConfigLoader 제거 유지', async () => {
    assert.equal(await fileExists('src/systems/RemoteConfigLoader.ts'), false,
        'cycle 309 RemoteConfigLoader 제거 유지');
});
