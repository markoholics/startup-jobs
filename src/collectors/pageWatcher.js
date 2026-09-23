import { classifyRole, isBangaloreLocation } from '../lib/taxonomy.js';
import { sha256Hex } from '../lib/supabase.js';

// Weekly-to-daily hash diff of a company's public careers page. This is a
// best-effort collector: it fetches the plain HTML (no headless browser, no
// auth, no bypassing anti-bot measures) and extracts anything that looks
// like a job title from heading/link text. Any company whose careers page
// is a JS-rendered SPA with no server-rendered titles will need a real ATS
// slug instead — that's expected and fine, the ATS collector is the primary
// source for those.

const TITLE_TAG_RE = /<(?:a|h[1-4]|li)[^>]*>([^<]{4,120})<\/(?:a|h[1-4]|li)>/gi;

function extractCandidateTitles(html) {
  const titles = new Set();
  let match;
  while ((match = TITLE_TAG_RE.exec(html))) {
    const text = match[1].replace(/&amp;/g, '&').trim();
    if (text.length >= 4) titles.add(text);
  }
  return [...titles];
}

/**
 * Fetch a company's careers page, hash it, and diff against the last known
 * hash (passed in as `previousHash`). Returns:
 *   - contentHash: the new hash to persist regardless of match outcome
 *   - changed: whether the page content differs from last check
 *   - postings: marketing-role titles found on the page (only meaningful
 *     when the caller wants to re-scan even on no change, e.g. first run)
 */
export async function collectPageWatch(company, previousHash) {
  if (!company.careers_url) return null;

  const res = await fetch(company.careers_url, {
    headers: { 'user-agent': 'bangalore-ai-hiring-signal/1.0 (+public page watcher)' },
  }).catch((err) => {
    console.warn(`[page-watch] ${company.name}: ${err.message}`);
    return null;
  });
  if (!res || !res.ok) return null;

  const html = await res.text();
  const contentHash = await sha256Hex(html);
  const changed = contentHash !== previousHash;

  const postings = extractCandidateTitles(html)
    .filter((title) => classifyRole(title))
    // Careers pages rarely state a location per role inline; treat the
    // whole page as Bangalore since it belongs to a Bangalore-HQ company.
    .filter(() => isBangaloreLocation('Bangalore'))
    .map((title) => ({ title, url: company.careers_url, source: 'page_watch' }));

  return { contentHash, changed, postings };
}
