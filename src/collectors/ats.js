import { classifyRole, isBangaloreLocation } from '../lib/taxonomy.js';

// Public, unauthenticated JSON endpoints — no scraping, no ToS issue.
// Reused pattern from the Signal Engine build.

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    if (res.status === 404) return null; // company has no board on this ATS
    throw new Error(`${url} -> HTTP ${res.status}`);
  }
  return res.json();
}

async function collectGreenhouse(company) {
  const slug = company.greenhouse_slug;
  if (!slug) return [];
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
  const data = await fetchJson(url).catch((err) => {
    console.warn(`[greenhouse] ${company.name}: ${err.message}`);
    return null;
  });
  if (!data?.jobs) return [];

  return data.jobs
    .filter((job) => isBangaloreLocation(job.location?.name))
    .map((job) => ({ title: job.title, url: job.absolute_url }))
    .filter((p) => classifyRole(p.title))
    .map((p) => ({ ...p, source: 'greenhouse' }));
}

async function collectLever(company) {
  const slug = company.lever_slug;
  if (!slug) return [];
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  const data = await fetchJson(url).catch((err) => {
    console.warn(`[lever] ${company.name}: ${err.message}`);
    return null;
  });
  if (!Array.isArray(data)) return [];

  return data
    .filter((job) => isBangaloreLocation(job.categories?.location))
    .map((job) => ({ title: job.text, url: job.hostedUrl }))
    .filter((p) => classifyRole(p.title))
    .map((p) => ({ ...p, source: 'lever' }));
}

async function collectAshby(company) {
  const slug = company.ashby_slug;
  if (!slug) return [];
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
  const data = await fetchJson(url).catch((err) => {
    console.warn(`[ashby] ${company.name}: ${err.message}`);
    return null;
  });
  if (!data?.jobs) return [];

  return data.jobs
    .filter((job) => isBangaloreLocation(job.location))
    .map((job) => ({ title: job.title, url: job.jobUrl }))
    .filter((p) => classifyRole(p.title))
    .map((p) => ({ ...p, source: 'ashby' }));
}

/**
 * Poll all configured ATS boards for one company.
 * Returns raw postings ({ title, url, source }) already filtered to
 * Bangalore + marketing-role keywords. Category classification and
 * dedupe/upsert happen in the orchestrator.
 */
export async function collectAtsPostings(company) {
  const [gh, lever, ashby] = await Promise.all([
    collectGreenhouse(company),
    collectLever(company),
    collectAshby(company),
  ]);
  return [...gh, ...lever, ...ashby];
}
