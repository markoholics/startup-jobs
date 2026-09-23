# Bangalore AI Hiring Signal

Daily watcher that tracks marketing-role hiring at ~50 Bangalore-HQ AI/ML/GenAI
startups and writes results to Supabase for an external dashboard. Adapted
from the Signal Engine architecture — the scoring engine is dropped, only the
collector-plus-database pattern is kept.

## How it works

1. **Weekly discovery** (`npm run discover`, Monday cron) tops up the
   `companies` table toward a target of 50 rows. It never overwrites or
   removes existing rows — manual entries and previously discovered
   companies are left alone. Currently sourced from `data/companies.seed.json`;
   the public-index connectors (YourStory, Inc42, Wellfound, NASSCOM) are
   stubbed in `src/discovery/sources.js` pending a compliance pass on each
   site's terms/robots.txt.
2. **Daily collection** (`npm run collect`, daily cron) runs three collectors
   per company and upserts marketing-role postings into `job_postings`:
   - **ATS poll** (`src/collectors/ats.js`) — public Greenhouse/Lever/Ashby
     JSON endpoints, filtered to Bangalore + role keywords.
   - **Page watcher** (`src/collectors/pageWatcher.js`) — hashes each
     company's public careers page and extracts candidate titles; used for
     companies with no formal ATS.
   - **Adzuna aggregator** (`src/collectors/adzuna.js`) — free-tier job API,
     queried by keyword + Bangalore, results matched back to our company
     list by name.
3. A posting's `dedupe_key` (hash of company + source + title + URL) makes
   re-runs idempotent. A posting flips `is_active = false` after two
   consecutive daily runs fail to re-find it.
4. The **dashboard** (`dashboard/index.html`) is a static page that reads
   directly from Supabase with the anon key (read-only via RLS) — no
   scoring, just a filterable table: company, role, category, source, first
   seen, active/inactive.

## Role taxonomy

Loose keyword match against posting titles (see `src/lib/taxonomy.js`),
since early-stage titles vary ("Founding Marketer", "Growth Ninja"):

| Category | Match keywords |
|---|---|
| Growth marketing | growth marketing, growth lead, growth manager, growth hacker |
| Product marketing | product marketing, PMM |
| GTM | go-to-market, GTM lead, GTM manager |
| Digital marketing | digital marketing, performance marketing, paid media, SEO, SEM |
| Social media marketing | social media, community manager, content creator |
| Related | content marketing, brand marketing, demand generation, marketing ops, CRM marketing, email marketing, generic "marketing manager" |

## Setup

Reuses the existing Signal Engine repo's Supabase project and hosting stack —
no new project needed.

1. **Database**: run `supabase/schema.sql` against the Signal Engine Supabase
   project (SQL editor, or `supabase db push`). It only adds `companies`,
   `job_postings`, and `page_watch_state` — nothing in the existing schema is
   touched.
2. **GitHub Actions secrets** (repo Settings → Secrets and variables →
   Actions): `SUPABASE_URL` (pooler connection string's project URL, not the
   IPv6-only direct one), `SUPABASE_SERVICE_ROLE_KEY`, and optionally
   `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`.
   - No `@` in the database password.
   - Add workflow files via GitHub's "Create new file" box, not drag-upload —
     drag-upload silently drops the `.github` directory.
3. **First run**: trigger both workflows manually once via *Run workflow* —
   run discovery first to populate `companies`, then collection. Always use
   *Run workflow* after editing a workflow file; re-running a stale run
   replays the old snapshot instead of the edit.
4. **Dashboard**: copy `dashboard/config.example.js` to `dashboard/config.js`,
   fill in the Supabase project URL and anon key (safe to expose — RLS grants
   SELECT only), then deploy the `dashboard/` folder to Vercel as a static
   site.

Local run:

```bash
npm install
cp .env.example .env   # fill in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
npm run discover
npm run collect
```

## Boundaries & traps

- Public sources only — no vulnerability probing, no LinkedIn/Naukri/
  IIMJobs/Glassdoor/Indeed scraping (ToS-prohibited; Indeed's public API was
  discontinued years ago). Adzuna is the licensed substitute, at the cost of
  weaker Naukri/IIMJobs-only coverage.
- Supabase pooler connection string, not the IPv6-only direct one; no `@` in
  the database password.
- Scheduled GitHub Actions workflows go dormant after 60 days of repo
  inactivity; Supabase pauses free projects after about a week idle.
- Slug probing will miss early-stage startups with no formal ATS — their
  roles live only on LinkedIn/Twitter, which stays off-limits, so they'll
  show zero postings here even while actively hiring.
- "AI startup" tags in public indexes have false positives (AI in the name,
  not the product) — review discovery output before trusting it.
- Marketing titles at startups are inconsistent ("Founding Marketer" spans
  GTM, growth, and content at once) — keyword matching needs loose patterns
  and occasional manual review, not a strict taxonomy.

## Repo layout

```
supabase/schema.sql       companies, job_postings, page_watch_state tables + RLS
data/companies.seed.json  bootstrap target list (discovery tops this up)
src/lib/                  taxonomy + Supabase client helpers
src/collectors/           ats.js, pageWatcher.js, adzuna.js
src/discovery/            weekly company-list top-up
src/run.js                daily collection orchestrator
dashboard/                static page reading Supabase, deployed to Vercel
.github/workflows/        daily-collect.yml, weekly-discovery.yml
```
