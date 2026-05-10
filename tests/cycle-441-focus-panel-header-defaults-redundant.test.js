import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 441: FocusPanelHeader default `backLabel = '뒤로'` redundant 정리
 *   (cycle 222-440 silent dead config 시리즈 199번째 — redundant default annotation
 *   lens 회귀, cycle 364-368/428-434/437 패턴, 5 컴포넌트 batch 분석).
 *
 * 발견 (1 redundant default value — 5 호출자 100% 명시 검증):
 * - src/components/FocusPanelHeader.tsx default `backLabel = '뒤로'`.
 * - 호출 사이트 (5곳, 모두 backLabel="복귀" 명시):
 *     EventPanel.tsx / QuestBoardPanel.tsx / ShopPanel.tsx /
 *     CraftingPanel.tsx / JobChangePanel.tsx
 *   → default '뒤로'는 도달 불가.
 * - 다른 default 보존 결정:
 *     · `archiveLabel = '인벤토리'` — 4 호출자 명시 ("INV"), EventPanel은
 *       onOpenArchive 미사용이라 archiveLabel default 도달 불가하지만 props
 *       semantic 보호용 보존.
 *     · `titleClassName = ''` — 4/5 호출자 명시, JobChangePanel은 미전달.
 *       default 활성 path.
 *
 * 패턴 (cycle 222-440 시리즈 199번째):
 * - cycle 364-368/428-434/437: redundant default annotation 시리즈.
 * - cycle 441: FocusPanelHeader backLabel — 5 호출자 batch 검증.
 *
 * 수정:
 * - destructure에서 `backLabel = '뒤로'` → `backLabel`.
 *
 * 회귀 가드:
 * - 5 호출자 모두 명시 backLabel 전달 → 동작 그대로.
 * - 다른 default (eyebrow / meta / archiveLabel / titleClassName / onBack /
 *   backTestId / rightSlot / onOpenArchive / archiveTestId / className /
 *   bleedClassName) 보존.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 441: FocusPanelHeader destructure에서 default backLabel 제거', async () => {
    const source = await readSrc('src/components/FocusPanelHeader.tsx');
    const destructIdx = source.indexOf('const FocusPanelHeader');
    const destructEnd = source.indexOf('}: any) => (', destructIdx);
    const block = source.slice(destructIdx, destructEnd);
    assert.ok(!/backLabel = '뒤로'/.test(block), "default backLabel 제거됨");
    assert.ok(/\bbackLabel\b/.test(block), 'backLabel 파라미터 보존');
});

test('cycle 441: 보존 default — eyebrow/meta/archiveLabel/titleClassName/className 그대로', async () => {
    const source = await readSrc('src/components/FocusPanelHeader.tsx');
    const destructIdx = source.indexOf('const FocusPanelHeader');
    const destructEnd = source.indexOf('}: any) => (', destructIdx);
    const block = source.slice(destructIdx, destructEnd);
    assert.ok(/eyebrow = ''/.test(block), 'eyebrow default 보존');
    assert.ok(/meta = ''/.test(block), 'meta default 보존');
    assert.ok(/archiveLabel = '인벤토리'/.test(block), 'archiveLabel default 보존');
    assert.ok(/titleClassName = ''/.test(block), 'titleClassName default 보존');
    assert.ok(/className = ''/.test(block), 'className default 보존');
    assert.ok(/bleedClassName = '-mx-3 px-3'/.test(block), 'bleedClassName default 보존');
});

test('cycle 441: 정합성 가드 — 5 호출자 모두 backLabel 명시 전달', async () => {
    const componentDir = path.join(ROOT, 'src/components');
    const files = await readdir(componentDir, { recursive: true });
    let totalCalls = 0;
    let backLabelCalls = 0;
    for (const f of files) {
        if (!String(f).endsWith('.tsx')) continue;
        const fp = path.join(componentDir, String(f));
        const src = await readFile(fp, 'utf8').catch(() => '');
        const segments = src.split(/<FocusPanelHeader\b/).slice(1);
        for (const seg of segments) {
            const closeIdx = seg.indexOf('/>');
            if (closeIdx < 0) continue;
            const propsBlock = seg.slice(0, closeIdx);
            totalCalls += 1;
            if (/backLabel=/.test(propsBlock)) backLabelCalls += 1;
        }
    }
    assert.ok(totalCalls >= 5, `FocusPanelHeader 호출 5+ 건 (실제 ${totalCalls})`);
    assert.equal(totalCalls, backLabelCalls,
        `모든 호출자 backLabel 명시 (${backLabelCalls}/${totalCalls})`);
});

test('cycle 439 회귀 가드: handleEventChoice timestamp 0건', async () => {
    const source = await readSrc('src/hooks/gameActions/eventActions.ts');
    const newHistoryIdx = source.indexOf('newHistory');
    const sliceEnd = source.indexOf('.slice(-50)', newHistoryIdx);
    const block = source.slice(newHistoryIdx, sliceEnd);
    assert.ok(!/timestamp:/.test(block), 'cycle 439 timestamp 0건 보존');
});
