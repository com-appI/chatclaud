'use strict';

// Cache only same-origin static app files. API requests are never cached.
const CACHE = 'chatclaud-static-v45';
const scopeUrl = new URL(self.registration.scope);
const CORE_FILES = [
  '',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'chatclaud-avatar-transparent.png',
].map((file) => new URL(file, scopeUrl).toString());

function isInScope(url) {
  return url.origin === scopeUrl.origin && url.pathname.startsWith(scopeUrl.pathname);
}

function isApiRequest(url) {
  const relativePath = url.pathname.slice(scopeUrl.pathname.length);
  return relativePath === 'api' || relativePath.startsWith('api/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(CORE_FILES))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('chatclaud-static-') && key !== CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isInScope(url) || isApiRequest(url)) return;

  // HTML is network-first so a deployment is picked up immediately.
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === scopeUrl.pathname) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response && response.ok) await cache.put(request, response.clone());
        return response;
      } catch (error) {
        return (await cache.match(request)) || (await cache.match(new URL('index.html', scopeUrl).toString()));
      }
    })());
    return;
  }

  // Static assets are stale-while-revalidate.
  const cachePromise = caches.open(CACHE);
  const refreshPromise = cachePromise.then(async (cache) => {
    try {
      const response = await fetch(request);
      if (response && response.ok) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      return null;
    }
  });

  // Register both promises synchronously while the fetch event is active.
  event.waitUntil(refreshPromise.then(() => undefined));
  event.respondWith(
    cachePromise
      .then((cache) => cache.match(request))
      .then((cached) => cached || refreshPromise.then((response) => response || Response.error()))
  );
});
