## v1.5.1 Search Intelligence

See RELEASE-v1.5.1.txt.

# ChatClaud Search Upgrade — v1.4.0

## What was wrong

The earlier `runSearchPipeline` accepted options such as `maxSearchCalls`, `maxFetch`, and `maxResults`, but effectively made one Nova search request and formatted the returned snippets. The options did not control an adaptive multi-step retrieval path.

## New retrieval flow

1. **Query planning:** for explicit search requests, Groq can produce up to two non-redundant follow-up queries. If Groq is unavailable or returns invalid JSON, ChatClaud safely falls back to the original query.
2. **Parallel retrieval:** the selected queries are sent to Nova in parallel, with a hard cap on the number of search calls.
3. **Normalization:** URLs are canonicalized, tracking parameters are removed, private/local URLs are rejected, and duplicate URLs are merged.
4. **Relevance ranking:** title, snippet, URL-token coverage, and original search position contribute to a deterministic relevance score. A simple domain-diversity rule reduces repeated results from one host.
5. **Page fetching:** the highest-ranked safe URLs are fetched through Nova. Fetched body text is preferred over search snippets and bounded before it enters the model context.
6. **Evidence context:** each source carries its URL, title, domain, optional published date, fetched state, and bounded page text. The prompt explicitly labels retrieved web content as untrusted evidence, not instructions.

## Agent search

- The `search` tool accepts up to three model-selected focused queries.
- The new `delegate_research` tool can split research across up to three isolated retrieval workers with distinct roles/queries; their evidence is merged for the parent controller.
- Agent tools remain read-only and allowlisted. No shell, arbitrary code execution, or filesystem writes are available.

## What this is not

The ranking stage is a lightweight lexical heuristic, not a neural cross-encoder. Search breadth and fetch quality still depend on Nova's configured upstream providers. The pipeline does not guarantee that every source is authoritative or current; ChatClaud must evaluate dates and source quality in the answer.

## Optional future search backends

- [Firecrawl](https://github.com/firecrawl/firecrawl) is an optional second search index. When `FIRECRAWL_API_KEY` is configured on the backend, ChatClaud queries Firecrawl alongside Nova and merges its results. It is disabled by default; the key is never sent to the browser, and Firecrawl usage may be billable.
- [SearXNG](https://github.com/searxng/searxng) offers a self-hostable metasearch JSON API, but requires a reliable configured instance. Public instances often disable JSON output, so a random public instance is not used as a fallback.

Nova remains the required search gateway. Firecrawl is optional and requires no code change to enable once its key is configured on the backend. No new npm packages or required API keys are introduced.
