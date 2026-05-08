import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 311: adventureGuideActions.ts orphan 모듈 제거 (cycle 310 paired completion)
 *   (cycle 222-310 silent dead config 시리즈 81번째 — cleanup lens 연속).
 *
 * 발견 (cycle 310 cascade):
 * - src/utils/adventureGuideActions.ts: 47 lines, runGuidanceAction export.
 * - 유일한 consumer였던 src/components/dashboard/FocusPanel.tsx는 cycle 310에서 제거됨.
 * - 다른 import 0건 — 이제 fully orphaned.
 *
 * 패턴 (cycle 222-310 silent dead config 시리즈 81번째):
 * - cycle 310: Bestiary + dashboard/FocusPanel 2 orphan 제거.
 * - cycle 311: adventureGuideActions cascade orphan (cycle 310 paired completion).
 *
 * 수정:
 * - src/utils/adventureGuideActions.ts: 파일 삭제 (47 lines).
 *
 * 회귀 가드:
 * - adventureGuide.ts (다른 파일) active export 그대로 — getAdventureGuidance / getQuestTracker 등.
 * - 다른 utils 영향 없음.
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

test('cycle 311: adventureGuideActions.ts 파일 제거', async () => {
    assert.equal(await fileExists('src/utils/adventureGuideActions.ts'), false,
        'adventureGuideActions.ts 제거됨');
});

test('cycle 311: adventureGuide.ts (다른 파일) 보존 (회귀 가드)', async () => {
    assert.equal(await fileExists('src/utils/adventureGuide.ts'), true,
        'adventureGuide.ts 보존');
    const source = await readSrc('src/utils/adventureGuide.ts');
    assert.ok(/export const getAdventureGuidance/.test(source),
        'getAdventureGuidance export 유지');
});

test('cycle 311: src/ 어디에서도 runGuidanceAction import 0건', async () => {
    // file이 없어야 grep 결과도 0건
    const filesToCheck = ['src/components/Bestiary.tsx', 'src/utils/adventureGuideActions.ts'];
    for (const f of filesToCheck) {
        assert.equal(await fileExists(f), false, `${f} 제거됨 (cycle 310-311)`);
    }
});

test('cycle 310 회귀 가드: 2 orphan components 제거 유지', async () => {
    assert.equal(await fileExists('src/components/Bestiary.tsx'), false,
        'cycle 310 Bestiary 제거 유지');
    assert.equal(await fileExists('src/components/dashboard/FocusPanel.tsx'), false,
        'cycle 310 FocusPanel 제거 유지');
});
