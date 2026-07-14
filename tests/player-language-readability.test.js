import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('first-play surfaces use player-facing Korean labels', async () => {
    const [controlPanel, dashboard, mapNavigator, mobileSummary, returnBriefing, messages] = await Promise.all([
        readSrc('src/components/ControlPanel.tsx'),
        readSrc('src/components/Dashboard.tsx'),
        readSrc('src/components/MapNavigator.tsx'),
        readSrc('src/components/DashboardMobileSummary.tsx'),
        readSrc('src/components/ReturnBriefingCard.tsx'),
        readSrc('src/data/messages.ts'),
    ]);

    assert.match(controlPanel, /현재 임무/);
    assert.match(controlPanel, /다음 행동/);
    assert.match(controlPanel, /이동 경로/);
    assert.doesNotMatch(controlPanel, />\s*(Mission|Route Map|Recommended|CANCEL|NEXT)\s*</);

    assert.match(dashboard, /id: 'rest', label: '휴식'/);
    assert.match(dashboard, /id: 'class', label: '전직'/);
    assert.match(dashboard, /id: 'quest', label: '임무'/);
    assert.match(dashboard, /id: 'craft', label: '제작'/);
    assert.match(dashboard, /<span>초기화<\/span>/);
    assert.match(dashboard, /<span>취소<\/span>/);

    assert.match(mapNavigator, /세계 지도/);
    assert.match(mapNavigator, /전체 경로/);
    assert.match(mapNavigator, /지역 이야기/);
    assert.doesNotMatch(mapNavigator, />\s*(Atlas Map|Current Position|World Routes|Area Lore)\s*</);

    assert.match(mobileSummary, /label: '주무기'/);
    assert.match(mobileSummary, /fallback: '비어 있음'/);
    assert.match(mobileSummary, /mobile-summary-signature-\$\{entry\.slot\}/);
    assert.doesNotMatch(mobileSummary, /label: '(LEFT|RIGHT|ARMOR)'/);

    assert.match(returnBriefing, /다시 만난 모험가에게/);
    assert.match(messages, /RETURN_BRIEFING_STATUS_LABEL: '현재 상태'/);
    assert.match(messages, /RETURN_BRIEFING_MISSIONS_LABEL: '남은 오늘의 임무'/);
});
