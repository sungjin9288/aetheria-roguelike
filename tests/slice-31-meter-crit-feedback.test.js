import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Slice 31: 미터 fill 애니메이션 + 크리티컬 스크린 펄스.
 *
 * 진단: StatusMetric(HP/MP/EXP) 바 fill에 transition이 없어 값 변화가 즉시
 * snap(끊겨 보임). criticalHit 키프레임은 미사용(dead)이라 크리 화면 연출 0.
 *
 * 수정:
 * - StatusMetric fill에 transition-[width] tween — 데미지/EXP 변화가 부드럽게.
 * - CritPulse: 새 'critical' 로그 감지 시 화면 골드 비네트 짧게 깜빡(옅게).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('slice 31: StatusMetric 바 fill에 width tween', async () => {
    const src = await readSrc('src/components/StatusBar.tsx');
    assert.ok(/\$\{theme\.fill\}\s+transition-\[width\]/.test(src),
        'fill에 transition-[width] 적용');
});

test('slice 31: CritPulse — active일 때만 렌더 + 골드 비네트', async () => {
    const src = await readSrc('src/components/CritPulse.tsx');
    assert.ok(/active\s*&&/.test(src), 'active 가드');
    assert.ok(/data-testid="crit-pulse"/.test(src), 'crit-pulse testid');
    assert.ok(/246,231,162/.test(src), '골드 비네트');
    assert.ok(/pointer-events-none/.test(src), '입력 비차단');
});

test('slice 31: GameRoot — 새 critical 로그 id 감지 → critPulse', async () => {
    const src = await readSrc('src/components/app/GameRoot.tsx');
    assert.ok(/import CritPulse/.test(src), 'CritPulse import');
    assert.ok(/<CritPulse active=\{critPulse\}/.test(src), 'CritPulse 렌더');
    assert.ok(/lastCritLogIdRef/.test(src) && /last\.type !== 'critical'/.test(src),
        '로그 id 기반 fresh 크리 감지');
    assert.ok(/setTimeout\([\s\S]{0,80}setCritPulse\(false\)[\s\S]{0,12}320\)/.test(src),
        '~320ms 자동 해제');
});
