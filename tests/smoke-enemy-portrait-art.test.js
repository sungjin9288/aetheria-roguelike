import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';

import StatusBar from '../src/components/StatusBar.tsx';
import MonsterIcon from '../src/components/icons/MonsterIcon.tsx';
import { DB } from '../src/data/db.js';
import { getMonsterVisual } from '../src/utils/monsterVisuals.js';
import { makePlayerFixture, renderStatic } from './helpers/render.ts';

/**
 * Track V — smoke의 "Enemy portrait should render a monster family shape" 위양성 회귀 가드.
 *
 * 전투 HUD의 적 초상은 canonical 몬스터면 실루엣 SVG가 아니라 카탈로그 PNG <img>를
 * 렌더한다. 이 PNG는 public/sw.js의 stale-while-revalidate 경로를 타므로 첫 조우에서는
 * 캐시 미스가 확정이고, DOM 삽입과 디코드 완료 사이에 (서비스 워커 기동 + 네트워크)
 * 왕복이 들어간다. scripts/smoke-gameplay.mjs가 로드 완료를 기다리지 않고
 * naturalWidth를 읽으면 머신 부하에 따라 portraitRendered:false로 깜빡인다
 * (base 브랜치도 아트 응답을 1.5s 늦추면 동일하게 실패 — 타이밍 운이었다).
 *
 * 그래서 이 테스트는 두 가지를 함께 고정한다.
 *   1) 스모크 초반 경로(고요한 숲)의 몬스터는 전부 <img> 아트를 렌더한다 → 초상 단정은
 *      본질적으로 "이미지 로드"에 의존한다.
 *   2) 스모크 스크립트는 초상 단정 전에 이미지 로드 완료를 기다린다.
 */

// 스모크는 시작의 마을 → 고요한 숲으로 이동한 뒤 첫 전투를 치른다.
const SMOKE_FIRST_FIELD = '고요한 숲';

const renderEnemyPortrait = (enemy) => renderStatic(createElement(StatusBar, {
    player: makePlayerFixture({ name: '스모크 검증', loc: SMOKE_FIRST_FIELD }),
    stats: null,
    enemy,
    enemyHitCrit: false,
    onCrystalClick: null,
    onOpenEquipment: null,
}));

test('스모크 초반 경로의 몬스터 초상은 실루엣이 아니라 카탈로그 <img>로 렌더된다', () => {
    const roster = DB.MAPS[SMOKE_FIRST_FIELD].monsters;
    assert.ok(roster.length > 0, '고요한 숲 몬스터 로스터가 비어 있다');

    for (const name of roster) {
        const visual = getMonsterVisual(name);
        assert.ok(visual, `${name}의 카탈로그 아트가 없다 — 초상이 실루엣으로 떨어진다`);

        const markup = renderStatic(createElement(MonsterIcon, {
            name,
            discovered: true,
            isBoss: false,
            size: 46,
        }));
        assert.match(markup, /<img[^>]+src="\/assets\/monsters\//, `${name} 초상이 <img>가 아니다`);
        assert.ok(!markup.includes('<svg'), `${name} 초상이 실루엣 SVG로 렌더됐다`);
    }
});

test('전투 HUD의 enemy-portrait는 몬스터 아트 <img>를 담는다', () => {
    const markup = renderEnemyPortrait({
        name: DB.MAPS[SMOKE_FIRST_FIELD].monsters[0],
        hp: 30,
        maxHp: 30,
        isBoss: false,
    });

    assert.ok(markup.includes('data-testid="enemy-portrait"'), 'enemy-portrait 컨테이너가 없다');
    assert.match(markup, /data-monster-art="exact"/, '초상이 exact 아트 모드가 아니다');
    assert.match(markup, /<img[^>]+src="\/assets\/monsters\/catalog\//, '초상이 카탈로그 PNG를 참조하지 않는다');
});

test('카탈로그에 없는 이름은 d 속성을 가진 실루엣 SVG로 떨어진다', () => {
    const unknown = '__카탈로그에 없는 손상된 legacy 이름__';
    assert.equal(getMonsterVisual(unknown), null);

    const markup = renderStatic(createElement(MonsterIcon, {
        name: unknown,
        discovered: true,
        isBoss: false,
        size: 46,
    }));
    assert.ok(markup.includes('<svg'), '실루엣 fallback이 SVG가 아니다');
    assert.match(markup, /<path d="[^"]+"/, '실루엣 path에 d 속성이 없다');
});

test('smoke-gameplay는 초상 단정 전에 아트 <img> 로드 완료를 기다린다', () => {
    const source = readFileSync(
        fileURLToPath(new URL('../scripts/smoke-gameplay.mjs', import.meta.url)),
        'utf8',
    );

    const helper = source.match(/async function waitForEnemyPortraitArt\(page[\s\S]*?\n}\n/);
    assert.ok(helper, 'waitForEnemyPortraitArt 헬퍼가 없다');
    assert.match(helper[0], /image\.complete/, '헬퍼가 img.complete를 기다리지 않는다');
    assert.match(helper[0], /naturalWidth\s*>\s*0/, '헬퍼가 naturalWidth를 기다리지 않는다');
    assert.match(helper[0], /svg path/, '헬퍼가 실루엣 fallback을 통과시키지 않는다');

    const verify = source.match(/async function verifyCombatForecast\(page\)[\s\S]*?\n}\n/);
    assert.ok(verify, 'verifyCombatForecast를 찾지 못했다');
    const waitIndex = verify[0].indexOf('await waitForEnemyPortraitArt(page)');
    const assertIndex = verify[0].indexOf('layout.portraitRendered');
    assert.ok(waitIndex > 0, 'verifyCombatForecast가 초상 아트 로드를 기다리지 않는다');
    assert.ok(assertIndex > waitIndex, '초상 단정이 아트 로드 대기보다 먼저 실행된다');
});
