import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * 이동 권고 ✦N 칩 렌더 와이어링 — cycle 24가 데이터 필드를 노출했지만
 * ControlPanel 이동 버튼과 MapNavigator 추천 경로 pill 모두 route.chips를
 * 렌더하지 않아 데이터가 dead한 상태였다. 두 consumer가 실제로
 * undiscoveredSignatureCount를 읽어 ✦N 표시를 그려야 한다.
 *
 * 계약:
 *   1. ControlPanel route 버튼이 route.undiscoveredSignatureCount 참조
 *   2. ControlPanel이 count > 0일 때만 ✦N 마커 렌더 (silence over noise)
 *   3. MapNavigator 추천 경로 pill도 동일 패턴
 *   4. data-testid="move-recommendation-signature" 노출 (integration 안정성)
 *   5. gold #f6e7a2 팔레트 일관 사용
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('ControlPanel reads route.undiscoveredSignatureCount', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(
        /route\.undiscoveredSignatureCount|undiscoveredSignatureCount/.test(source),
        'ControlPanel should reference route.undiscoveredSignatureCount'
    );
});

test('ControlPanel renders ✦ marker for routes with undiscovered signatures', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    // ✦ 마커가 route 렌더 영역(moveRecommendations.map) 안에 있는지 source-level 확인
    const moveRoutesMatch = source.match(/moveRecommendations\.map\(\(route\)[\s\S]*?\)\)\}/);
    assert.ok(moveRoutesMatch, 'could not locate moveRecommendations.map block');
    assert.ok(
        /✦/.test(moveRoutesMatch[0]),
        'route render block should include ✦ glyph for signature signal'
    );
});

test('ControlPanel exposes move-recommendation-signature testid', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(
        /move-recommendation-signature/.test(source),
        'ControlPanel should expose data-testid="move-recommendation-signature" hook'
    );
});

test('ControlPanel uses gold palette for the chip', async () => {
    const source = await readSrc('src/components/ControlPanel.tsx');
    assert.ok(
        /#f6e7a2|246,\s*231,\s*162/.test(source),
        'signature chip should reuse #f6e7a2 / rgba(246,231,162) gold palette'
    );
});

test('MapNavigator recommended pills read route.undiscoveredSignatureCount', async () => {
    const source = await readSrc('src/components/MapNavigator.tsx');
    assert.ok(
        /route\.undiscoveredSignatureCount|undiscoveredSignatureCount/.test(source),
        'MapNavigator recommended pills should reference undiscoveredSignatureCount'
    );
});

test('MapNavigator pill renders ✦ marker for signature routes', async () => {
    const source = await readSrc('src/components/MapNavigator.tsx');
    // visibleRecommendations.map 블록 안에서 ✦ 마커 사용
    const recBlockMatch = source.match(/visibleRecommendations\.map\(\(route\)[\s\S]*?\)\)\}/);
    assert.ok(recBlockMatch, 'could not locate visibleRecommendations.map block');
    assert.ok(
        /✦/.test(recBlockMatch[0]),
        'recommended pill render block should include ✦ glyph'
    );
});
