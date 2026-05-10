import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 472: MapNavigator `compact` prop + `showAllMaps` 상태 cascade unreachable 정리
 *   (cycle 222-471 silent dead config 시리즈 225번째 — unreachable code path
 *   cleanup lens, cycle 471 cascade paired completion).
 *
 * 발견 (1 prop + 1 state + 6 ternary 가지 unreachable):
 * - src/components/MapNavigator.tsx:
 *     · line 61: const MapNavigator = ({ player, grave, stats, compact }: any) => {...}
 *     · line 62: const [showAllMaps, setShowAllMaps] = useState(false);
 *     · line 85: visibleEntries = compact && !showAllMaps ? slice : full
 *     · line 90: moveRecommendations.slice(0, compact ? 2 : 3)
 *     · line 97: ${compact ? 'space-y-2 p-2.5' : 'space-y-3 p-3'}
 *     · line 156-164: {compact && ... ? <toggle button> : null}
 * - 호출 사이트 분석:
 *     · Dashboard.tsx:195 — cycle 471이 compact={desktopArchiveCompact} 제거.
 *       이제 caller 0건 → compact 항상 undefined.
 *     · 다른 파일 import 0건.
 * - 결과:
 *     · compact는 항상 undefined → 5 ternary가 모두 false 가지 선택.
 *     · `compact && !showAllMaps` 항상 false → visibleEntries는 항상 full mapEntries.
 *     · `mapEntries.length > visibleEntries.length` 항상 false (같은 배열) →
 *       toggle button JSX 영원히 미렌더 → showAllMaps state cascade dead.
 *
 * 패턴 (cycle 222-471 시리즈 225번째):
 * - cycle 471: Dashboard desktopArchiveCompact const + 10 callsite compact attr 정리.
 * - cycle 472: MapNavigator compact prop cascade — cycle 471 paired completion.
 *   cycle 461 ClassCard / cycle 458 StatusMetric 패턴의 cascade 변형.
 *
 * 수정 (src/components/MapNavigator.tsx):
 * - destructure에서 compact 제거.
 * - useState(false) showAllMaps state + setShowAllMaps 제거.
 * - visibleEntries / visibleRecommendations / className 정적화.
 * - toggle button JSX (line 156-164) 제거.
 *
 * 회귀 가드:
 * - player / grave / stats prop 보존.
 * - selectedMapName useState 보존.
 * - 본체 World Routes / 추천 경로 로직 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 472: MapNavigator destructure에서 compact 0건', async () => {
    const source = await readSrc('src/components/MapNavigator.tsx');
    const fnIdx = source.indexOf('const MapNavigator =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(!/\bcompact\b/.test(sig), 'destructure에 compact 0건');
});

test('cycle 472: showAllMaps state + ternary 0건', async () => {
    const source = await readSrc('src/components/MapNavigator.tsx');
    assert.ok(!/showAllMaps/.test(source), 'showAllMaps 식별자 0건');
    assert.ok(!/setShowAllMaps/.test(source), 'setShowAllMaps 식별자 0건');
});

test('cycle 472: 본체 compact 참조 0건', async () => {
    const source = await readSrc('src/components/MapNavigator.tsx');
    assert.ok(!/\bcompact\b/.test(source), 'compact 참조 0건 (전체 파일)');
});

test('cycle 472: 정합성 가드 — Dashboard callsite compact 0건', async () => {
    const source = await readSrc('src/components/Dashboard.tsx');
    const idx = source.indexOf('<MapNavigator');
    const tagEnd = source.indexOf('/>', idx);
    const jsx = source.slice(idx, tagEnd);
    assert.ok(!/\bcompact\b/.test(jsx), 'Dashboard <MapNavigator> compact 전달 0건');
});

test('cycle 472: player / grave / stats / selectedMapName 보존', async () => {
    const source = await readSrc('src/components/MapNavigator.tsx');
    assert.ok(/selectedMapName/.test(source), 'selectedMapName state 보존');
    const fnIdx = source.indexOf('const MapNavigator =');
    const fnEnd = source.indexOf('=>', fnIdx);
    const sig = source.slice(fnIdx, fnEnd);
    assert.ok(/\bplayer\b/.test(sig), 'player prop 보존');
    assert.ok(/\bgrave\b/.test(sig), 'grave prop 보존');
    assert.ok(/\bstats\b/.test(sig), 'stats prop 보존');
});
