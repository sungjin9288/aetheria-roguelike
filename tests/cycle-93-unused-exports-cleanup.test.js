import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 93: utils 파일 단위 dead export 정리.
 *
 * cycle 90-92에서 dead component / service를 정리한 흐름의 연장. 이번엔
 * 파일은 active이지만 export 일부가 어디서도 import되지 않고 자기 파일
 * 안에서도 호출되지 않는 dead exports를 정리한다.
 *
 * 정리 대상 (사용처 / 자기 파일 내 호출 모두 0건):
 *   1. IMAGEGEN_OVERLAY_KEYS @ src/utils/itemVisuals.ts (44 라인 const Set)
 *      "추가 imagegen 자산 생성 시 이 set에 키 등록 필요" 주석이 남아있지만
 *      실제로 이 set을 읽는 코드는 없음.
 *   2. getEquipmentOverlayAssetKey @ src/utils/itemVisuals.ts (5 라인)
 *      getEquipmentOverlayAssetSrc 옆에 정의됐지만 호출 0건.
 *   3. getOutfitAffinityTone @ src/utils/jobOutfitAffinity.ts (6 라인)
 *      "UI용: outfit affinity tone" 주석이 있지만 UI 어디서도 호출 X.
 *   4. getMaterialShop @ src/utils/shopRotation.ts (24 라인)
 *      "소재 상점 (레벨 기반 소재 판매)" 의도였지만 ShopPanel은 일반
 *      shop 로직만 사용 — material shop은 미구현 / 사용처 0건.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('itemVisuals.ts: IMAGEGEN_OVERLAY_KEYS export 제거됨', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    assert.doesNotMatch(source, /export\s+const\s+IMAGEGEN_OVERLAY_KEYS/);
});

test('itemVisuals.ts: getEquipmentOverlayAssetKey export 제거됨', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    assert.doesNotMatch(source, /export\s+const\s+getEquipmentOverlayAssetKey/);
});

test('itemVisuals.ts: 다른 active export는 회귀 보존', async () => {
    const source = await readSrc('src/utils/itemVisuals.ts');
    // getEquipmentOverlayAssetSrc(cycle 45) / getAvatarLoadoutStyle(cycle 36+) 등은 active
    assert.match(source, /export\s+const\s+getEquipmentOverlayAssetSrc/);
    assert.match(source, /export\s+const\s+getAvatarLoadoutStyle/);
});

test('jobOutfitAffinity.ts: getOutfitAffinityTone export 제거됨', async () => {
    const source = await readSrc('src/utils/jobOutfitAffinity.ts');
    assert.doesNotMatch(source, /export\s+const\s+getOutfitAffinityTone/);
});

test('shopRotation.ts: getMaterialShop export 제거됨', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    assert.doesNotMatch(source, /export\s+const\s+getMaterialShop/);
});

test('shopRotation.ts: 다른 active export는 회귀 보존', async () => {
    const source = await readSrc('src/utils/shopRotation.ts');
    // getDailyDeals / getWeeklySpecial 등은 ShopPanel에서 active 사용
    assert.match(source, /export\s+const\s+(getDailyDeals|getWeeklySpecial)/);
});
