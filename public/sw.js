// Aetheria 서비스 워커 — 웹(PWA)에서만 등록된다(`allowsServiceWorker`, src/pwa/registerServiceWorker.ts).
//
// CH-07: 캐시가 배포마다 커지기만 했다. 캐시 이름이 하나(`aetheria-rpg-v3`)라 activate가 지울 것이
// 없었고, 해시 파일명인 빌드 산출물(JS · CSS · 글꼴)이 배포마다 새 키로 쌓였다. 이제 캐시를 둘로 나눈다.
// - SHELL_CACHE: index.html과 빌드 산출물. Vite는 산출물을 `/assets/` **바로 아래**에 해시 이름으로 낸다.
//   지금 빌드가 쓰는 산출물은 index.html에서 시작해 저장된 JS · CSS 본문이 파일 이름을 부르는 것을
//   따라가 정한다(진입 청크 → 지연 청크 · 글꼴). 그 밖의 산출물은 지난 빌드의 것이라 지운다 —
//   index.html만 보면 지연 청크(기록 탭 · 도감 …)와 글꼴까지 지워 오프라인 재실행이 깨진다.
//   지우는 때는 새 index.html을 처음 받았을 때와 activate다.
// - ART_CACHE: 그 밖의 정적 파일(public/ 그림 · 아이콘 — 그림은 `/assets/<폴더>/…` 하위 폴더에 있다).
//   배포를 넘어 남아 오프라인에서도 본 그림을 그린다. 그림 경로는 판이 바뀌면 바뀌므로(`authored/v1/` ·
//   내용 해시 이름) 항목 수 상한으로 오래 갱신되지 않은 것부터 자른다.
// 오프라인 플레이: 탐색은 네트워크 우선 → 실패하면 저장된 index.html, 정적 파일은 저장본 우선
// (stale-while-revalidate)이다. 이전 이름의 캐시는 activate가 내용을 새 캐시로 옮긴 뒤 지운다.
const SHELL_CACHE = 'aetheria-shell-v4';
const ART_CACHE = 'aetheria-art-v4';
const CURRENT_CACHES = [SHELL_CACHE, ART_CACHE];
const SHELL_KEY = '/index.html';
const APP_SHELL = [SHELL_KEY, '/manifest.webmanifest'];
// 그림 캐시 항목 상한 — public/의 정적 파일 전부(약 1,560개)가 들어가는 크기다
// (tests/service-worker-cache.test.js가 실제 파일 수보다 큰지 확인한다).
const ART_CACHE_MAX_ENTRIES = 2000;

// 앱 화면이 아닌 정적 페이지(처리방침). 화면(index.html)으로 저장하면 오프라인 실행이 그 페이지를 내고,
// 정리가 그 본문에서 빌드 산출물을 찾지 못해 전부 지운다 — 서비스 워커가 손대지 않는다.
const STATIC_PAGE_PREFIXES = ['/privacy'];
const isStaticPage = (pathname) => STATIC_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

const isStaticAsset = (pathname) => /\.(?:js|css|svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/.test(pathname);
// Vite 빌드 산출물만 `/assets/` 바로 아래에 있다(public 그림은 모두 하위 폴더).
const isBuildAsset = (pathname) => /^\/assets\/[^/]+$/.test(pathname);
const isBuildText = (pathname) => /\.(?:js|css)$/.test(pathname);
const cacheNameFor = (pathname) => (isBuildAsset(pathname) ? SHELL_CACHE : ART_CACHE);
const fileNameOf = (pathname) => pathname.slice(pathname.lastIndexOf('/') + 1);

const isHtmlResponse = (response) => (response.headers.get('content-type') || '').toLowerCase().startsWith('text/html');

// 정적 파일 경로에 HTML이 오면(호스트의 SPA 폴백 — 지워진 옛 청크 요청) 저장하지 않는다.
const isCacheableAsset = (response) => Boolean(response) && response.ok && !isHtmlResponse(response);

// 리다이렉트를 거친 응답은 탐색 요청에 그대로 돌려줄 수 없다(redirect mode 'manual').
const asNavigationResponse = (response) => (response.redirected
  ? new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers })
  : response);

/** SHELL_CACHE에서 지금 index.html(`shellText`)이 닿지 않는 빌드 산출물을 지운다. */
const pruneBuildAssets = async (cache, shellText) => {
  const candidates = new Map();
  for (const request of await cache.keys()) {
    const { pathname } = new URL(request.url);
    if (isBuildAsset(pathname)) candidates.set(pathname, request);
  }
  const live = new Set();
  const pending = [shellText];
  while (pending.length > 0) {
    const text = pending.pop();
    for (const [pathname, request] of candidates) {
      if (live.has(pathname) || !text.includes(fileNameOf(pathname))) continue;
      live.add(pathname);
      if (!isBuildText(pathname)) continue;
      const response = await cache.match(request);
      if (response) pending.push(await response.text());
    }
  }
  await Promise.all([...candidates]
    .filter(([pathname]) => !live.has(pathname))
    .map(([, request]) => cache.delete(request)));
};

/** 그림 캐시를 상한까지 자른다 — 목록 앞(오래 갱신되지 않은 것)부터 지운다. */
const trimArtCache = async () => {
  const cache = await caches.open(ART_CACHE);
  const requests = await cache.keys();
  const excess = requests.length - ART_CACHE_MAX_ENTRIES;
  if (excess <= 0) return;
  await Promise.all(requests.slice(0, excess).map((request) => cache.delete(request)));
};

/** 저장된 index.html이 닿는 빌드만 남긴다. */
const settleShell = async () => {
  const cache = await caches.open(SHELL_CACHE);
  const shell = await cache.match(SHELL_KEY);
  if (shell) await pruneBuildAssets(cache, await shell.text());
};

/** 새로 받은 index.html을 저장한다. 내용이 바뀌었으면(새 배포) 지난 빌드 산출물을 지운다. */
const refreshShell = async (response) => {
  const cache = await caches.open(SHELL_CACHE);
  const nextText = await response.clone().text();
  const previous = await cache.match(SHELL_KEY);
  const changed = !previous || (await previous.text()) !== nextText;
  await cache.put(SHELL_KEY, response);
  if (!changed) return;
  await pruneBuildAssets(cache, nextText);
  await trimArtCache();
};

/** 이전 이름의 캐시 내용을 새 캐시로 옮긴다 — 업데이트 직후에도 오프라인에서 본 그림 · 지금 빌드를 쓴다. */
const migrateLegacyCache = async (name) => {
  const legacy = await caches.open(name);
  for (const request of await legacy.keys()) {
    const { origin, pathname } = new URL(request.url);
    if (origin !== self.location.origin || !isStaticAsset(pathname)) continue;
    const response = await legacy.match(request);
    if (!isCacheableAsset(response)) continue;
    const target = await caches.open(cacheNameFor(pathname));
    await target.put(request, response);
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    for (const name of names.filter((key) => !CURRENT_CACHES.includes(key))) {
      try {
        await migrateLegacyCache(name);
      } catch {
        // 옮기지 못한 항목은 다음 온라인 요청에서 다시 받는다.
      }
      await caches.delete(name);
    }
    await settleShell();
    await trimArtCache();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (isStaticPage(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        // 저장 · 정리는 화면을 기다리게 하지 않는다. 정리는 정리 시작 때 캐시에 있던 항목만
        // 지우므로, 그동안 새 빌드가 저장하는 청크는 지워지지 않는다.
        // HTML이 아닌 탐색(매니페스트 · 그림 주소를 탭에서 직접 연 경우)은 화면으로 저장하지 않는다 —
        // 저장하면 오프라인 실행이 그 본문을 화면으로 내고, 정리가 그 본문에서 산출물을 찾지 못해 전부 지운다.
        if (response.ok && isHtmlResponse(response)) {
          event.waitUntil(refreshShell(response.clone()).catch(() => undefined));
        }
        return response;
      } catch {
        const cached = await caches.match(SHELL_KEY, { cacheName: SHELL_CACHE });
        return cached ? asNavigationResponse(cached) : Response.error();
      }
    })());
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(caches.open(cacheNameFor(url.pathname)).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then(async (response) => {
          if (isCacheableAsset(response)) await cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      event.waitUntil(fetchPromise.then(() => undefined, () => undefined));
      return cached || fetchPromise;
    }));
  }
});
