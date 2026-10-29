import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// 개인정보 처리방침 공개본(public/privacy/index.html)을 초안 문서(docs/legal/PRIVACY_POLICY_KO.md)에서 만든다.
// 문서가 하나의 원본이다 — 공개본을 손으로 고치지 말 것(tests/privacy-page.test.js가 둘이 같은지 본다).
// 문서가 쓰는 마크다운만 옮긴다: 제목 · 문단 · 목록 · 표 · 굵게. 인용 블록(초안 안내)은 빠진다.
// 웹 빌드(Cloudflare Pages)에만 담기고 토스 번들에는 들어가지 않는다(토스 빌드는 그림 목록만 담는다).

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PRIVACY_SOURCE = 'docs/legal/PRIVACY_POLICY_KO.md';
export const PRIVACY_PAGE = 'public/privacy/index.html';

const escapeHtml = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const inline = (text) => escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());

const renderTable = (rows) => {
    const [head, , ...body] = rows.map(splitRow);
    return [
        '<div class="table-wrap"><table>',
        `<thead><tr>${head.map((cell) => `<th scope="col">${inline(cell)}</th>`).join('')}</tr></thead>`,
        `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody>`,
        '</table></div>',
    ].join('\n');
};

/** 문서 본문(인용 블록 제외)을 HTML 조각과 제목으로 바꾼다. */
export const renderPrivacyBody = (markdown) => {
    const blocks = [];
    let title = '';
    let paragraph = [];
    let list = null;
    let table = [];
    const flush = () => {
        if (paragraph.length) blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
        if (list) blocks.push(`<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${list.tag}>`);
        if (table.length) blocks.push(renderTable(table));
        paragraph = [];
        list = null;
        table = [];
    };
    for (const line of markdown.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('>')) {
            flush();
            continue;
        }
        const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
        const ordered = trimmed.match(/^\d+\.\s+(.*)$/);
        const bullet = trimmed.match(/^-\s+(.*)$/);
        if (heading) {
            flush();
            const level = heading[1].length;
            if (level === 1) title = heading[2].replace(/\s*\(초안\)\s*$/, '');
            else blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
        } else if (trimmed.startsWith('|')) {
            if (!table.length) flush();
            table.push(trimmed);
        } else if (ordered || bullet) {
            const tag = ordered ? 'ol' : 'ul';
            if (!list || list.tag !== tag) {
                flush();
                list = { tag, items: [] };
            }
            list.items.push((ordered || bullet)[1]);
        } else {
            if (list || table.length) flush();
            paragraph.push(trimmed);
        }
    }
    flush();
    return { title, html: blocks.join('\n') };
};

const STYLE = `
:root { color-scheme: light dark; --bg: #f7f6f2; --fg: #1d1b19; --muted: #5d5850; --line: #d9d4ca; --head: #ece8df; }
@media (prefers-color-scheme: dark) { :root { --bg: #14131a; --fg: #ece9e2; --muted: #a8a294; --line: #34313d; --head: #1f1d27; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.7 system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; word-break: keep-all; overflow-wrap: anywhere; }
main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 1.6rem; line-height: 1.35; margin: 0 0 24px; }
h2 { font-size: 1.15rem; margin: 40px 0 12px; padding-top: 16px; border-top: 1px solid var(--line); }
p, li { margin: 0 0 12px; }
ol, ul { padding-left: 1.4em; margin: 0 0 12px; }
.table-wrap { overflow-x: auto; margin: 0 0 16px; border: 1px solid var(--line); border-radius: 8px; }
table { border-collapse: collapse; width: 100%; min-width: 640px; font-size: 0.9rem; }
th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--line); }
th { background: var(--head); }
tr:last-child td { border-bottom: 0; }
`.trim();

export const renderPrivacyPage = (markdown) => {
    const { title, html } = renderPrivacyBody(markdown);
    return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${STYLE}
</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
${html}
</main>
</body>
</html>
`;
};

const main = async () => {
    const markdown = await readFile(path.join(repoRoot, PRIVACY_SOURCE), 'utf8');
    const target = path.join(repoRoot, PRIVACY_PAGE);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, renderPrivacyPage(markdown));
    process.stdout.write(`wrote ${PRIVACY_PAGE}\n`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
