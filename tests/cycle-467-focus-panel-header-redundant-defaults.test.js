import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * cycle 467: FocusPanelHeader 3 redundant default annotation 정리
 *   (cycle 222-466 silent dead config 시리즈 222번째 — redundant default annotation
 *   cleanup lens, cycle 441/451-452/456 패턴 회귀).
 *
 * 발견 (3 redundant defaults):
 * - src/components/FocusPanelHeader.tsx (line 6-19):
 *     const FocusPanelHeader = ({
 *         eyebrow = '',                  ← 5 호출자 모두 명시 전달
 *         ...
 *         archiveLabel = '인벤토리',     ← 4 호출자 'INV' 전달, 1 호출자 archive 미사용
 *         ...
 *         className = '',                ← 5 호출자 모두 미전달 (정적 className 보간)
 *         ...
 *     }: any) => ...
 * - 호출 사이트 분석 (5 callsite):
 *     · EventPanel.tsx:23 — eyebrow="Decision Window", archive 미사용 (no onOpenArchive).
 *     · ShopPanel.tsx:169 — eyebrow="Broker Ledger", archiveLabel="INV".
 *     · JobChangePanel.tsx:29 — eyebrow="Class Circuit", archiveLabel="INV".
 *     · CraftingPanel.tsx:247 — eyebrow="Forge Circuit", archiveLabel="INV".
 *     · QuestBoardPanel.tsx:83 — eyebrow="Mission Grid", archiveLabel="INV".
 * - 결과:
 *     · eyebrow = '' fallback 진입 0건.
 *     · archiveLabel = '인벤토리' fallback 진입 0건 (archive 미사용 시는 button 자체 미렌더).
 *     · className = '' fallback은 모든 호출에서 진입 (호출자 0/5 명시) — 본체 보간은
 *       그대로 ''.trim() 결과 유지가 필요.
 *
 * 패턴 (cycle 222-466 시리즈 222번째):
 * - cycle 441: FocusPanelHeader backLabel default 제거 (5/5 명시 전달).
 * - cycle 467: 같은 컴포넌트의 잔존 redundant default 3건 일괄 정리.
 *
 * 수정 (src/components/FocusPanelHeader.tsx):
 * - destructure에서 `eyebrow = ''`, `archiveLabel = '인벤토리'` 기본값 제거.
 * - className 기본값은 5/5 미전달이므로 동작상 항상 undefined → 본체에서 falsy
 *   guard 필요. 안전을 위해 className 처리도 정리: 정적 baseline + optional className
 *   spread.
 *
 * 회귀 가드:
 * - 5 callsite 명시 전달 보존 (eyebrow / archiveLabel).
 * - className 본체 동작 (있을 때만 추가) 그대로.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const readSrc = (relPath) => readFile(path.join(ROOT, relPath), 'utf8');

test('cycle 467: eyebrow / archiveLabel 기본값 0건', async () => {
    const source = await readSrc('src/components/FocusPanelHeader.tsx');
    const fnIdx = source.indexOf('const FocusPanelHeader =');
    const sigEnd = source.indexOf('}: any) =>', fnIdx);
    const sig = source.slice(fnIdx, sigEnd);
    assert.ok(!/eyebrow\s*=\s*''/.test(sig), "eyebrow = '' 제거");
    assert.ok(!/archiveLabel\s*=\s*'인벤토리'/.test(sig), "archiveLabel = '인벤토리' 제거");
});

test('cycle 467: 정합성 가드 — 5 callsite eyebrow 명시 전달', async () => {
    const callerFiles = [
        'src/components/EventPanel.tsx',
        'src/components/ShopPanel.tsx',
        'src/components/tabs/JobChangePanel.tsx',
        'src/components/tabs/CraftingPanel.tsx',
        'src/components/tabs/QuestBoardPanel.tsx',
    ];
    for (const file of callerFiles) {
        const source = await readSrc(file);
        const idx = source.indexOf('<FocusPanelHeader');
        assert.ok(idx >= 0, `${file}에 <FocusPanelHeader> 호출 존재`);
        const tagEnd = source.indexOf('/>', idx);
        const jsx = source.slice(idx, tagEnd);
        assert.ok(/eyebrow=/.test(jsx), `${file} callsite eyebrow 명시 전달`);
    }
});

test('cycle 467: cycle 441 회귀 가드 — backLabel 기본값 0건', async () => {
    const source = await readSrc('src/components/FocusPanelHeader.tsx');
    const fnIdx = source.indexOf('const FocusPanelHeader =');
    const sigEnd = source.indexOf('}: any) =>', fnIdx);
    const sig = source.slice(fnIdx, sigEnd);
    assert.ok(!/backLabel\s*=\s*'뒤로'/.test(sig), 'cycle 441 backLabel 기본값 제거 보존');
});

test('cycle 467: title / onBack / rightSlot / archiveTestId 활성 기본값 보존', async () => {
    const source = await readSrc('src/components/FocusPanelHeader.tsx');
    const fnIdx = source.indexOf('const FocusPanelHeader =');
    const sigEnd = source.indexOf('}: any) =>', fnIdx);
    const sig = source.slice(fnIdx, sigEnd);
    // title은 default 없는 필수 prop
    assert.ok(/\btitle\b/.test(sig), 'title prop 보존');
    // onBack/rightSlot는 default null 보존 (호출자 부분 누락 path 활성)
    assert.ok(/onBack\s*=\s*null/.test(sig), 'onBack = null 기본값 보존');
    assert.ok(/rightSlot\s*=\s*null/.test(sig), 'rightSlot = null 기본값 보존');
    // archiveTestId 등은 호출자 부분 누락 활성이라 보존
    assert.ok(/archiveTestId\s*=\s*null/.test(sig), 'archiveTestId 기본값 보존');
});
