import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

test('상태 화면은 현재 성장과 핵심 기록을 상세 누적 기록보다 먼저 보여 준다', async () => {
    const source = await readFile(path.join(ROOT, 'src/components/StatsPanel.tsx'), 'utf8');

    const growthIndex = source.indexOf('data-testid="stats-current-growth"');
    const coreIndex = source.indexOf('data-testid="stats-core-records"');
    const detailsIndex = source.indexOf('data-testid="stats-lifetime-records"');

    assert.ok(growthIndex > 0);
    assert.ok(coreIndex > growthIndex);
    assert.ok(detailsIndex > coreIndex);
    assert.match(source, /new Set\(\['레벨', '총 처치', '보스 처치', '최대 연속 처치'\]\)/);
    assert.doesNotMatch(source, /trait\.reasons\.join|trait\.bossDirective/);
});

test('세부 기록과 처치 분포, 계승 기록은 필요할 때 펼쳐 본다', async () => {
    const source = await readFile(path.join(ROOT, 'src/components/StatsPanel.tsx'), 'utf8');

    for (const testId of ['stats-lifetime-records', 'stats-top-kills', 'stats-legacy-records']) {
        assert.match(source, new RegExp(`<details data-testid="${testId}"`));
    }
    for (const label of ['사망', '현상수배 완료', '처치/사망', '누적 골드', '탐험 횟수', '발견 지역', '휴식 횟수', '도주 횟수', '제작 횟수', '합성 횟수', '완료한 발견 여정']) {
        assert.match(source, new RegExp(label));
    }
    assert.match(source, /min-h-14/);
});

test('상태 화면의 작은 문구와 영문식 장식 표기를 제거한다', async () => {
    const source = await readFile(path.join(ROOT, 'src/components/StatsPanel.tsx'), 'utf8');

    assert.doesNotMatch(source, /text-\[(?:8|9|10|10\.5)px\]/);
    assert.doesNotMatch(source, /uppercase|tracking-\[/);
    assert.match(source, /activeSignatureSet\.atkMult/);
    assert.match(source, /activeSignatureSet\.defMult/);
    assert.match(source, /activeSignatureSet\.hpMult/);
    assert.match(source, /activeSet\.prefix/);
    assert.match(source, /stats\.activeSynergies\.map/);
    assert.match(source, /syn\.label/);
    assert.match(source, /syn\.desc/);
});
