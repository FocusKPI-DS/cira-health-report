Usage
-
1. Set `ELS_API_KEY` in your server environment (e.g. `.env.local`):

```
ELS_API_KEY=your_elsevier_api_key_here
```

2. Start Next.js dev server and open `/lancet`.

Notes
-
- The server route `/api/lancet/search` proxies requests to Elsevier Scopus search and must run server-side (the API key is read from `process.env.ELS_API_KEY`).
- Do not commit your real API key into source control.
