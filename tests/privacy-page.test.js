import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
    PRIVACY_PAGE,
    PRIVACY_SOURCE,
    renderPrivacyBody,
    renderPrivacyPage,
} from '../scripts/build-privacy-page.mjs';
import { CONSTANTS } from '../src/data/constants.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const source = await readFile(path.join(repoRoot, PRIVACY_SOURCE), 'utf8');
const page = await readFile(path.join(repoRoot, PRIVACY_PAGE), 'utf8');

test('공개 처리방침 페이지는 초안 문서에서 만든 그대로다 — 문서를 고치면 생성기를 다시 돌린다', () => {
    assert.equal(page, renderPrivacyPage(source), 'node scripts/build-privacy-page.mjs 로 다시 쓴다');
});

test('공개본에는 초안 안내(인용 블록)와 내부 문서 링크가 없다', () => {
    assert.doesNotMatch(page, /초안|PRIVACY_POLICY_EVIDENCE|공개본에서 지운다/);
    assert.match(page, /<h1>에테리아 로그라이크 개인정보 처리방침<\/h1>/);
    assert.equal((page.match(/<h2>제\d+조/g) ?? []).length, 12);
});

test('공개본에는 채우지 않은 〔 〕 칸이 없다 — 이 파일이 그대로 배포된다', () => {
    assert.doesNotMatch(page, /[〔〕]/);
});

test('처리방침은 출시 결정과 같다 — AI 이벤트는 꺼져 있고 오류 보고는 Sentry로 간다', () => {
    // 빌드 환경 없이 읽은 기본값 — AI 이벤트를 켜려면 처리방침의 AI 항목(수탁자 포함)을 먼저 되살린다.
    assert.equal(CONSTANTS.USE_AI_PROXY, false);
    assert.doesNotMatch(source, /〔AI〕|Gemini|Cloudflare/);
    assert.match(page, /Functional Software, Inc\. — Sentry/);
    assert.match(page, /<td>오류 보고<\/td>/);
});

test('생성기는 표 · 목록 · 굵게를 옮기고 HTML을 이스케이프한다', () => {
    const { title, html } = renderPrivacyBody([
        '# 제목 (초안)',
        '> 지워지는 안내',
        '',
        '문단 <script> & **굵게**',
        '',
        '1. 하나',
        '2. 둘',
        '',
        '- 가',
        '',
        '| 머리 | 칸 |',
        '|---|---|',
        '| a | b |',
    ].join('\n'));
    assert.equal(title, '제목');
    assert.equal(html, [
        '<p>문단 &lt;script&gt; &amp; <strong>굵게</strong></p>',
        '<ol><li>하나</li><li>둘</li></ol>',
        '<ul><li>가</li></ul>',
        '<div class="table-wrap"><table>',
        '<thead><tr><th scope="col">머리</th><th scope="col">칸</th></tr></thead>',
        '<tbody><tr><td>a</td><td>b</td></tr></tbody>',
        '</table></div>',
    ].join('\n'));
});
