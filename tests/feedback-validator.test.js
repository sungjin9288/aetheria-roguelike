import test from 'node:test';
import assert from 'node:assert/strict';

import { FeedbackValidator } from '../src/systems/FeedbackValidator.js';

/**
 * FeedbackValidator는 localStorage.getItem/setItem과 Date.now()에 직접 의존한다
 * (systems/FeedbackValidator.ts는 pure function이 아니라 브라우저 전역에 결합됨).
 * ai-service.test.js의 withGlobalStub 패턴을 그대로 따라 globalThis.localStorage와
 * Date.now를 스텁하고, 실행 후 원래 상태로 복원한다.
 */
const makeLocalStorageStub = () => {
    const store = new Map();
    return {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear(),
    };
};

/** globalThis에 stub을 주입하고, 콜백 실행 후 원래 상태로 반드시 복원한다. */
const withGlobalStub = async (overrides, fn) => {
    const originals = {};
    const hadOwn = {};
    for (const key of Object.keys(overrides)) {
        hadOwn[key] = Object.prototype.hasOwnProperty.call(globalThis, key);
        originals[key] = globalThis[key];
        globalThis[key] = overrides[key];
    }
    try {
        return await fn();
    } finally {
        for (const key of Object.keys(overrides)) {
            if (hadOwn[key]) {
                globalThis[key] = originals[key];
            } else {
                delete globalThis[key];
            }
        }
    }
};

/** Date.now()만 고정 시각으로 대체하는 fake clock. 콜백 실행 후 원본 Date.now를 복원한다. */
const withFakeClock = async (startMs, fn) => {
    const originalNow = Date.now;
    const clock = { now: startMs };
    Date.now = () => clock.now;
    try {
        return await fn(clock);
    } finally {
        Date.now = originalNow;
    }
};

const FAKE_START_MS = 1_700_000_000_000;

test('validate: 빈 문자열/null/undefined는 최소 길이 미달 오류를 반환한다', async () => {
    await withGlobalStub({ localStorage: makeLocalStorageStub() }, () => {
        for (const content of ['', null, undefined]) {
            const result = FeedbackValidator.validate(content);
            assert.equal(result.valid, false);
            assert.equal(result.error, '최소 10자 이상 입력해주세요.');
        }
    });
});

test('validate: MIN_LENGTH보다 1자 짧으면 거부되고, 정확히 MIN_LENGTH면 통과한다', async () => {
    await withGlobalStub({ localStorage: makeLocalStorageStub() }, () => {
        const tooShort = FeedbackValidator.validate('a'.repeat(FeedbackValidator.MIN_LENGTH - 1));
        assert.equal(tooShort.valid, false);
        assert.equal(tooShort.error, '최소 10자 이상 입력해주세요.');

        const exact = FeedbackValidator.validate('a'.repeat(FeedbackValidator.MIN_LENGTH));
        assert.equal(exact.valid, true);
        assert.equal(exact.error, undefined);
    });
});

test('validate: 정확히 MAX_LENGTH면 통과하고, 1자만 넘어도 거부된다', async () => {
    await withGlobalStub({ localStorage: makeLocalStorageStub() }, () => {
        const exact = FeedbackValidator.validate('a'.repeat(FeedbackValidator.MAX_LENGTH));
        assert.equal(exact.valid, true);

        const tooLong = FeedbackValidator.validate('a'.repeat(FeedbackValidator.MAX_LENGTH + 1));
        assert.equal(tooLong.valid, false);
        assert.equal(tooLong.error, '1000자를 초과할 수 없습니다.');
    });
});

test('validate: 마지막 제출 기록이 없으면 rate limit 없이 통과한다', async () => {
    await withGlobalStub({ localStorage: makeLocalStorageStub() }, () => {
        const result = FeedbackValidator.validate('충분히 긴 피드백 내용입니다');
        assert.equal(result.valid, true);
    });
});

test('markSubmitted 직후 같은 시각에 validate하면 RATE_LIMIT_MS 전체 대기 시간을 보고하며 거부된다', async () => {
    const localStorage = makeLocalStorageStub();
    await withGlobalStub({ localStorage }, async () => {
        await withFakeClock(FAKE_START_MS, () => {
            FeedbackValidator.markSubmitted();
            assert.equal(localStorage.getItem(FeedbackValidator.RATE_LIMIT_KEY), String(FAKE_START_MS));

            const result = FeedbackValidator.validate('충분히 긴 피드백 내용입니다');
            assert.equal(result.valid, false);
            assert.equal(result.error, `잠시 후 다시 시도해주세요. (${FeedbackValidator.RATE_LIMIT_MS / 1000}초)`);
        });
    });
});

test('rate limit 창 안에서는 남은 시간이 줄어들며 계속 거부된다', async () => {
    const localStorage = makeLocalStorageStub();
    await withGlobalStub({ localStorage }, async () => {
        await withFakeClock(FAKE_START_MS, (clock) => {
            FeedbackValidator.markSubmitted();

            // RATE_LIMIT_MS - 1ms 경과 → 아직 창 안 (< 이므로 경계값도 거부됨).
            clock.now = FAKE_START_MS + FeedbackValidator.RATE_LIMIT_MS - 1;
            const almostExpired = FeedbackValidator.validate('충분히 긴 피드백 내용입니다');
            assert.equal(almostExpired.valid, false);
            assert.equal(almostExpired.error, '잠시 후 다시 시도해주세요. (1초)');

            // 30초 경과 → 남은 대기 시간이 절반으로 줄어든다.
            clock.now = FAKE_START_MS + 30_000;
            const halfway = FeedbackValidator.validate('충분히 긴 피드백 내용입니다');
            assert.equal(halfway.valid, false);
            assert.equal(halfway.error, '잠시 후 다시 시도해주세요. (30초)');
        });
    });
});

test('rate limit 창이 정확히 끝나는 시점부터 다시 통과한다', async () => {
    const localStorage = makeLocalStorageStub();
    await withGlobalStub({ localStorage }, async () => {
        await withFakeClock(FAKE_START_MS, (clock) => {
            FeedbackValidator.markSubmitted();

            // 경계값: diff === RATE_LIMIT_MS는 `<` 비교라 거부되지 않는다.
            clock.now = FAKE_START_MS + FeedbackValidator.RATE_LIMIT_MS;
            const atBoundary = FeedbackValidator.validate('충분히 긴 피드백 내용입니다');
            assert.equal(atBoundary.valid, true);

            // 창이 끝난 뒤에도 계속 통과한다.
            clock.now = FAKE_START_MS + FeedbackValidator.RATE_LIMIT_MS + 5_000;
            const afterWindow = FeedbackValidator.validate('충분히 긴 피드백 내용입니다');
            assert.equal(afterWindow.valid, true);
        });
    });
});

test('rate limit보다 길이 검증이 먼저 적용된다 — 짧은 입력은 rate limit 중에도 길이 오류로 거부된다', async () => {
    const localStorage = makeLocalStorageStub();
    await withGlobalStub({ localStorage }, async () => {
        await withFakeClock(FAKE_START_MS, () => {
            FeedbackValidator.markSubmitted();

            const result = FeedbackValidator.validate('짧음');
            assert.equal(result.valid, false);
            assert.equal(result.error, '최소 10자 이상 입력해주세요.');
        });
    });
});

test('markSubmitted은 매번 현재 시각으로 rate limit 타임스탬프를 갱신한다', async () => {
    const localStorage = makeLocalStorageStub();
    await withGlobalStub({ localStorage }, async () => {
        await withFakeClock(FAKE_START_MS, (clock) => {
            FeedbackValidator.markSubmitted();
            assert.equal(localStorage.getItem(FeedbackValidator.RATE_LIMIT_KEY), String(FAKE_START_MS));

            clock.now = FAKE_START_MS + FeedbackValidator.RATE_LIMIT_MS + 5_000;
            FeedbackValidator.markSubmitted();
            assert.equal(
                localStorage.getItem(FeedbackValidator.RATE_LIMIT_KEY),
                String(FAKE_START_MS + FeedbackValidator.RATE_LIMIT_MS + 5_000),
            );

            // 갱신된 타임스탬프 기준으로 다시 rate limit이 걸린다.
            const result = FeedbackValidator.validate('충분히 긴 피드백 내용입니다');
            assert.equal(result.valid, false);
        });
    });
});
