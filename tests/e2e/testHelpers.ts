import { expect, type Page } from '@playwright/test';

export const startE2ERun = async (
    page: Page,
    options: { openStatusConsole?: boolean; name?: string } = {},
) => {
    await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' });

    const statusBar = page.getByTestId('persistent-status-bar');
    const startButton = page.getByTestId('intro-start-button');

    // Locator.isVisible() is an immediate snapshot. Wait for either persisted
    // game state or the intro start action so cold boot timing does not flake.
    const readyState = await Promise.race([
        statusBar.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'game' as const).catch(() => null),
        startButton.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'intro' as const).catch(() => null),
    ]);

    if (readyState === 'intro') {
        if (options.name) await page.getByTestId('intro-name-input').fill(options.name);
        await expect(startButton).toBeEnabled({ timeout: 5_000 });
        await startButton.click();
        await expect(page.getByTestId('intro-name-input')).toBeHidden({ timeout: 15_000 });
    }

    await expect(statusBar).toBeVisible({ timeout: 20_000 });

    // 이전 플레이 기록을 불러온 재도전은 시작 유물 선택을 제공할 수 있다.
    // 일반 E2E가 후속 화면을 검증할 수 있도록 있을 때만 선택을 끝낸다.
    const bootRelic = page.getByTestId('relic-choice-0');
    if (await bootRelic.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
        await bootRelic.click();
        await expect(bootRelic).toBeHidden({ timeout: 10_000 });
    }

    if (options.openStatusConsole) {
        const statusChip = page.getByTestId('status-character-chip');
        if (await statusChip.waitFor({ state: 'visible', timeout: 3_000 }).then(() => true).catch(() => false)) {
            await statusChip.click();
        }
    }
};

export const openTownFacilities = async (page: Page) => {
    const facilities = page.getByTestId('control-town-facilities');
    await expect(facilities).toBeVisible({ timeout: 8_000 });
    if (await facilities.getAttribute('open') === null) {
        await facilities.locator('summary').click();
    }
    await expect(facilities).toHaveAttribute('open', '');
};

/**
 * 2026-10 (감사 GF-09): 모드가 바뀌면 조작판 칸이 짧게 들어온다(전투 260ms · 그 밖 180ms, `utils/modeTransition.ts`).
 *   위치를 재는 단언은 그 박자가 끝난 뒤에 잰다 — 박자 중에는 칸이 4 ~ 8px 위에서 내려오는 중이다.
 */
export const waitForModeTransition = async (page: Page) => {
    await expect.poll(() => page.evaluate(() => (
        [...document.querySelectorAll('.animate-combat-start, .aether-mode-enter-a, .aether-mode-enter-b')]
            .every((element) => element.getAnimations().every((animation) => animation.playState !== 'running'))
    )), { timeout: 5_000 }).toBe(true);
};

/* ───────────── 2026-11 지역 지도 걷기 — 지도 지역(고요한 숲)에는 탐험 단추가 없고, 걸어서 조우하면 탐험 1회다 ───────────── */

type FieldDirection = 'up' | 'down' | 'left' | 'right';

interface FieldSnapshot {
    gameState: string;
    explores: number;
    pos: number | null;
    pending: string | null;
    visited: number[];
    layout: { width: number; height: number; tiles: string; entrance: number; exits: Array<{ index: number; to: string }>; chests: Array<{ id: number; index: number }> } | null;
    opened: number[];
}

export const readFieldSnapshot = (page: Page): Promise<FieldSnapshot> => page.evaluate(() => {
    const state = JSON.parse(window.render_game_to_text?.() || '{}');
    const field = state.player?.fieldMap ?? null;
    return {
        gameState: state.gameState ?? state.mode ?? '',
        explores: state.player?.explores ?? 0,
        pos: field ? field.pos : null,
        pending: field?.pending?.kind ?? null,
        visited: field?.visited ?? [],
        layout: state.player?.fieldLayout ?? null,
        opened: field?.openedChests ?? [],
    };
});

const DELTA: Record<FieldDirection, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/**
 * 다음 걸음 — 아직 밟지 않은 풀숲(위험이 쌓이는 칸) 중 가장 가까운 곳으로. 출구(지역을 떠난다) · 상자(미믹 · 보상이 시험을
 * 흔든다)는 밟지 않는다. 풀숲이 없으면 아직 밟지 않은 아무 칸.
 */
const nextFieldStep = (snapshot: FieldSnapshot): FieldDirection | null => {
    const { layout, pos, visited } = snapshot;
    if (!layout || pos === null) return null;
    const blocked = new Set([...layout.exits.map((exit) => exit.index), ...layout.chests.map((chest) => chest.index)]);
    const seen = new Set(visited);
    const pick = (accept: (index: number) => boolean): FieldDirection | null => {
        const first = new Map<number, FieldDirection>();
        const queue = [pos];
        const reached = new Set([pos]);
        for (let head = 0; head < queue.length; head += 1) {
            const current = queue[head];
            if (current !== pos && accept(current)) return first.get(current) ?? null;
            const x = current % layout.width;
            const y = Math.floor(current / layout.width);
            for (const direction of Object.keys(DELTA) as FieldDirection[]) {
                const [dx, dy] = DELTA[direction];
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= layout.width || ny >= layout.height) continue;
                const next = ny * layout.width + nx;
                if (reached.has(next) || blocked.has(next) || layout.tiles[next] === '#') continue;
                reached.add(next);
                first.set(next, current === pos ? direction : first.get(current)!);
                queue.push(next);
            }
        }
        return null;
    };
    return pick((index) => !seen.has(index) && (layout.tiles[index] === ',' || layout.tiles[index] === ';'))
        ?? pick((index) => !seen.has(index));
};

/** 탐험할 수 있는 표면이 보인다 — 탐험 단추 또는 지도의 방향 패드 */
export const expectExploreReady = async (page: Page, timeout = 8_000) => {
    await expect(page.getByTestId('control-explore').or(page.getByTestId('field-pad-up'))).toBeVisible({ timeout });
};

/**
 * 탐험 1회 — 탐험 단추가 있으면 누르고, 지도 지역이면 방향 패드로 걸어 조우(= `explore()` 1회)가 일어날 때까지 걷는다.
 * 조우 결과(전투 · 이벤트 · 아무 일 없음)는 탐험 단추를 누른 것과 같다(걷기는 난수를 쓰지 않는다).
 */
export const exploreOnce = async (page: Page, options: { maxSteps?: number } = {}) => {
    await expectExploreReady(page);
    const button = page.getByTestId('control-explore');
    if (await button.isVisible()) {
        await button.click();
        return;
    }
    const start = await readFieldSnapshot(page);
    const maxSteps = options.maxSteps ?? 120;
    for (let step = 0; step < maxSteps; step += 1) {
        const snapshot = await readFieldSnapshot(page);
        if (snapshot.explores > start.explores || snapshot.gameState !== start.gameState) return;
        if (snapshot.pending) {
            await page.waitForTimeout(50);
            continue;
        }
        const direction = nextFieldStep(snapshot);
        if (!direction) throw new Error('지도에서 더 걸을 칸이 없다');
        const pad = page.getByTestId(`field-pad-${direction}`);
        await expect(pad).toBeEnabled({ timeout: 8_000 });
        await pad.click();
        await expect.poll(async () => {
            const after = await readFieldSnapshot(page);
            return after.pos !== snapshot.pos || after.pending !== null || after.explores > start.explores || after.gameState !== start.gameState;
        }, { timeout: 5_000 }).toBe(true);
    }
    // 마지막 조우의 탐험이 끝나기를 기다린다.
    await expect.poll(async () => (await readFieldSnapshot(page)).explores, { timeout: 5_000 }).toBeGreaterThan(start.explores);
};

/**
 * 지도 걷기 중 끼어든 화면을 정리한다 — 전투는 공격, 결과 카드는 주 행동(지도 지역은 '닫기'), 유물 선택은 넘기기,
 * 이벤트는 마지막 선택지(지나친다). 방향 패드를 다시 누를 수 있으면 끝난다.
 */
/** 지금 있고 누를 수 있다 — 없는 요소를 기다리지 않는다(전투 중에는 방향 패드가 없다). */
const isPadReady = async (page: Page) => {
    const pad = page.getByTestId('field-pad-up');
    return (await pad.count()) > 0 && pad.isEnabled({ timeout: 200 }).catch(() => false);
};

export const settleFieldInterruption = async (page: Page, timeout = 20_000) => {
    const deadline = Date.now() + timeout;
    // 클릭은 짧게 기다린다 — 기본값(시험 끝까지)이면 누를 수 없는 단추 하나가 시한을 삼킨다.
    const tap = (testId: string) => page.getByTestId(testId).click({ timeout: 1_000 }).catch(() => undefined);
    const visible = (testId: string) => page.getByTestId(testId).isVisible().catch(() => false);
    while (Date.now() < deadline) {
        if (await isPadReady(page)) return;
        if (await visible('combat-action-attack')) {
            await tap('combat-action-attack');
        } else if (await visible('post-combat-close')) {
            // 결과 카드는 닫는다 — 주 행동이 '가방 정리'면 기록 창이 열린다.
            await tap('post-combat-close');
        } else if (await visible('post-combat-primary-action')) {
            await tap('post-combat-primary-action');
        } else if (await visible('relic-choice-skip')) {
            await tap('relic-choice-skip');
        } else if (await visible('event-panel')) {
            await page.locator('[data-testid^="event-choice-"]').last().click({ timeout: 1_000 }).catch(() => undefined);
        } else if (await visible('mobile-console-return-log')) {
            // 기록 창(가방 등)이 지도를 덮고 있으면 닫는다.
            await tap('mobile-console-return-log');
        }
        await page.waitForTimeout(150);
    }
    throw new Error('지도 걷기로 돌아오지 못했다');
};

/**
 * 지도의 한 칸까지 걷는다 — 이미 밟은 칸 · 길을 먼저 고르고(위험이 쌓이지 않는다) 다른 상자 · 출구는 밟지 않는다.
 * 조우가 끼어들면 `settleFieldInterruption`으로 정리하고 이어 걷는다. 목표 칸(상자 · 출구)을 밟으면 끝난다.
 */
export const walkFieldTo = async (page: Page, target: number, options: { maxSteps?: number } = {}) => {
    const maxSteps = options.maxSteps ?? 200;
    for (let step = 0; step < maxSteps; step += 1) {
        const snapshot = await readFieldSnapshot(page);
        const { layout, pos } = snapshot;
        if (!layout || pos === null) return;
        if (pos === target) return;
        if (snapshot.gameState !== 'idle' || snapshot.pending || !(await isPadReady(page))) {
            await settleFieldInterruption(page);
            continue;
        }
        const blocked = new Set([...layout.exits.map((exit) => exit.index), ...layout.chests.map((chest) => chest.index)]);
        blocked.delete(target);
        const seen = new Set(snapshot.visited);
        const cost = (index: number) => (seen.has(index) || layout.tiles[index] === '.' ? 1 : 8);
        const dist = new Map<number, number>([[pos, 0]]);
        const first = new Map<number, FieldDirection>();
        const open = [pos];
        while (open.length > 0) {
            open.sort((a, b) => dist.get(a)! - dist.get(b)!);
            const current = open.shift()!;
            if (current === target) break;
            const x = current % layout.width;
            const y = Math.floor(current / layout.width);
            for (const direction of Object.keys(DELTA) as FieldDirection[]) {
                const [dx, dy] = DELTA[direction];
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= layout.width || ny >= layout.height) continue;
                const next = ny * layout.width + nx;
                if (blocked.has(next) || layout.tiles[next] === '#') continue;
                const nd = dist.get(current)! + cost(next);
                if (nd >= (dist.get(next) ?? Infinity)) continue;
                dist.set(next, nd);
                first.set(next, current === pos ? direction : first.get(current)!);
                open.push(next);
            }
        }
        const direction = first.get(target);
        if (!direction) throw new Error(`지도 칸 ${target}에 닿는 길이 없다`);
        await page.getByTestId(`field-pad-${direction}`).click();
        await expect.poll(async () => {
            const after = await readFieldSnapshot(page);
            return after.pos !== pos || after.pending !== null || after.gameState !== 'idle';
        }, { timeout: 5_000 }).toBe(true);
    }
    throw new Error(`지도 칸 ${target}까지 ${maxSteps}걸음 안에 닿지 못했다`);
};
