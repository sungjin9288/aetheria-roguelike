import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseEvidenceScreenshot } from './e2e/releaseEvidenceScreenshot.ts';

const makeTarget = () => {
    const calls = [];
    return {
        calls,
        screenshot: async (options) => {
            calls.push(options);
        },
    };
};

const makeTestInfo = () => {
    const calls = [];
    return {
        calls,
        outputPath: (filename) => {
            calls.push(filename);
            return `/tmp/test-results/${filename}`;
        },
    };
};

test('default screenshot output is isolated through testInfo.outputPath', async () => {
    const previous = process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE;
    delete process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE;
    try {
        const target = makeTarget();
        const testInfo = makeTestInfo();

        const outputPath = await releaseEvidenceScreenshot(
            target,
            testInfo,
            'relic-gold-multiplier-390x844.png',
            { fullPage: true },
        );

        assert.equal(outputPath, '/tmp/test-results/relic-gold-multiplier-390x844.png');
        assert.deepEqual(testInfo.calls, ['relic-gold-multiplier-390x844.png']);
        assert.deepEqual(target.calls, [{
            fullPage: true,
            path: '/tmp/test-results/relic-gold-multiplier-390x844.png',
        }]);
    } finally {
        if (previous === undefined) delete process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE;
        else process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE = previous;
    }
});

test('exact refresh opt-in writes into the tracked release-evidence directory', async () => {
    const previous = process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE;
    process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE = '1';
    try {
        const target = makeTarget();
        const testInfo = makeTestInfo();

        const outputPath = await releaseEvidenceScreenshot(
            target,
            testInfo,
            'content-pacing-390x844.png',
            { fullPage: false },
        );

        assert.match(outputPath, /docs\/evidence\/qa\/release-complete-core\/screenshots\/content-pacing-390x844\.png$/);
        assert.deepEqual(testInfo.calls, []);
        assert.deepEqual(target.calls, [{ fullPage: false, path: outputPath }]);
    } finally {
        if (previous === undefined) delete process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE;
        else process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE = previous;
    }
});

test('truthy values other than exact one do not enable refresh output', async () => {
    const previous = process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE;
    process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE = 'true';
    try {
        const target = makeTarget();
        const testInfo = makeTestInfo();

        await releaseEvidenceScreenshot(target, testInfo, 'safe-name.png');

        assert.deepEqual(testInfo.calls, ['safe-name.png']);
        assert.equal(target.calls[0].path, '/tmp/test-results/safe-name.png');
    } finally {
        if (previous === undefined) delete process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE;
        else process.env.AETHERIA_REFRESH_RELEASE_EVIDENCE = previous;
    }
});

test('unsafe screenshot filenames fail before invoking the target', async () => {
    const unsafeNames = [
        '../escape.png',
        'nested/escape.png',
        'nested\\escape.png',
        '/absolute.png',
        'not-an-image.jpg',
        'has spaces.png',
    ];

    for (const filename of unsafeNames) {
        const target = makeTarget();
        const testInfo = makeTestInfo();
        await assert.rejects(
            releaseEvidenceScreenshot(target, testInfo, filename),
            /safe single PNG filename/,
        );
        assert.deepEqual(target.calls, [], filename);
        assert.deepEqual(testInfo.calls, [], filename);
    }
});
