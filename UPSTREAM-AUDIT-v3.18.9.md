# Upstream repository audit — ChatClaud 3.18.9

Reviewed the five archives supplied for this release. The application source remains based on the supplied ChatClaud 2.14.3 archive.

| Supplied repository | License / runtime notes | Release decision |
|---|---|---|
| ChatClaud 2.14.3 | Existing application; Node.js 18+, CommonJS | Used as the application baseline |
| Tavily JS SDK | MIT; SDK source uses Axios and additional transport dependencies | Reviewed for current REST behavior; native Node `fetch` is used instead so no SDK dependency is added |
| SearchSuite | MIT; package declares ESM and Node.js >=24 | Reviewed for provider behavior and normalization; not added because the app remains CommonJS and supports Node.js 18+ |
| Firecrawl | AGPL-3.0 | Not copied, bundled, imported, or added as a runtime dependency |
| SearXNG | AGPL-3.0 | Not copied, bundled, imported, or added as a runtime dependency |

## Provider contracts followed

- Serper: `POST https://google.serper.dev/search`, `X-API-KEY`, JSON body with `q` and `num`; SearchSuite's supplied provider adapter confirms this upstream endpoint and header.
- Tavily Search: `POST https://api.tavily.com/search`; the Tavily JS SDK's transport sends the key in `Authorization: Bearer ...` and the query parameters in JSON.
- Tavily Extract: `POST https://api.tavily.com/extract`; bearer-authenticated JSON request with public URLs and Markdown output.

The release does not copy source code from the upstream search repositories. It implements small provider adapters using the platform's existing `fetch` API and normalizes their output in ChatClaud.

## Why two search libraries were not installed

The Tavily JS SDK introduces Axios and other transport dependencies that are unnecessary for the narrow Search/Extract operations used here. SearchSuite declares Node.js >=24 and ESM-only packaging, while ChatClaud is CommonJS and targets Node.js >=18. Native `fetch` avoids changing the runtime floor or adding a dependency chain.

## Reproducibility and limits

The local tests mock upstream HTTP responses. No production API key was provided for live account tests. The exact behavior, limits, and charges depend on the user's Serper and Tavily plans. No upstream code archive is included in the application ZIP.
