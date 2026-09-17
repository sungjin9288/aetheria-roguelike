import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildMonsterArtCatalog, classifyMonsterArchetype } from '../scripts/monsterArtCatalog.mjs';
import { verifyArtAssets } from '../scripts/verify-art-assets.mjs';
import monsterArtManifest from '../src/data/monsterArtManifest.json' with { type: 'json' };
import { MONSTERS } from '../src/data/monsters.js';
import { getMonsterVisual } from '../src/utils/monsterVisuals.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GENERATOR = path.join(ROOT, 'scripts', 'generate_monster_catalog_art.py');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const CORRECTED_NAMES = [
    '감옥 골렘', '강의 요괴', '고대 마법사', '고문관', '공간 파괴자',
    '공허 감시병', '공허 마법사', '공허 집행관', '공허의 감시자', '광석골렘',
    '균열 감시자', '그림자 사냥꾼', '뇌운의 사냥꾼', '데스나이트', '돌 거인',
    '레드 드래곤', '마법 감시자', '마왕의 사도', '망령 기사', '망령 기사단장',
    '미궁의 마왕', '바람 추적자', '보물사냥꾼', '분노한 마구스', '붕괴된 수호자',
    '붕괴한 수호자', '뼈 수집가', '사기꾼 마법사', '사막도적', '사슬 마왕',
    '석상 가디언', '수정 지킴이', '신전 경비병', '실험실 수호자', '심연의 수호자',
    '어둠 수호자', '에테르 돌격대', '에테르 방랑자', '영겁의 수호신상', '유령 기사',
    '익사한 기사', '저주받은 기사', '저주받은 어부', '전초기지 파수꾼', '종말의 마법사',
    '종말의 전령', '지옥의 문지기', '차원 방랑자', '차원 분열체', '차원 사령관',
    '차원의 포식자', '최후의 수호자', '타락 기사', '타락한 용사', '탐욕의 상인',
    '탑 수호자', '파멸의 기사', '폭풍 수호자', '함정 수호자', '허무 집행관',
    '허무의 기사', '허무의 집행관', '혼돈의 추종자', '혼돈의 화신', '화염 군주 이프리트',
    '화염 사제', '화염의 군주', '황금 골렘', '흡혼 해골',
    '전류 추적자', '변이 실험체', '에테르 잔류체', '에테르 흡수체', '망자의 사제',
    '암흑 사제', '언데드 마법사', '화염 도마뱀', '불꽃 도마뱀', '화산 도마뱀',
    '공허의 대행자', '무한의 화신', '에테르 심판자', '봄의 여왕',
    '수호신의 사도', '에테르 거인', '하수도의 여왕', '혼돈의 수호자',
    '눈보라 정령', '머맨', '스핑크스', '스노우 울프', '살아있는 마법서', '미믹',
    '프로토타입 제로', '천둥새 제피로스', '아누비스 수호자', '성스러운 물고기', '거대 거북',
    '심연의 크라켄', '묘지기 네크론', '혈월의 뱀파이어 로드', '기계 장군',
    '빙결의 마녀', '아이스 드래곤', '마력 결정체', '거대 지렁이', '고원 그리핀',
    '서리 군주', '원시의 신', '차원 파쇄자', '차원 포식자', '타락한 세계수 수호자',
    '공허의 신', '시간의 파수꾼', '영겁의 수문장', '타락한 세계수 영혼', '고대 호수의 수호신',
    '고블린', '코볼트', '초록슬라임',
    '거대 지네', '광풍의 하피', '물의 정령', '암흑 마법사', '코볼트 광부',
    '결정 정령', '광물 지네', '다크 엘프', '동굴 트롤', '박쥐 떼',
    '설원 거인', '설인', '수정 골렘', '얼음 정령',
    '마그마 슬라임', '용암 거북', '파이어뱃', '화염 정령', '마그마 정령',
    '용암 정령', '화산 정령', '용암 거인', '용암 골렘', '화염 골렘',
    '강철 자동인형', '과부하 포격기', '미라', '생체 병기', '오염된 연구원',
    '오작동 로봇', '증기 골렘', '폐회로 마도병', '폭주 자동인형',
    '망각의 나가', '심연 크라켄', '심해 기도사', '어비스 리바이어던', '한 맺힌 망자', '해류 파수꾼',
    '광풍의 원소', '구름 정령', '바람 정령', '번개 정령', '빛결 수정체', '성운 감시자',
    '천공 수호조', '폭풍 그리핀', '폭풍 매', '폭풍 세이렌', '하늘 정령',
    '고목 골렘', '꽃 골렘', '야생 그리핀',
    '마법 구체', '마법 인형', '책의 정령',
    '리치', '뱀파이어', '해골 마법사', '유령 군단', '독 지네', '부식된 기계병', '하수도 악어',
    '공허의 파편', '심연의 눈', '공허 포격수', '공허의 짐승', '드래곤 나이트', '차원 보병', '타락한 천사',
    '서리 골렘', '서리 마법사', '서리 정령', '아이스 골렘', '얼음 거인', '프로스트 위치',
    '시간 파편체', '신성한 제관', '왕국 기사', '용병 전사', '황금 왕국 수호자',
    '에테르 파편체', '차원 균열체',
    '공허의 심판자', '균열의 사령관', '멸절의 사도', '심연의 파수꾼', '원한의 용사',
    '전초기지 사령관', '종말의 기사', '차원 분열자', '허무의 전령',
    '공허의 군주', '마왕', '에테르 군주', '엔트로피 군주',
    '차원 마왕', '허무의 황제', '에테르 드래곤',
    '서리 늑대', '잉크 슬라임', '화염 감시자',
    '뿌리 포식자', '세계수 수호자', '꽃잎 슬라임', '화산재 골렘', '뇌운 와이번', '바람 드레이크',
    '번개 골렘', '부식된 골렘', '얼음 기사', '호수 수호자', '화염 와이번', '화염 비룡',
].sort();

test('reviewed non-human bodies retain their exact-name art classification', () => {
    assert.deepEqual([
        classifyMonsterArchetype('스노우 울프'),
        classifyMonsterArchetype('살아있는 마법서'),
        classifyMonsterArchetype('미믹'),
        classifyMonsterArchetype('프로토타입 제로'),
        classifyMonsterArchetype('마력 결정체'),
        classifyMonsterArchetype('묘지기 네크론'),
        classifyMonsterArchetype('설원 거인'),
        classifyMonsterArchetype('용암 거인'),
        classifyMonsterArchetype('생체 병기'),
        classifyMonsterArchetype('증기 골렘'),
    ], ['beast', 'construct', 'construct', 'machine', 'construct', 'caster', 'warrior', 'warrior', 'beast', 'machine']);
});

test('reviewed body corrections use pinned authored sprites without prototype decoration', async () => {
    const catalog = await buildMonsterArtCatalog();
    assert.deepEqual(Object.keys(catalog.corrections).sort(), CORRECTED_NAMES);
    for (const name of CORRECTED_NAMES) {
        const correction = catalog.corrections[name];
        const entry = monsterArtManifest.entries[name];
        assert.equal(entry.sourceRuntimePath, correction.sourceRuntimePath);
        assert.equal(entry.sha256, correction.sha256);
        assert.deepEqual((await pngContract(entry.runtimePath)).bytes,
            (await pngContract(correction.sourceRuntimePath)).bytes, name);
        assert.equal(getMonsterVisual(`정예 ${name}`).src, entry.runtimePath);
    }
});

test('monster verification rejects a corrected sprite relabelled as its old prototype', async () => {
    const manifest = structuredClone(monsterArtManifest);
    manifest.entries['머맨'].sourceRuntimePath = '/assets/monsters/fire/fire-spirit.png';
    const report = await verifyArtAssets({ scope: 'monsters', monsterManifest: manifest });
    assert.equal(report.ok, false);
    assert.ok(report.invalidArtwork.includes('monster:머맨:authored correction mismatch'));
});

test('authored correction registry fails closed on unknown names, path substitution and hash drift', async () => {
    const canonical = JSON.parse(await readFile(path.join(ROOT,
        'scripts/art_sources/monsters/v1/corrections.json'), 'utf8'));
    for (const change of [
        (value) => { value.entries.unknown = value.entries['머맨']; },
        (value) => { value.entries['머맨'].sourceRuntimePath = '/assets/monsters/../fire/fire-spirit.png'; },
        (value) => { value.entries['머맨'].sourceRuntimePath = value.entries['스핑크스'].sourceRuntimePath; },
        (value) => { value.entries['머맨'].sha256 = '0'.repeat(64); },
        (value) => { value.version = 2; },
    ]) {
        const corrections = structuredClone(canonical);
        change(corrections);
        await assert.rejects(buildMonsterArtCatalog({ corrections }), /correction/i);
    }
});

const pngContract = async (runtimePath) => {
    const bytes = await readFile(path.join(ROOT, 'public', runtimePath.replace(/^\//, '')));
    return {
        bytes,
        signature: bytes.subarray(1, 4).toString('ascii'),
        width: bytes.readUInt32BE(16),
        height: bytes.readUInt32BE(20),
        colorType: bytes.readUInt8(25),
    };
};

test('monster art manifest has exact two-way coverage for all 254 canonical monsters', async () => {
    const catalog = await buildMonsterArtCatalog();
    const canonicalNames = Object.keys(MONSTERS).sort();
    const manifestNames = Object.keys(monsterArtManifest.entries).sort();

    assert.equal(catalog.monsters.length, 254);
    assert.equal(catalog.monsters.filter((monster) => monster.isBoss).length, 47);
    assert.deepEqual(manifestNames, canonicalNames);
    assert.equal(monsterArtManifest.version, 1);
    assert.equal(monsterArtManifest.catalogSha256, catalog.catalogSha256);
    assert.deepEqual(monsterArtManifest.art, {
        width: 160,
        height: 160,
        margin: 8,
        assetRoot: '/assets/monsters/catalog/',
        styleVersion: 2,
    });
});

test('semantic archetypes keep visually distinct creatures out of the generic humanoid bucket', () => {
    assert.deepEqual({
        kraken: classifyMonsterArchetype('심연의 크라켄'),
        thunderbird: classifyMonsterArchetype('천둥새 제피로스'),
        crocodile: classifyMonsterArchetype('하수도 악어'),
        machine: classifyMonsterArchetype('기계 장군'),
        voidLord: classifyMonsterArchetype('공허의 군주'),
        lakeGuardian: classifyMonsterArchetype('고대 호수의 수호신'),
        springQueen: classifyMonsterArchetype('봄의 여왕'),
        frostWitch: classifyMonsterArchetype('빙결의 마녀'),
        knight: classifyMonsterArchetype('종말의 기사'),
    }, {
        kraken: 'aquatic',
        thunderbird: 'avian',
        crocodile: 'reptile',
        machine: 'machine',
        voidLord: 'aberration',
        lakeGuardian: 'divine',
        springQueen: 'divine',
        frostWitch: 'caster',
        knight: 'warrior',
    });
});

test('every canonical monster resolves to one unique exact RGBA illustration', async () => {
    const runtimePaths = new Set();
    const byteHashes = new Set();

    for (const name of Object.keys(MONSTERS)) {
        const entry = monsterArtManifest.entries[name];
        const visual = getMonsterVisual(name);
        assert.deepEqual(visual, {
            key: entry.key,
            regionKey: entry.regionKey,
            src: entry.runtimePath,
        });
        assert.equal(runtimePaths.has(entry.runtimePath), false, `${name} reuses ${entry.runtimePath}`);
        runtimePaths.add(entry.runtimePath);

        const png = await pngContract(entry.runtimePath);
        assert.deepEqual(
            { signature: png.signature, width: png.width, height: png.height, colorType: png.colorType },
            { signature: 'PNG', width: 160, height: 160, colorType: 6 },
            `${name} has an invalid runtime PNG`,
        );
        const hash = sha256(png.bytes);
        assert.equal(hash, entry.sha256, `${name} manifest hash drift`);
        assert.equal(byteHashes.has(hash), false, `${name} reuses another monster's bytes`);
        byteHashes.add(hash);
    }

    assert.equal(runtimePaths.size, 254);
    assert.equal(byteHashes.size, 254);
    assert.equal(getMonsterVisual('등록되지 않은 몬스터'), null);
});

test('monster art generator reproduces the canonical manifest and runtime bytes', async (t) => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'aetheria-monster-art-'));
    t.after(() => rm(temporaryRoot, { recursive: true, force: true }));
    const publicRoot = path.join(temporaryRoot, 'public');
    const manifestPath = path.join(temporaryRoot, 'monsterArtManifest.json');
    const result = spawnSync('python3', [
        GENERATOR,
        '--output-root', publicRoot,
        '--manifest-output', manifestPath,
    ], { cwd: ROOT, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const generated = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.deepEqual(generated, monsterArtManifest);

    for (const entry of Object.values(generated.entries)) {
        const relativePath = entry.runtimePath.replace(/^\//, '');
        assert.deepEqual(
            await readFile(path.join(publicRoot, relativePath)),
            await readFile(path.join(ROOT, 'public', relativePath)),
            entry.runtimePath,
        );
    }
});

test('approved full art verification includes the complete monster surface', async () => {
    const report = await verifyArtAssets({ scope: 'all' });

    assert.deepEqual(report.verifiedSurfaces, [
        'characters',
        'equipment',
        'families',
        'signature-overlays',
        'monsters',
    ]);
    assert.equal(report.counts.monsters, 254);
    assert.equal(report.exports.filter((entry) => entry.identity.startsWith('monster:')).length, 254);
    assert.equal(report.ok, true, JSON.stringify(report, null, 2));
});

test('monster verification rejects catalog metadata and asset hash drift', async () => {
    const catalog = await buildMonsterArtCatalog();
    const monster = catalog.monsters[0];
    const canonicalEntry = monsterArtManifest.entries[monster.name];
    const manifest = {
        ...monsterArtManifest,
        entries: {
            [monster.name]: {
                ...canonicalEntry,
                regionKey: 'wrong-region',
                sha256: '0'.repeat(64),
            },
        },
    };
    const report = await verifyArtAssets({
        scope: 'monsters',
        monsterCatalog: {
            ...catalog,
            monsters: [monster],
        },
        monsterManifest: manifest,
    });

    assert.equal(report.ok, false);
    assert.equal(report.invalidArtwork.some((error) => error.includes(`${monster.name}:regionKey`)), true);
    assert.equal(report.invalidArtwork.some((error) => error.includes(`${monster.name}:sha256`)), true);
});
