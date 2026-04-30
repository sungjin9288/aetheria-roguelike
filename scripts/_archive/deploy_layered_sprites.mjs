#!/usr/bin/env node
/**
 * deploy_layered_sprites.mjs
 *
 * cycle 47 layered character system 자산 deploy + manifest 자동 갱신.
 *
 * 워크플로우:
 *   1. imagegen tool에서 PNG 받음 (output/layered-todo.json의 prompt 사용)
 *   2. PNG를 output/imagegen/staged-layered/{layerType}/{key}.png 로 저장
 *      예: output/imagegen/staged-layered/body/adventurer.png
 *           output/imagegen/staged-layered/weapon/sword.png
 *   3. node scripts/deploy_layered_sprites.mjs
 *   4. 결과:
 *      - PNG가 public/assets/avatars/layers/{layerType}/{key}.png에 카피
 *      - src/utils/layeredCharacter.js의 LAYERED_MANIFEST에 키 자동 추가
 *      - cap:sync 자동 실행
 */

import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STAGED_DIR = path.join(REPO_ROOT, 'output/imagegen/staged-layered');
const TARGET_DIR = path.join(REPO_ROOT, 'public/assets/avatars/layers');
const MANIFEST_PATH = path.join(REPO_ROOT, 'src/utils/layeredCharacter.js');

const LAYER_TYPES = ['body', 'cape', 'armor', 'boots', 'weapon', 'helmet'];

const args = process.argv.slice(2).reduce((acc, arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    acc[k] = v ?? true;
    return acc;
}, {});

if (!existsSync(STAGED_DIR)) {
    for (const type of LAYER_TYPES) {
        mkdirSync(path.join(STAGED_DIR, type), { recursive: true });
    }
    console.log(`Staged 디렉토리 생성: ${STAGED_DIR}`);
    console.log('\nimagegen에서 받은 PNG를 다음 위치에 저장:');
    for (const type of LAYER_TYPES) {
        console.log(`  ${STAGED_DIR}/${type}/{key}.png`);
    }
    console.log('\n예시:');
    console.log(`  ${STAGED_DIR}/body/adventurer.png`);
    console.log(`  ${STAGED_DIR}/weapon/sword.png`);
    process.exit(0);
}

// 각 layer type 폴더 검사
const newKeysByType = {};
for (const type of LAYER_TYPES) {
    const stagedTypeDir = path.join(STAGED_DIR, type);
    if (!existsSync(stagedTypeDir)) continue;
    const files = readdirSync(stagedTypeDir).filter((f) => f.endsWith('.png'));
    if (files.length === 0) continue;
    newKeysByType[type] = [];
    const targetTypeDir = path.join(TARGET_DIR, type);
    if (!existsSync(targetTypeDir)) mkdirSync(targetTypeDir, { recursive: true });
    for (const file of files) {
        const key = file.replace(/\.png$/, '');
        if (!/^[a-z][a-z0-9-]*$/.test(key)) {
            console.warn(`  ⚠️  ${type}/${file} 스킵 (잘못된 키 형식)`);
            continue;
        }
        copyFileSync(path.join(stagedTypeDir, file), path.join(targetTypeDir, file));
        console.log(`  ✓ ${type}/${file} → public/assets/avatars/layers/${type}/${file}`);
        newKeysByType[type].push(key);
    }
}

const totalNew = Object.values(newKeysByType).reduce((s, arr) => s + arr.length, 0);
if (totalNew === 0) {
    console.log('\nStaged 디렉토리에 PNG 없음 또는 모두 잘못된 형식');
    process.exit(0);
}

// LAYERED_MANIFEST 갱신
let manifestSrc = readFileSync(MANIFEST_PATH, 'utf8');

for (const [type, newKeys] of Object.entries(newKeysByType)) {
    if (!newKeys.length) continue;
    // 각 type의 set 추출 + 갱신
    const re = new RegExp(`(${type}:\\s*new Set\\(\\[)([\\s\\S]*?)(\\]\\))`);
    const match = manifestSrc.match(re);
    if (!match) {
        console.warn(`manifest에서 ${type} set 못 찾음 — 수동 추가 필요`);
        continue;
    }
    const existingBody = match[2];
    const existingKeys = [...existingBody.matchAll(/'([a-z][a-z0-9-]*)'/g)].map((m) => m[1]);
    const merged = [...new Set([...existingKeys, ...newKeys])].sort();
    const formatted = merged.length === 0
        ? '\n        // (empty)\n    '
        : '\n        ' + merged.map((k) => `'${k}'`).join(', ') + ',\n    ';
    manifestSrc = manifestSrc.replace(re, `$1${formatted}$3`);
    console.log(`  ✓ ${type} manifest: ${existingKeys.length} → ${merged.length}`);
}

writeFileSync(MANIFEST_PATH, manifestSrc, 'utf8');
console.log(`\n✓ LAYERED_MANIFEST 갱신 (총 ${totalNew}개 신규)`);

if (args['skip-build']) {
    console.log('\n--skip-build 옵션 — cap:sync 스킵');
} else {
    console.log('\n→ cap:sync 실행 중...');
    try {
        execSync('npm run cap:sync', { cwd: REPO_ROOT, stdio: 'inherit' });
    } catch (err) {
        console.error('cap:sync 실패:', err.message);
    }
}

console.log('\n완료. 다음 작업:');
console.log(`  - Xcode → Clean Build → Run`);
console.log(`  - staged 정리: rm -rf ${STAGED_DIR}/*/*.png`);
