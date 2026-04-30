import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * CombatPanel — 전투 중 signature 드롭 가능성 reminder.
 *
 * exploreActions는 boss 조우 순간에 "이 놈이 전설을 떨굴 수 있다"를 legendary 로그로
 * 한 번만 emit한다. 로그가 스크롤돼 올라가 버리면, 플레이어가 실제 공격을 주고받는
 * 동안 이 맥락은 사라진다. CombatPanel의 meta 바는 bossBriefLine/telegraph를 계속
 * 노출하므로, signature 드롭 hint도 같은 layer에 상주해야 "이 보스를 굳이 도망치지
 * 말고 끝까지 버텨야 하는 이유"가 전투 내내 시야에 남는다.
 *
 * 계약:
 *   1. CombatPanel이 getBossSignatureDrops를 import
 *   2. CombatEngine.resolveEnemyBaseName으로 prefix-stripped baseName에 질의
 *   3. enemy.isBoss + signatureDrops.length > 0일 때만 렌더
 *   4. data-testid="combat-signature-drop-hint" 노출
 *   5. "전설 각인" 라벨 포함
 *   6. #f6e7a2 gold 팔레트 (기존 signature tone과 일관)
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('CombatPanel imports getBossSignatureDrops', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(
        /import\s*\{[^}]*getBossSignatureDrops[^}]*\}\s*from\s*['"][^'"]*bossSignatureHint/.test(source),
        'CombatPanel should import getBossSignatureDrops from bossSignatureHint util'
    );
});

test('CombatPanel resolves enemy baseName before querying signature drops', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(
        /resolveEnemyBaseName\s*\(/.test(source),
        'should normalize prefixed boss name via CombatEngine.resolveEnemyBaseName'
    );
    assert.ok(
        /getBossSignatureDrops\s*\(/.test(source),
        'should invoke getBossSignatureDrops with the resolved name'
    );
});

test('CombatPanel renders combat-signature-drop-hint testid', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(
        /combat-signature-drop-hint/.test(source),
        'should expose data-testid="combat-signature-drop-hint" for the signature reminder block'
    );
});

test('CombatPanel labels the reminder as 전설 각인', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(
        /전설 각인/.test(source),
        'reminder should be labeled "전설 각인"'
    );
});

test('CombatPanel uses gold palette #f6e7a2 for signature reminder', async () => {
    const source = await readSrc('src/components/tabs/CombatPanel.tsx');
    assert.ok(
        /#f6e7a2|246,231,162/.test(source),
        'signature reminder should reuse #f6e7a2 / rgba(246,231,162) gold palette'
    );
});
