import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * 조작판의 소스 — `ControlPanel.tsx`와 그 조각 `src/components/control/*.ts(x)`(2026-10 에테르 유리 CH-08 분할).
 *   조작판의 배선을 소스로 읽는 계약은 이 묶음을 읽는다 — 조각으로 옮긴 testid · 문구가 사라졌다고 오판하지 않게.
 */
export const readControlPanelSource = async () => {
  const controlDir = path.join(ROOT, 'src/components/control');
  const parts = (await readdir(controlDir)).filter((name) => /\.tsx?$/.test(name)).sort();
  const sources = await Promise.all([
    readFile(path.join(ROOT, 'src/components/ControlPanel.tsx'), 'utf8'),
    ...parts.map((name) => readFile(path.join(controlDir, name), 'utf8')),
  ]);
  return sources.join('\n');
};
