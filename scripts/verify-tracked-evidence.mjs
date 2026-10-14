// 추적 증빙 검증 묶음 — package.json에서 `--verify docs/evidence/...`를 받는 스크립트 전부 + 아트 검증.
// 목록은 package.json에서 도출한다: 새 증빙 검증 스크립트를 추가하면 손으로 여기에 적지 않아도 들어온다.
// 2026-10-14 출시 전 통합 수용: Wave 103이 소스 해시를 고정한 파일을 바꾸고 증빙을 다시 쓰지 않았는데
// CI가 이 검증을 돌리지 않아 그대로 머지됐다(equipment-combat-power.json). CI의 evidence job이 이 스크립트를 돌린다.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const EXTRA_SCRIPTS = Object.freeze(['art:monsters:verify', 'art:verify']);

export const listTrackedEvidenceScripts = (pkg) => {
    const derived = Object.entries(pkg.scripts || {})
        .filter(([, command]) => /--verify\s+docs\/evidence\//.test(command))
        .map(([name]) => name);
    return [...derived, ...EXTRA_SCRIPTS.filter((name) => pkg.scripts?.[name] && !derived.includes(name))];
};

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const scripts = listTrackedEvidenceScripts(pkg);
    const failed = [];
    for (const name of scripts) {
        const started = Date.now();
        const result = spawnSync('npm', ['run', '-s', name], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        const ok = result.status === 0;
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (${seconds}s)`);
        if (!ok) {
            failed.push(name);
            process.stdout.write(`${result.stdout || ''}${result.stderr || ''}`.split('\n').slice(-20).join('\n'));
            process.stdout.write('\n');
        }
    }
    console.log(`tracked evidence: ${scripts.length - failed.length}/${scripts.length} ok`);
    if (failed.length > 0) process.exit(1);
}
