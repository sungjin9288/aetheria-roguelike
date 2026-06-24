import { readFile, readdir } from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOKS = path.join(HERE, '..', '..', 'src', 'hooks');
const INV_RE = /^useInventoryActions.*\.ts$/;

/**
 * useInventoryActions.ts + 모든 도메인 sub-factory 소스를 concat해서 반환.
 *
 * PR #4: createInventoryActions를 도메인별 파일(useInventoryActions.rewards.ts 등)로
 *   분할하면서, 메서드 본문 텍스트를 grep하는 소스 가드 테스트가 깨지지 않도록
 *   메인 + 모든 서브파일을 합쳐 한 문자열로 읽는다. 신규 `useInventoryActions.*.ts`는
 *   자동 포함되므로 이후 도메인 추가 시 테스트 수정이 불필요하다.
 */
export const readInventoryActionsSource = async () => {
    const files = (await readdir(HOOKS)).filter((f) => INV_RE.test(f)).sort();
    const parts = await Promise.all(files.map((f) => readFile(path.join(HOOKS, f), 'utf8')));
    return parts.join('\n');
};

/** 동기 버전 — fs.readFileSync 기반 sync 테스트용. */
export const readInventoryActionsSourceSync = () => {
    const files = readdirSync(HOOKS).filter((f) => INV_RE.test(f)).sort();
    return files.map((f) => readFileSync(path.join(HOOKS, f), 'utf8')).join('\n');
};
