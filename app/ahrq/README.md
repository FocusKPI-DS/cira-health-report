# AHRQ page (data.gov)

This page queries Data.gov's CKAN catalog for datasets published by AHRQ (organization id `ahrq`).

Setup:

1. Add your API key to `.env.local` (optional, CKAN search usually works without a key, but if you want to provide it):

```
DATA_GOV_API_KEY=R70GEjxpPIvhI2EtiG7g7usCyhoBYqQt05UBJbbr
```

2. Start the dev server:

```powershell
npm install
npm run dev
```

3. Visit `http://localhost:3000/ahrq` to see the top AHRQ datasets. Use the search box to filter within AHRQ.

Notes:

- The server route at `/api/ahrq/search` proxies requests to `https://catalog.data.gov/api/3/action/package_search` and filters by `organization:ahrq`.
- If you want the route to include additional filters, modify `app/api/ahrq/search/route.ts` accordingly.
