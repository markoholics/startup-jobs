// Live verification that a candidate company actually has a reachable
// careers page or ATS board, before it's added to the tracked list. Only
// runs for candidates that don't already ship a careers_url/ATS slug (e.g.
// the seed list is trusted as-is; imported ICP candidates are not).
// Must run somewhere with real internet access (GitHub Actions) — the
// sandbox this was written in has no outbound access to arbitrary domains.

const CAREERS_PATHS = [
  '/careers',
  '/careers/',
  '/jobs',
  '/jobs/',
  '/about/careers',
  '/company/careers',
  '/join-us',
  '/we-are-hiring',
];

const TIMEOUT_MS = 4000;

async function probeUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'bangalore-ai-hiring-signal/1.0 (+careers-page probe)' },
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Try to find a real, reachable careers URL or ATS board for a candidate.
 * Returns { careers_url, greenhouse_slug? , lever_slug? } on success, or
 * null if nothing reachable was found — callers should skip the candidate
 * entirely rather than guess.
 */
export async function probeCompany(domain, name) {
  const base = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  const slug = slugify(name);

  if (await probeUrl(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`)) {
    return { careers_url: `https://boards.greenhouse.io/${slug}`, greenhouse_slug: slug };
  }
  if (await probeUrl(`https://api.lever.co/v0/postings/${slug}?mode=json`)) {
    return { careers_url: `https://jobs.lever.co/${slug}`, lever_slug: slug };
  }
  for (const path of CAREERS_PATHS) {
    const url = `https://${base}${path}`;
    if (await probeUrl(url)) {
      return { careers_url: url };
    }
  }
  return null;
}
