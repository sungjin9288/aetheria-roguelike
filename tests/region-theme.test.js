import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { MAPS } from '../src/data/maps.js';
import { REGION_THEMES, getRegionTheme } from '../src/utils/regionTheme.js';

/**
 * Slice 21: 지역별 ambient 팔레트 (탐험 진행감)
 *
 * READABILITY_TREND_RESEARCH 진단 잔여 항목 해소:
 * "단일 다크 슬레이트/시안 팔레트 — 42개 지역이 모두 같은 톤이라 탐험
 *  진행감이 시각적으로 약함."
 *
 * 설계 원칙 (리서치 Design Constraints 준수):
 * - 시맨틱 컬러(행동 가능/위험/보상/선택)는 그대로 — 지역 톤은 ambient 전용.
 * - 지역 이름 키워드 + 맵 type 기반 분류 (데이터 필드 추가 없음 → 세이브 영향 0).
 * - high-readability 모드에서는 ambient wash 감쇠.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

const HEX_RE = /^#[0-9a-f]{6}$/i;
const RGBA_RE = /^rgba\(\d+,\s*\d+,\s*\d+,\s*0\.\d+\)$/;

test('slice 21: REGION_THEMES — 10개 테마, accent/soft 포맷 계약', () => {
    const keys = Object.keys(REGION_THEMES);
    assert.ok(keys.length >= 10, `테마 10종 이상 (실제: ${keys.length})`);
    for (const [key, theme] of Object.entries(REGION_THEMES)) {
        assert.ok(HEX_RE.test(theme.accent), `${key}.accent hex 포맷 (${theme.accent})`);
        assert.ok(RGBA_RE.test(theme.soft), `${key}.soft rgba 포맷 (${theme.soft})`);
        assert.ok(theme.label, `${key}.label 존재`);
    }
});

test('slice 21: 전체 맵이 유효한 테마로 해석', () => {
    for (const [name, mapData] of Object.entries(MAPS)) {
        const theme = getRegionTheme(name, mapData);
        assert.ok(theme && theme.accent && theme.soft && theme.key,
            `${name} → 테마 해석 실패`);
        assert.ok(REGION_THEMES[theme.key], `${name} → 등록된 테마 키 (${theme.key})`);
    }
});

test('slice 21: 대표 지역 분류 정확성', () => {
    const expectKey = (name, key) => {
        const theme = getRegionTheme(name, MAPS[name]);
        assert.equal(theme.key, key, `${name} → ${key} (실제: ${theme.key})`);
    };
    expectKey('시작의 마을', 'haven');       // type safe
    expectKey('고요한 숲', 'forest');
    expectKey('신성한 호수', 'water');
    expectKey('화염의 협곡', 'ember');
    expectKey('북부 설원', 'frost');
    expectKey('빙하 심연', 'frost');         // 빙하 > 심연 우선
    expectKey('혼돈의 심연', 'abyss');
    expectKey('마왕성', 'abyss');
    expectKey('사막 오아시스', 'desert');
    expectKey('고대 마법 탑', 'arcane');
    expectKey('수정 동굴', 'arcane');        // 수정 > 동굴 우선
    expectKey('폭풍의 고원', 'storm');
    expectKey('잊혀진 폐허', 'ruin');
});

test('slice 21: 다양성 — 전체 맵에서 6개 이상 테마 등장', () => {
    const used = new Set(
        Object.entries(MAPS).map(([name, mapData]) => getRegionTheme(name, mapData).key)
    );
    assert.ok(used.size >= 6, `사용 테마 6종 이상 (실제: ${used.size} — ${[...used].join(', ')})`);
});

test('slice 21: 미지/누락 지역 fallback 안전', () => {
    const theme = getRegionTheme('존재하지 않는 지역', undefined);
    assert.ok(theme && REGION_THEMES[theme.key], 'unknown 지역도 유효 테마 반환');
});

test('slice 21: MainLayout — region CSS 변수 + ambient 레이어 부착', async () => {
    const ml = await readSrc('src/components/MainLayout.tsx');
    assert.ok(/--region-accent/.test(ml), 'MainLayout이 --region-accent 변수 설정');
    assert.ok(/data-region-theme/.test(ml), 'MainLayout이 data-region-theme 부착');
    assert.ok(/aether-region-ambient/.test(ml), 'ambient 레이어 존재');
});

test('slice 21: high-readability 모드에서 ambient 감쇠', async () => {
    const css = await readSrc('src/index.css');
    assert.ok(/\[data-readability-mode="high"\][^{]*\.aether-region-ambient/.test(css),
        'high 모드 ambient 감쇠 규칙 존재');
});

test('slice 21: StatusBar 위치 텍스트가 region accent 사용', async () => {
    const sb = await readSrc('src/components/StatusBar.tsx');
    assert.ok(/var\(--region-accent\)/.test(sb),
        'StatusBar 위치 표기에 region accent 적용');
});
