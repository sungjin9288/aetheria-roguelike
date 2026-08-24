import type { Page, TestInfo } from '@playwright/test';

const RELEASE_EVIDENCE_SCREENSHOT_ROOT = 'docs/evidence/qa/release-complete-core/screenshots';
const SAFE_PNG_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*\.png$/u;

type RuntimeProcess = { env?: Record<string, string | undefined> };

type ScreenshotOptions = Parameters<Page['screenshot']>[0];
type ScreenshotTarget = Pick<Page, 'screenshot'>;
type ScreenshotTestInfo = Pick<TestInfo, 'outputPath'>;

export const isSafeReleaseEvidenceFilename = (filename: unknown): filename is string => (
    typeof filename === 'string'
    && !filename.includes('..')
    && SAFE_PNG_FILENAME.test(filename)
);

export const releaseEvidenceScreenshot = async (
    target: ScreenshotTarget,
    testInfo: ScreenshotTestInfo,
    filename: string,
    options: ScreenshotOptions = {},
) => {
    if (!isSafeReleaseEvidenceFilename(filename)) {
        throw new Error('Screenshot filename must be a safe single PNG filename');
    }

    const runtimeProcess = (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;
    const outputPath = runtimeProcess?.env?.AETHERIA_REFRESH_RELEASE_EVIDENCE === '1'
        ? `${RELEASE_EVIDENCE_SCREENSHOT_ROOT}/${filename}`
        : testInfo.outputPath(filename);

    await target.screenshot({ ...options, path: outputPath });
    return outputPath;
};
