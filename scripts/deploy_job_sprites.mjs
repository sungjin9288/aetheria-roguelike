#!/usr/bin/env node
/**
 * deploy_job_sprites.mjs
 *
 * imagegen에서 받은 직업 sprite PNG를 deploy + AVAILABLE_AVATAR_KEYS 자동 갱신.
 *
 * 워크플로우:
 *   1. imagegen tool에서 PNG 받음 (output/job-sprite-todo.json의 prompt 사용)
 *   2. PNG를 output/imagegen/staged-jobs/{key}.png 형태로 저장
 *      예: output/imagegen/staged-jobs/warrior-leather-sword.png
 *   3. node scripts/deploy_job_sprites.mjs
 *   4. 결과:
 *      - PNG가 public/assets/avatars/{key}.png에 카피
 *      - src/utils/avatarSpriteCandidates.js의 AVAILABLE_AVATAR_KEYS Set에 키 자동 추가
 *      - cap:sync 자동 실행
 */

import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const STAGED_DIR = path.join(REPO_ROOT, 'output/imagegen/staged-jobs');
const TARGET_DIR = path.join(REPO_ROOT, 'public/assets/avatars');
const CANDIDATES_PATH = path.join(REPO_ROOT, 'src/utils/avatarSpriteCandidates.js');

const args = process.argv.slice(2).reduce((acc, arg) => {
    const [k, v] = arg.replace(/^--/, '').split('=');
    acc[k] = v ?? true;
    return acc;
}, {});

if (!existsSync(STAGED_DIR)) {
    mkdirSync(STAGED_DIR, { recursive: true });
    console.log(`Staged 디렉토리 생성: ${STAGED_DIR}`);
    console.log('\nimagegen에서 받은 PNG를 다음 위치에 저장:');
    console.log(`  ${STAGED_DIR}/{key}.png`);
    console.log('\n예시 키 (output/job-sprite-todo.json 참조):');
    console.log('  warrior-leather-sword.png');
    console.log('  knight-coat-guardian.png');
    console.log('  archmage-robe-caster.png');
    process.exit(0);
}

const stagedFiles = readdirSync(STAGED_DIR).filter((f) => f.endsWith('.png'));
if (stagedFiles.length === 0) {
    console.log(`Staged 디렉토리에 PNG 없음: ${STAGED_DIR}`);
    console.log('imagegen에서 받은 PNG를 거기에 저장한 후 다시 실행하세요.');
    process.exit(0);
}

console.log(`Staged ${stagedFiles.length}개 PNG 발견:`);
const newKeys = [];
const validKeyPattern = /^[a-z][a-z0-9-]+$/;

for (const file of stagedFiles) {
    const key = file.replace(/\.png$/, '');
    if (!validKeyPattern.test(key)) {
        console.warn(`  ⚠️  스킵 (잘못된 키 형식): ${file}`);
        continue;
    }
    const target = path.join(TARGET_DIR, file);
    copyFileSync(path.join(STAGED_DIR, file), target);
    console.log(`  ✓ ${file} → public/assets/avatars/${file}`);
    newKeys.push(key);
}

if (newKeys.length === 0) {
    console.log('\n새 키 없음 — AVAILABLE_AVATAR_KEYS 갱신 스킵');
    process.exit(0);
}

const candidatesSrc = readFileSync(CANDIDATES_PATH, 'utf8');
const setRegex = /const AVAILABLE_AVATAR_KEYS = new Set\(\[([\s\S]*?)\]\);/;
const match = candidatesSrc.match(setRegex);
if (!match) {
    console.error('AVAILABLE_AVATAR_KEYS set을 찾을 수 없음');
    process.exit(1);
}

const existingKeys = [...match[1].matchAll(/'([a-z][a-z0-9-]+)'/g)].map((m) => m[1]);
const merged = [...new Set([...existingKeys, ...newKeys])].sort();
const formatted = merged.map((k) => `    '${k}',`).join('\n');
const newSrc = candidatesSrc.replace(
    setRegex,
    `const AVAILABLE_AVATAR_KEYS = new Set([\n${formatted}\n]);`
);
writeFileSync(CANDIDATES_PATH, newSrc, 'utf8');

console.log(`\n✓ AVAILABLE_AVATAR_KEYS 갱신 (총 ${merged.length}개 키, 신규 ${newKeys.length}개)`);

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
console.log(`  - Xcode에서 Run → 폰에서 새 sprite 확인`);
console.log(`  - staged 디렉토리 정리: rm -f ${STAGED_DIR}/*.png`);
