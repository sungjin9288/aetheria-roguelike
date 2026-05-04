import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 111: StatusBar에 active debuff chip 추가 — cycle 106-110에서 활성화된
 * status 효과의 시각 노출.
 *
 * 발견:
 * - cycle 106-110에서 player.status 5종(bleed/freeze/stun/curse/blind/fear)
 *   효과를 정상 작동시켰으나, 플레이어가 현재 어떤 status에 걸렸는지 UI에
 *   영구 노출되는 surface가 없음.
 * - 전투 로그는 부여 시점에만 1번 출력되고 스크롤되어 사라짐.
 * - StatusBar에는 killStreak 칩(cycle?), signature 칩(cycle 22), affinity 칩이
 *   있지만 debuff 칩은 비어있던 자리.
 *
 * 추가:
 * - StatusBar에 player.status가 존재하고 길이 > 0이면 debuff chip 노출.
 * - data-testid="status-debuff-chip", data-debuff-count attribute로 selectable.
 * - 시각적 톤: 위험(red/rose) 계열 — 모든 5종 status가 player에 부정적이므로
 *   단일 위험 톤으로 통합.
 * - 라벨: 첫 번째 status 한국어명 (또는 "디버프 N개" 형식).
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('StatusBar: status-debuff-chip testid 노출', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.match(source, /data-testid\s*=\s*["']status-debuff-chip["']/);
});

test('StatusBar: data-debuff-count attribute 노출 (테스트용 selectable)', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.match(source, /data-debuff-count/);
});

test('StatusBar: debuff chip이 player.status 길이 조건부 렌더', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    // player.status에 의존하는 조건부 렌더 패턴
    const idx = source.indexOf('status-debuff-chip');
    assert.ok(idx > -1, 'chip should exist');
    const window = source.slice(Math.max(0, idx - 800), idx);
    assert.match(window, /player\.status|player\?\.status/);
    assert.match(window, /\.length/);
});

test('StatusBar: 한국어 라벨 매핑 (bleed→출혈, curse→저주 등)', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    // 5종 상태 한국어 라벨 모두 등장
    const labels = ['출혈', '저주', '빙결', '실명', '공포'];
    for (const label of labels) {
        assert.ok(source.includes(label), `should map to '${label}'`);
    }
});

test('StatusBar: 기존 signature 칩 / killStreak 칩 회귀 보존', async () => {
    const source = await readSrc('src/components/StatusBar.tsx');
    assert.match(source, /data-testid\s*=\s*["']status-signature-chip["']/);
    assert.match(source, /killStreak/);
});
