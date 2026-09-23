import { classifyRole } from '../lib/taxonomy.js';

// Adzuna free-tier aggregator, scoped to India + Bangalore + marketing
// keywords. Requires ADZUNA_APP_ID / ADZUNA_APP_KEY (free signup at
// developer.adzuna.com). This covers postings the ATS/page-watcher pair
// misses, but results aren't tied to a company_id out of the box — we match
// each result's employer name against our companies table by normalized
// substring and skip anything that doesn't match a known company.

const SEARCH_TERMS = [
  'growth marketing',
  'product marketing',
  'go-to-market',
  'digital marketing',
  'performance marketing',
  'social media marketing',
  'marketing manager',
];

function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function searchOneTerm(term, page = 1) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/in/search/${page}`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('where', 'Bangalore');
  url.searchParams.set('what_phrase', term);
  url.searchParams.set('results_per_page', '50');
  url.searchParams.set('content-type', 'application/json');

  const res = await fetch(url).catch((err) => {
    console.warn(`[adzuna] "${term}": ${err.message}`);
    return null;
  });
  if (!res || !res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

/**
 * Query Adzuna for all marketing search terms and match results against the
 * known companies list by normalized employer name. Returns a map of
 * companyId -> postings ({ title, url, source }).
 */
export async function collectAdzunaPostings(companies) {
  const byNormalizedName = new Map(companies.map((c) => [normalize(c.name), c]));

  const resultsByTerm = await Promise.all(SEARCH_TERMS.map((term) => searchOneTerm(term)));
  const allResults = resultsByTerm.flat();

  const postingsByCompany = new Map();
  for (const job of allResults) {
    const employer = job.company?.display_name;
    const company = byNormalizedName.get(normalize(employer));
    if (!company) continue; // not one of our 50 target companies

    const title = job.title;
    if (!classifyRole(title)) continue;

    const list = postingsByCompany.get(company.id) || [];
    list.push({ title, url: job.redirect_url, source: 'adzuna' });
    postingsByCompany.set(company.id, list);
  }
  return postingsByCompany;
}
