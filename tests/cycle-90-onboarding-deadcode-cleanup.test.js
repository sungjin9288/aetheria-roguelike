import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 90: OnboardingGuide 데드코드 정리.
 *
 * 발견:
 * - src/components/OnboardingGuide.tsx 컴포넌트는 자기 자신 외엔 어디서도
 *   import되지 않는 dead component (commit c9a5564 "3칸 레이아웃 단순화"에서
 *   렌더 위치는 제거됐지만 파일 + 관련 state plumbing은 잔존).
 * - 관련 dead plumbing:
 *     state.onboardingDismissed (INITIAL_STATE / GameState interface)
 *     AT.SET_ONBOARDING_DISMISSED action constant
 *     uiHandlers SET_ONBOARDING_DISMISSED handler
 *     bootstrapHandlers의 LOAD_DATA payload merge 라인
 *     useGameEngine의 dismissOnboarding action + onboardingDismissed export
 *     useFirebaseSync의 read + save + deps
 *     gameUtils.migrateData의 boolean coercion 라인
 *
 * Firebase save에 잔존하는 onboardingDismissed 필드는 forward-compatible로
 * 무시됨 (필드 삭제는 안전; 추가/이름변경만 migrate 필요).
 *
 * 정리 후 모든 referent가 사라져야 함.
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

test('OnboardingGuide.tsx 파일 제거됨', async () => {
    const exists = await fileExists('src/components/OnboardingGuide.tsx');
    assert.equal(exists, false, 'OnboardingGuide.tsx should be deleted');
});

test('actionTypes.ts에 SET_ONBOARDING_DISMISSED 제거됨', async () => {
    const source = await readSrc('src/reducers/actionTypes.ts');
    assert.doesNotMatch(source, /SET_ONBOARDING_DISMISSED/);
});

test('GameState/INITIAL_STATE에 onboardingDismissed 제거됨', async () => {
    const source = await readSrc('src/reducers/gameReducer.ts');
    assert.doesNotMatch(source, /onboardingDismissed/);
});

test('uiHandlers에 SET_ONBOARDING_DISMISSED 핸들러 제거됨', async () => {
    const source = await readSrc('src/reducers/handlers/uiHandlers.ts');
    assert.doesNotMatch(source, /onboardingDismissed/i);
});

test('bootstrapHandlers의 onboardingDismissed merge 라인 제거됨', async () => {
    const source = await readSrc('src/reducers/handlers/bootstrapHandlers.ts');
    assert.doesNotMatch(source, /onboardingDismissed/);
});

test('useGameEngine에 onboardingDismissed export / dismissOnboarding 제거됨', async () => {
    const source = await readSrc('src/hooks/useGameEngine.ts');
    assert.doesNotMatch(source, /onboardingDismissed/);
    assert.doesNotMatch(source, /dismissOnboarding/);
});

test('useFirebaseSync에 onboardingDismissed 참조 제거됨', async () => {
    const source = await readSrc('src/hooks/useFirebaseSync.ts');
    assert.doesNotMatch(source, /onboardingDismissed/);
});

test('gameUtils.migrateData에 onboardingDismissed boolean coercion 제거됨', async () => {
    const source = await readSrc('src/utils/gameUtils.ts');
    assert.doesNotMatch(source, /onboardingDismissed/);
});
