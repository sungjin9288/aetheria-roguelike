import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * FocusPanel — pity hint("전설 각인 공명")이 SignalBadge로 render될 때
 * 다른 emphasis와 동일한 neutral 톤으로 떨어진다. cycle 23이 메시지를,
 * cycle 24~25가 이동 권고 칩을 gold로 칠했지만 advice surface 자체는
 * 그대로다 — chain의 시각 일관성 결손.
 *
 * 계약:
 *   1. SignalBadge가 tone='signature' 지원 (#f6e7a2 / 246,231,162)
 *   2. FocusPanel이 guidance.emphasis === '확률 증폭'을 signature tone으로 매핑
 *   3. FocusPanel이 같은 케이스에서 Sparkles 아이콘 노출 (다른 emphasis는 영향 없음)
 *   4. 기존 emphasis 매핑(위험→danger, 즉시 이득→success) 회귀 가드
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('SignalBadge supports signature tone with #f6e7a2 gold palette', async () => {
    const source = await readSrc('src/components/SignalBadge.tsx');
    assert.ok(
        /signature\s*:\s*['"`][^'"`]*(?:#f6e7a2|246,\s*231,\s*162)/.test(source),
        'SignalBadge TONE_CLASS should expose a "signature" tone using gold palette'
    );
});

test('FocusPanel maps "확률 증폭" emphasis to signature tone', async () => {
    const source = await readSrc('src/components/dashboard/FocusPanel.tsx');
    assert.ok(
        /확률 증폭/.test(source),
        'FocusPanel should reference "확률 증폭" emphasis label'
    );
    // 매핑이 ternary든 lookup이든 같은 줄/근접 영역에서 signature가 등장해야 함
    assert.ok(
        /확률 증폭[\s\S]{0,80}['"]signature['"]/.test(source) ||
        /['"]signature['"][\s\S]{0,80}확률 증폭/.test(source),
        'FocusPanel should map "확률 증폭" to tone="signature"'
    );
});

test('FocusPanel imports Sparkles icon for signature emphasis', async () => {
    const source = await readSrc('src/components/dashboard/FocusPanel.tsx');
    assert.ok(
        /import\s*\{[^}]*Sparkles[^}]*\}\s*from\s*['"]lucide-react['"]/.test(source),
        'FocusPanel should import Sparkles from lucide-react for signature emphasis cue'
    );
});

test('FocusPanel renders Sparkles only when emphasis is signature pity', async () => {
    const source = await readSrc('src/components/dashboard/FocusPanel.tsx');
    // Sparkles 사용처가 conditional이어야 함 — 매번 렌더하면 다른 advice도 sparkle 폭격 받음
    assert.ok(
        /확률 증폭[\s\S]{0,200}<Sparkles|<Sparkles[\s\S]{0,200}확률 증폭|isSignaturePity[\s\S]{0,200}<Sparkles/.test(source),
        'Sparkles render should be gated on emphasis === "확률 증폭"'
    );
});

test('FocusPanel preserves existing emphasis → tone mapping (regression)', async () => {
    const source = await readSrc('src/components/dashboard/FocusPanel.tsx');
    assert.ok(/위험[\s\S]{0,40}['"]danger['"]/.test(source), '위험→danger 매핑 보존');
    assert.ok(/즉시 이득[\s\S]{0,40}['"]success['"]/.test(source), '즉시 이득→success 매핑 보존');
});
