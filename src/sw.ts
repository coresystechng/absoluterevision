/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core"
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching"
import { registerRoute } from "workbox-routing"
import { CacheFirst } from "workbox-strategies"
import { ExpirationPlugin } from "workbox-expiration"
import { CacheableResponsePlugin } from "workbox-cacheable-response"
import { getNavigationDocument } from "./lib/service-worker-routes"

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Parameters<typeof precacheAndRoute>[0] }

// Keep clean-URL pricing precaching ahead of the explicit utility route.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
void self.skipWaiting()
clientsClaim()

registerRoute(
  ({ request, url, sameOrigin }) => request.mode === "navigate" && sameOrigin && Boolean(getNavigationDocument(url.pathname)),
  (options) => createHandlerBoundToURL(getNavigationDocument(options.url.pathname)!)(options),
)

registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/assets/") && url.pathname.endsWith(".js"),
  new CacheFirst({
    cacheName: "application-chunks",
    plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 }), new CacheableResponsePlugin({ statuses: [200] })],
  }),
)
