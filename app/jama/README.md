Usage
-
1. Set `OPENALEX_API_KEY` in your server environment (e.g. `.env.local`):

```
OPENALEX_API_KEY=p7xkg2PfxGBxUEJPUo3cLL
```

2. Start Next.js dev server and open `/jama`.

Notes
-
- The server route `/api/jama/search` first finds the OpenAlex source for JAMA, then lists works filtered to that source. It uses `OPENALEX_API_KEY` (passed as `api_key` to OpenAlex API).
- Do not commit your real API key into source control.
