#!/usr/bin/env node
/**
 * deploy_imagegen_assets.mjs
 *
 * imagegen에서 받은 PNG를 deploy + IMAGEGEN_OVERLAY_KEYS 자동 갱신.
 *
 * 워크플로우:
 *   1. imagegen tool에서 PNG 받음 (output/imagegen-todo.json의 prompt 사용)
 *   2. PNG를 output/imagegen/staged/{item-weapon-038}.png 형태로 저장
 *      (파일명이 imagegen key와 일치해야 함)
 *   3. 본 스크립트 실행:
 *        node scripts/deploy_imagegen_assets.mjs
 *   4. 결과:
 *      - PNG가 public/assets/equipment-exact/{key}.png에 카피
 *      - src/utils/itemVisuals.js의 IMAGEGEN_OVERLAY_KEYS Set에 키 자동 추가
 *      - cap:sync + 빌드까지 자동 실행 (옵션)
 */

import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STAGED_DIR = path.join(REPO_ROOT, 'output/imagegen/staged');
const TARGET_DIR = path.join(REPO_ROOT, 'public/assets/equipment-exact');
const ITEM_VISUALS = path.join(REPO_ROOT, 'src/utils/itemVisuals.js');

const args = process.argv.slice(2).reduce((acc, arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    acc[k] = v ?? true;
    return acc;
}, {});

if (!existsSync(STAGED_DIR)) {
    console.log(`Staged 디렉토리 없음: ${STAGED_DIR}`);
    console.log('먼저 imagegen에서 받은 PNG를 다음 위치에 저장:');
    console.log(`  ${STAGED_DIR}/item-weapon-038.png`);
    console.log(`  ${STAGED_DIR}/item-armor-001.png`);
    console.log('  ... (파일명은 imagegen key와 정확히 일치해야 함)');
    mkdirSync(STAGED_DIR, { recursive: true });
    process.exit(0);
}

const stagedFiles = readdirSync(STAGED_DIR).filter((f) => f.endsWith('.png'));
if (stagedFiles.length === 0) {
    console.log(`Staged 디렉토리에 PNG 없음: ${STAGED_DIR}`);
    process.exit(0);
}

console.log(`Staged ${stagedFiles.length}개 PNG 발견:`);
const newKeys = [];
for (const file of stagedFiles) {
    const key = file.replace(/\.png$/, '');
    if (!key.match(/^item-(weapon|armor|shield)-\d{3}$/)) {
        console.warn(`  ⚠️  스킵 (잘못된 키 형식): ${file}`);
        continue;
    }
    const target = path.join(TARGET_DIR, file);
    copyFileSync(path.join(STAGED_DIR, file), target);
    console.log(`  ✓ ${file} → public/assets/equipment-exact/${file}`);
    newKeys.push(key);
}

if (newKeys.length === 0) {
    console.log('새 키 없음 — IMAGEGEN_OVERLAY_KEYS 갱신 스킵');
    process.exit(0);
}

// itemVisuals.js의 IMAGEGEN_OVERLAY_KEYS set 갱신
const visualsSrc = readFileSync(ITEM_VISUALS, 'utf8');
const setRegex = /export const IMAGEGEN_OVERLAY_KEYS = new Set\(\[([\s\S]*?)\]\);/;
const match = visualsSrc.match(setRegex);
if (!match) {
    console.error('IMAGEGEN_OVERLAY_KEYS set을 itemVisuals.js에서 찾을 수 없음');
    process.exit(1);
}
const existingBody = match[1];
const existingKeys = [...existingBody.matchAll(/'(item-\w+-\d{3})'/g)].map((m) => m[1]);
const merged = [...new Set([...existingKeys, ...newKeys])].sort();

const formatted = merged
    .map((k, i) => (i % 4 === 0 ? `\n    '${k}',` : ` '${k}',`))
    .join('')
    .replace(/,$/, ',');
const newBody = `${formatted}\n`;
const newSrc = visualsSrc.replace(setRegex, `export const IMAGEGEN_OVERLAY_KEYS = new Set([${newBody}]);`);
writeFileSync(ITEM_VISUALS, newSrc, 'utf8');

console.log(`\n✓ IMAGEGEN_OVERLAY_KEYS 갱신 (총 ${merged.length}개 키)`);
console.log(`  신규 추가: ${newKeys.length}개`);

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
console.log(`  - Xcode에서 Run → 폰에서 새 자산 확인`);
console.log(`  - staged 디렉토리 정리: rm -f ${STAGED_DIR}/*.png`);
