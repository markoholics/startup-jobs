// Discovery sources for the target company list. Each source function
// returns an array of { name, domain, careers_url, source } candidates.
//
// Only the seed-list topper is wired up out of the box. The public-index
// connectors below (YourStory, Inc42, Wellfound/AngelList, NASSCOM AI
// directory) are stubbed with the request shape documented, but left
// unimplemented: none of them publish a stable public JSON API, so a real
// implementation means parsing their public search/listing pages and needs
// a compliance pass (robots.txt + ToS review) before it runs unattended in
// CI — same caution the build note calls out. Fill in `fetchFn` once that
// review is done; until then discovery falls back to the seed list, which
// keeps the pipeline useful without a half-compliant scraper.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SEED_PATH = fileURLToPath(new URL('../../data/companies.seed.json', import.meta.url));
const ICP_CANDIDATES_PATH = fileURLToPath(new URL('../../data/icp-candidates.json', import.meta.url));

export async function seedListSource() {
  const raw = await readFile(SEED_PATH, 'utf8');
  const companies = JSON.parse(raw);
  return companies.map((c) => ({ ...c, source: 'seed_list' }));
}

// Bangalore-HQ AI/ML/GenAI companies pulled from a Traxn client ICP export,
// filtered to confirmed-Indian + Bangalore + AI-signal companies. These
// ship with only a name + domain — no careers_url or ATS slug — so
// discovery must live-probe each one (see probeCareersUrl.js) before
// trusting it; a candidate with no reachable careers page is dropped
// rather than added with a guessed URL.
export async function icpCandidatesSource() {
  const raw = await readFile(ICP_CANDIDATES_PATH, 'utf8');
  const companies = JSON.parse(raw);
  return companies.map((c) => ({ ...c, source: 'icp_list' }));
}

// --- Stubs for future compliance-reviewed connectors ------------------
// Each should return [] on failure rather than throw, so one bad source
// never blocks the rest of discovery.

export async function yourStorySource() {
  // TODO: implement against YourStory's public company/startup directory
  // once page structure + robots.txt are reviewed.
  return [];
}

export async function inc42Source() {
  // TODO: implement against Inc42's public startup directory.
  return [];
}

export async function wellfoundSource() {
  // TODO: implement against Wellfound/AngelList's public Bangalore + AI
  // filtered company listing.
  return [];
}

export async function nasscomSource() {
  // TODO: implement against the NASSCOM AI directory.
  return [];
}

export const ALL_SOURCES = [
  seedListSource,
  icpCandidatesSource,
  yourStorySource,
  inc42Source,
  wellfoundSource,
  nasscomSource,
];
