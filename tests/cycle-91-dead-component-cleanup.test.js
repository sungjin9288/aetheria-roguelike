import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 91: 미사용 React 컴포넌트 2건 정리.
 *
 * cycle 90 OnboardingGuide 정리에 이어 dead component 추가 발견:
 *
 *   - src/components/icons/EquipmentSpriteGlyph.tsx (941 lines)
 *     자기 자신 외엔 어디서도 import되지 않음 (EquipmentSpriteLayer/
 *     EquipmentSpriteGlyph 둘 다 export됐지만 consumer 0건). 코드베이스 최대
 *     단일 .tsx 파일이었던 데드코드.
 *   - src/components/dashboard/DashboardPanels.tsx (332 lines)
 *     동일 폴더의 FocusPanel.tsx만 active. DashboardPanels는 어디서도 참조 X.
 *
 * 합 1273 lines 정리.
 *
 * 의존성 utils(equipmentArt / getExplorationForecast / getQuestTracker)는
 * 다른 active consumer가 있어 그대로 보존.
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

test('EquipmentSpriteGlyph.tsx 파일 제거됨', async () => {
    assert.equal(await fileExists('src/components/icons/EquipmentSpriteGlyph.tsx'), false);
});

test('DashboardPanels.tsx 파일 제거됨', async () => {
    assert.equal(await fileExists('src/components/dashboard/DashboardPanels.tsx'), false);
});

// cycle 310: FocusPanel.tsx도 cycle 91 시점에 active이었으나 이후 dispatch path가 모두 다른
//   컴포넌트로 이주하면서 0건 dead로 전락 → cycle 310에서 제거. 이 회귀 가드는 obsolete.

test('icons 폴더의 active consumer 회귀 보존 — ItemIcon', async () => {
    assert.equal(await fileExists('src/components/icons/ItemIcon.tsx'), true);
});

test('equipmentArt utility는 다른 active consumer가 있어 보존', async () => {
    const characterAppearance = await readFile(path.join(ROOT, 'src/utils/characterAppearance.ts'), 'utf8');
    assert.match(characterAppearance, /equipmentArt/);
});
