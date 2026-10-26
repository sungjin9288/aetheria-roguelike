import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

/**
 * CH-07: public/sw.js의 캐시는 배포마다 커지기만 했다 — 캐시 이름이 하나라 activate가 지울
 * 것이 없었고, 해시 이름의 빌드 산출물이 배포마다 새 키로 쌓였다.
 *
 * 여기서는 실제 sw.js를 node:vm에서 돌린다. Cache Storage · 네트워크 · ServiceWorker 전역은
 * 가짜이고, 네트워크는 Cloudflare Pages처럼 배포마다 산출물을 바꾸고 없는 경로에는
 * SPA 폴백(`/* /index.html 200`)으로 index.html을 준다. 확인하는 것은 두 가지다.
 * ① 배포를 여러 번 거쳐도 캐시에 남는 빌드 산출물은 지금 빌드의 것뿐이다.
 * ② 그래도 오프라인 플레이는 깨지지 않는다 — 지금 빌드의 진입 · 지연 청크 · 글꼴과 본 그림이
 *    오프라인 재실행에서 저장본으로 나온다(activate · 이전 판 캐시 이전 포함).
 */

const ORIGIN = 'https://game.test';
const SW_SOURCE = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const LEGACY_CACHE = 'aetheria-rpg-v3';
const ART = ['/assets/monsters/catalog/monster-aaa111.png', '/assets/items/axe.png', '/icons/icon-192.png'];

const urlOf = (input) => new URL(typeof input === 'string' ? input : input.url, ORIGIN);

class FakeCache {
    entries = new Map();

    async match(input) {
        return this.entries.get(urlOf(input).href)?.clone();
    }

    // 명세처럼 같은 요청의 기존 항목을 지우고 끝에 붙인다 — keys()는 갱신 순서다.
    async put(input, response) {
        const key = urlOf(input).href;
        this.entries.delete(key);
        this.entries.set(key, response);
    }

    async delete(input) {
        return this.entries.delete(urlOf(input).href);
    }

    async keys() {
        return [...this.entries.keys()].map((href) => new Request(href));
    }

    paths() {
        return [...this.entries.keys()].map((href) => new URL(href).pathname);
    }
}

class FakeCacheStorage {
    stores = new Map();

    constructor(network) {
        this.network = network;
    }

    async open(name) {
        if (!this.stores.has(name)) {
            const cache = new FakeCache();
            cache.addAll = async (inputs) => {
                const responses = await Promise.all(inputs.map((input) => this.network.fetch(input)));
                if (responses.some((response) => !response.ok)) throw new TypeError('addAll failed');
                await Promise.all(inputs.map((input, index) => cache.put(input, responses[index])));
            };
            this.stores.set(name, cache);
        }
        return this.stores.get(name);
    }

    async keys() {
        return [...this.stores.keys()];
    }

    async delete(name) {
        return this.stores.delete(name);
    }

    async match(input, { cacheName } = {}) {
        if (cacheName) return this.stores.get(cacheName)?.match(input);
        for (const cache of this.stores.values()) {
            const hit = await cache.match(input);
            if (hit) return hit;
        }
        return undefined;
    }

    paths(name) {
        return this.stores.get(name)?.paths() ?? [];
    }
}

/** 배포 하나 — index.html · 진입 청크 · 지연 청크(그 안의 지연 청크까지) · CSS · 글꼴. */
const buildOf = (id, { vendor = `/assets/vendor-react-${id}.js` } = {}) => {
    const files = {
        entry: `/assets/index-${id}.js`,
        vendor,
        css: `/assets/index-${id}.css`,
        lazy: `/assets/Codex-${id}.js`,
        nestedLazy: `/assets/CodexDetail-${id}.js`,
        font: `/assets/AetherFiraCode-${id}.woff2`,
    };
    const html = [
        '<!doctype html><html lang="ko"><head>',
        '<link rel="manifest" href="/manifest.webmanifest" />',
        '<link rel="icon" type="image/png" href="/icons/icon-192.png" />',
        `<script type="module" crossorigin src="${files.entry}"></script>`,
        `<link rel="modulepreload" crossorigin href="${files.vendor}">`,
        `<link rel="stylesheet" crossorigin href="${files.css}">`,
        '</head><body><div id="root"></div></body></html>',
    ].join('\n');
    const bodies = {
        [files.entry]: `import "./${files.vendor.slice(8)}";const __vite__mapDeps=["assets/Codex-${id}.js","assets/index-${id}.css"];const Codex=()=>import("./Codex-${id}.js");`,
        [files.vendor]: 'export const React = {};',
        [files.css]: `@font-face{font-family:"Aether Fira Code";src:url(/assets/AetherFiraCode-${id}.woff2) format("woff2")}`,
        [files.lazy]: `const Detail=()=>import("./CodexDetail-${id}.js");export default Detail;`,
        [files.nestedLazy]: 'export default function CodexDetail(){}',
        [files.font]: `font-${id}`,
    };
    return { id, files, html, bodies };
};

const typeOf = (pathname) => {
    if (pathname.endsWith('.js')) return 'text/javascript';
    if (pathname.endsWith('.css')) return 'text/css';
    if (pathname.endsWith('.woff2')) return 'font/woff2';
    if (pathname.endsWith('.png')) return 'image/png';
    return 'application/octet-stream';
};

/** Cloudflare Pages 같은 호스트 — 배포가 산출물을 통째로 바꾸고 없는 경로는 index.html(200)이다. */
const createNetwork = () => {
    let online = true;
    let build = null;
    const network = {
        deploy(next) {
            build = next;
        },
        setOnline(value) {
            online = value;
        },
        async fetch(input) {
            if (!online) throw new TypeError('Failed to fetch');
            const { pathname } = urlOf(input);
            if (pathname === '/manifest.webmanifest') return new Response('{}', { headers: { 'content-type': 'application/manifest+json' } });
            if (ART.includes(pathname)) return new Response(`art:${pathname}`, { headers: { 'content-type': 'image/png' } });
            if (build && pathname in build.bodies) return new Response(build.bodies[pathname], { headers: { 'content-type': typeOf(pathname) } });
            return new Response(build?.html ?? '', { headers: { 'content-type': 'text/html; charset=utf-8' } });
        },
    };
    return network;
};

/** 실제 sw.js를 vm에서 한 번 평가한 서비스 워커 인스턴스. */
const startServiceWorker = ({ network, caches }) => {
    const listeners = new Map();
    const self = {
        location: new URL(`${ORIGIN}/sw.js`),
        addEventListener: (type, listener) => listeners.set(type, [...(listeners.get(type) ?? []), listener]),
        skipWaiting: async () => undefined,
        clients: { claim: async () => undefined },
    };
    const context = vm.createContext({ self, caches, fetch: (input) => network.fetch(input), URL, Request, Response, Headers });
    vm.runInContext(SW_SOURCE, context, { filename: 'public/sw.js' });

    const dispatch = async (type, fields = {}) => {
        const lifetime = [];
        let responded = null;
        const event = {
            ...fields,
            waitUntil: (promise) => lifetime.push(Promise.resolve(promise)),
            respondWith: (promise) => {
                responded = Promise.resolve(promise);
            },
        };
        for (const listener of listeners.get(type) ?? []) listener(event);
        const response = responded ? await responded : undefined;
        while (lifetime.length > 0) await lifetime.shift();
        return response;
    };

    const navigateTo = (pathname) => dispatch('fetch', { request: { method: 'GET', url: `${ORIGIN}${pathname}`, mode: 'navigate' } });
    return {
        constant: (name) => vm.runInContext(name, context),
        install: () => dispatch('install'),
        activate: () => dispatch('activate'),
        navigate: () => navigateTo('/'),
        navigateTo,
        load: (pathname) => dispatch('fetch', { request: new Request(`${ORIGIN}${pathname}`) }),
    };
};

const startWorld = () => {
    const network = createNetwork();
    const caches = new FakeCacheStorage(network);
    return { network, caches };
};

/** 한 판 — 화면을 열고 진입 청크 · 스타일 · 글꼴, 그다음 기록 탭(지연 청크)과 그림을 받는다. */
const play = async (sw, build) => {
    const page = await sw.navigate();
    assert.equal(await page.text(), build.html);
    for (const pathname of [...Object.values(build.files), ...ART]) {
        const response = await sw.load(pathname);
        assert.ok(response.ok, `${pathname} 응답`);
    }
};

const SHELL = 'aetheria-shell-v4';
const ARTS = 'aetheria-art-v4';
const buildAssetsIn = (caches) => caches.paths(SHELL).filter((pathname) => /^\/assets\/[^/]+$/.test(pathname)).sort();
const filesOf = (build) => Object.values(build.files).sort();

/** 오프라인 재실행 — 화면 · 지금 빌드의 모든 산출물 · 본 그림이 저장본으로 나온다. */
const assertPlayableOffline = async (sw, network, build) => {
    network.setOnline(false);
    try {
        const page = await sw.navigate();
        assert.equal(await page.text(), build.html, '오프라인 화면은 저장된 index.html');
        for (const pathname of Object.values(build.files)) {
            const response = await sw.load(pathname);
            assert.ok(response?.ok, `오프라인에서 ${pathname}이 저장본으로 나와야 한다`);
            assert.equal(await response.text(), build.bodies[pathname]);
        }
        for (const pathname of ART) {
            const response = await sw.load(pathname);
            assert.ok(response?.ok, `오프라인에서 그림 ${pathname}이 저장본으로 나와야 한다`);
        }
    } finally {
        network.setOnline(true);
    }
};

test('배포를 다섯 번 거쳐도 캐시의 빌드 산출물은 지금 빌드의 것뿐이고 오프라인 재실행은 그대로 돈다', async () => {
    const { network, caches } = startWorld();
    const sw = startServiceWorker({ network, caches });
    let build = buildOf('a1');
    network.deploy(build);
    await sw.install();
    await sw.activate();
    await play(sw, build);
    assert.deepEqual(buildAssetsIn(caches), filesOf(build));

    for (const id of ['b2', 'c3', 'd4', 'e5']) {
        build = buildOf(id);
        network.deploy(build);
        await play(sw, build);
        assert.deepEqual(buildAssetsIn(caches), filesOf(build), `${id} 배포 뒤 지난 빌드 산출물이 남지 않는다`);
    }
    assert.deepEqual(await caches.keys(), [SHELL, ARTS]);
    assert.deepEqual(caches.paths(ARTS).sort(), [...ART].sort(), '그림은 배포를 넘어 남는다');
    await assertPlayableOffline(sw, network, build);
});

test('같은 빌드를 다시 열면 아무것도 지우지 않는다 — 지연 청크 · 글꼴이 남는다', async () => {
    const { network, caches } = startWorld();
    const sw = startServiceWorker({ network, caches });
    const build = buildOf('a1');
    network.deploy(build);
    await sw.install();
    await sw.activate();
    await play(sw, build);
    await sw.navigate();
    await sw.navigate();
    assert.deepEqual(buildAssetsIn(caches), filesOf(build));
    await assertPlayableOffline(sw, network, build);
});

test('배포 사이에 바뀌지 않은 청크(같은 해시 이름)는 지우지 않는다', async () => {
    const { network, caches } = startWorld();
    const sw = startServiceWorker({ network, caches });
    const first = buildOf('a1', { vendor: '/assets/vendor-react-stable.js' });
    network.deploy(first);
    await sw.install();
    await sw.activate();
    await play(sw, first);

    const next = buildOf('b2', { vendor: '/assets/vendor-react-stable.js' });
    network.deploy(next);
    await sw.navigate();
    assert.deepEqual(buildAssetsIn(caches), ['/assets/vendor-react-stable.js'], '새 index.html을 받은 순간 남는 것은 공유 청크뿐');
    await play(sw, next);
    await assertPlayableOffline(sw, network, next);
});

test('서비스 워커가 바뀌어(같은 캐시 이름) 다시 activate해도 지금 빌드의 지연 청크 · 글꼴은 남는다', async () => {
    const { network, caches } = startWorld();
    const build = buildOf('a1');
    network.deploy(build);
    const first = startServiceWorker({ network, caches });
    await first.install();
    await first.activate();
    await play(first, build);

    const updated = startServiceWorker({ network, caches });
    await updated.install();
    await updated.activate();
    assert.deepEqual(buildAssetsIn(caches), filesOf(build));
    await assertPlayableOffline(updated, network, build);
});

test('이전 판 캐시(aetheria-rpg-v3)는 activate가 지금 빌드 · 그림만 옮긴 뒤 지운다', async () => {
    const { network, caches } = startWorld();
    const stale = buildOf('z0');
    const current = buildOf('a1');
    const legacy = await caches.open(LEGACY_CACHE);
    const html = (body) => new Response(body, { headers: { 'content-type': 'text/html' } });
    await legacy.put(`${ORIGIN}/`, html(stale.html));
    await legacy.put(`${ORIGIN}/index.html`, html(stale.html));
    for (const build of [stale, current]) {
        for (const [pathname, body] of Object.entries(build.bodies)) {
            await legacy.put(`${ORIGIN}${pathname}`, new Response(body, { headers: { 'content-type': typeOf(pathname) } }));
        }
    }
    // 이전 판은 응답 종류를 보지 않고 저장했다 — 지워진 청크 경로에 SPA 폴백 HTML이 들어 있을 수 있다.
    await legacy.put(`${ORIGIN}/assets/Gone-z0.js`, html(stale.html));
    for (const pathname of ART) await legacy.put(`${ORIGIN}${pathname}`, new Response(`art:${pathname}`, { headers: { 'content-type': 'image/png' } }));

    network.deploy(current);
    const sw = startServiceWorker({ network, caches });
    await sw.install();
    await sw.activate();

    assert.deepEqual(await caches.keys(), [SHELL, ARTS], '이전 판 캐시는 지워진다');
    assert.deepEqual(buildAssetsIn(caches), filesOf(current), '지난 빌드 · 폴백 HTML은 옮기지 않는다');
    assert.deepEqual(caches.paths(ARTS).sort(), [...ART].sort());
    // 옮긴 지연 청크 · 그림은 다시 받지 않아도 오프라인에서 나온다.
    await assertPlayableOffline(sw, network, current);
});

test('HTML이 아닌 주소를 탭에서 직접 열어도 오프라인 화면 · 빌드 산출물은 그대로다', async () => {
    const { network, caches } = startWorld();
    const sw = startServiceWorker({ network, caches });
    const build = buildOf('a1');
    network.deploy(build);
    await sw.install();
    await sw.activate();
    await play(sw, build);

    // 매니페스트 · 그림 주소로의 탐색 — 응답은 그대로 넘기되 화면(index.html)으로 저장하지 않는다.
    for (const pathname of ['/manifest.webmanifest', ART[0]]) {
        const response = await sw.navigateTo(pathname);
        assert.ok(response.ok, `${pathname} 응답`);
        assert.doesNotMatch(response.headers.get('content-type'), /text\/html/, pathname);
        assert.deepEqual(buildAssetsIn(caches), filesOf(build), `${pathname}: 지금 빌드 산출물이 지워지지 않는다`);
    }
    await assertPlayableOffline(sw, network, build);
});

test('public/assets 바로 아래에는 파일이 없다 — 그 자리는 빌드 산출물의 자리라 sw.js가 정리한다', async () => {
    const entries = await readdir(new URL('../public/assets/', import.meta.url), { withFileTypes: true });
    const files = entries.filter((entry) => !entry.isDirectory()).map((entry) => entry.name);
    assert.deepEqual(files, [], 'public 그림은 /assets/<폴더>/ 아래에 둔다(SHELL_CACHE로 분류되면 배포마다 지워진다)');
});

test('정적 파일 경로에 온 SPA 폴백 HTML은 저장하지 않는다', async () => {
    const { network, caches } = startWorld();
    const sw = startServiceWorker({ network, caches });
    const build = buildOf('a1');
    network.deploy(build);
    await sw.install();
    await sw.activate();
    await sw.navigate();

    const missing = await sw.load('/assets/Codex-old999.js');
    assert.match(missing.headers.get('content-type'), /text\/html/, '호스트의 폴백 응답은 그대로 넘긴다');
    assert.ok(!caches.paths(SHELL).includes('/assets/Codex-old999.js'));
    const missingArt = await sw.load('/assets/monsters/catalog/monster-gone.png');
    assert.ok(missingArt.ok);
    assert.ok(!caches.paths(ARTS).includes('/assets/monsters/catalog/monster-gone.png'));
});

test('그림 캐시는 상한을 넘지 않고, 오래 갱신되지 않은 것부터 자른다', async () => {
    const { network, caches } = startWorld();
    const sw = startServiceWorker({ network, caches });
    const limit = sw.constant('ART_CACHE_MAX_ENTRIES');
    network.deploy(buildOf('a1'));
    await sw.install();
    await sw.activate();

    const arts = await caches.open(ARTS);
    const stalePaths = Array.from({ length: limit + 5 }, (_, index) => `/assets/monsters/authored/v1/old-${index}.png`);
    for (const pathname of stalePaths) await arts.put(`${ORIGIN}${pathname}`, new Response('x', { headers: { 'content-type': 'image/png' } }));
    await sw.load(ART[0]);

    network.deploy(buildOf('b2'));
    await sw.navigate();
    const kept = caches.paths(ARTS);
    assert.equal(kept.length, limit);
    assert.ok(kept.includes(ART[0]), '방금 받은 그림은 남는다');
    assert.ok(stalePaths.slice(0, 6).every((pathname) => !kept.includes(pathname)), '가장 오래된 것부터 지운다');
});

test('그림 캐시 상한은 public/의 정적 파일 전부보다 크다 — 한 판에서 본 그림을 오프라인에서 잃지 않는다', async () => {
    const { network, caches } = startWorld();
    const limit = startServiceWorker({ network, caches }).constant('ART_CACHE_MAX_ENTRIES');
    const entries = await readdir(new URL('../public/', import.meta.url), { recursive: true, withFileTypes: true });
    const staticFiles = entries.filter((entry) => entry.isFile()
        && entry.name !== 'sw.js'
        && /\.(?:js|css|svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/.test(entry.name));
    assert.ok(staticFiles.length > 100, `public/ 정적 파일 수 측정(${staticFiles.length})`);
    assert.ok(limit > staticFiles.length, `상한 ${limit} > public/ 정적 파일 ${staticFiles.length}`);
});

test('오프라인이고 저장된 화면이 없으면 네트워크 오류 응답이다(빈 화면을 지어내지 않는다)', async () => {
    const { network, caches } = startWorld();
    const sw = startServiceWorker({ network, caches });
    network.setOnline(false);
    const response = await sw.navigate();
    assert.equal(response.type, 'error');
});
