import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readSource = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('설정 화면은 플레이 설정과 장기 성장을 진단 정보보다 먼저 보여 준다', async () => {
    const source = await readSource('src/components/tabs/SystemTab.tsx');

    const playerSettings = source.indexOf('data-testid="system-player-settings"');
    const growthLinks = source.indexOf('data-testid="system-growth-links"');
    const secondaryTools = source.indexOf('data-testid="system-secondary-tools"');

    assert.ok(playerSettings >= 0);
    assert.ok(growthLinks > playerSettings);
    assert.ok(secondaryTools > growthLinks);
    assert.match(source, /플레이 설정/);
    assert.match(source, /장기 성장/);
    assert.match(source, /에테르 거울/);
    assert.match(source, /에테르 교환소/);
});

test('칭호 선택은 현재 효과를 먼저 보여 주고 나머지 기능은 기본 접힘이다', async () => {
    const source = await readSource('src/components/tabs/SystemTab.tsx');

    for (const testId of [
        'system-title-picker',
        'system-relic-list',
        'system-online-records',
        'system-feedback',
        'system-support-tools',
    ]) {
        assert.match(source, new RegExp(`(?:data-testid|testId)="${testId}"`));
    }

    assert.match(source, /getTitlePassiveLabel\(player\.activeTitle\)/);
    assert.doesNotMatch(source, /<details[^>]*\sopen(?:=|\s|>)/);
    assert.doesNotMatch(source, /오늘의 임무/);
});

test('설정 화면은 작은 문구와 작은 동작을 제거하고 기존 권한을 보존한다', async () => {
    const source = await readSource('src/components/tabs/SystemTab.tsx');

    assert.doesNotMatch(source, /text-\[(?:9|10)px\]/);
    assert.doesNotMatch(source, /min-h-\[(?:34|42)px\]/);
    assert.match(source, /actions\.setReadabilityMode\?\./);
    assert.match(source, /actions\.setEquipmentDetailMode\?\./);
    assert.match(source, /actions\.setActiveTitle\?\./);
    assert.match(source, /await addDoc\(feedbackCol/);
    assert.match(source, /await setDoc\(configRef/);
    assert.match(source, /actions\.isAdmin\(\)/);
});
