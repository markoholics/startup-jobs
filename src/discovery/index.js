import { getSupabaseClient } from '../lib/supabase.js';
import { ALL_SOURCES } from './sources.js';
import { probeCompany } from './probeCareersUrl.js';

// Bumped from 50 to make room for the Bangalore + AI candidates imported
// from the Traxn ICP list, on top of the original 50-company seed. Not a
// hard ceiling on quality — see probeCompany below, which still drops any
// candidate with no verifiable careers page regardless of how much room
// is left under this cap.
const TARGET_SIZE = 200;

function normalizeDomain(domain) {
  if (!domain) return null;
  return domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

async function runDiscovery() {
  const supabase = getSupabaseClient();

  const { data: existing, error: fetchErr } = await supabase
    .from('hiring_signal_companies')
    .select('id, name, domain, is_manual');
  if (fetchErr) throw fetchErr;

  const existingByName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  const existingByDomain = new Map(
    existing.filter((c) => c.domain).map((c) => [normalizeDomain(c.domain), c])
  );

  let candidates = [];
  for (const source of ALL_SOURCES) {
    try {
      const found = await source();
      candidates = candidates.concat(found);
    } catch (err) {
      console.warn(`[discovery] source failed: ${err.message}`);
    }
  }

  const room = TARGET_SIZE - existing.length;
  if (room <= 0) {
    console.log(
      `[discovery] already at or above target size (${existing.length}/${TARGET_SIZE}); nothing to top up.`
    );
    return;
  }

  const toInsert = [];
  const seenThisRun = new Set();
  let skippedNoCareersPage = 0;

  for (const candidate of candidates) {
    if (toInsert.length >= room) break;
    const nameKey = candidate.name.toLowerCase();
    const domainKey = normalizeDomain(candidate.domain);

    if (existingByName.has(nameKey)) continue; // never overwrite, manual or not
    if (domainKey && existingByDomain.has(domainKey)) continue;
    if (seenThisRun.has(nameKey)) continue;

    let careersUrl = candidate.careers_url ?? null;
    let greenhouseSlug = candidate.greenhouse_slug ?? null;
    let leverSlug = candidate.lever_slug ?? null;

    // Only probe candidates that didn't already ship a trusted careers_url
    // or ATS slug (e.g. the hand-curated seed list). Candidates with no
    // verifiable careers page are dropped, never guessed.
    if (!careersUrl && !greenhouseSlug && !leverSlug && !candidate.ashby_slug) {
      const probed = await probeCompany(candidate.domain, candidate.name);
      if (!probed) {
        skippedNoCareersPage += 1;
        console.log(`[discovery] skipping ${candidate.name} — no reachable careers page found.`);
        continue;
      }
      careersUrl = probed.careers_url;
      greenhouseSlug = probed.greenhouse_slug ?? null;
      leverSlug = probed.lever_slug ?? null;
    }

    seenThisRun.add(nameKey);
    toInsert.push({
      name: candidate.name,
      domain: candidate.domain ?? null,
      careers_url: careersUrl,
      greenhouse_slug: greenhouseSlug,
      lever_slug: leverSlug,
      ashby_slug: candidate.ashby_slug ?? null,
      source: candidate.source ?? null,
      is_manual: false,
    });
  }

  if (skippedNoCareersPage > 0) {
    console.log(`[discovery] skipped ${skippedNoCareersPage} candidates with no verifiable careers page.`);
  }

  if (toInsert.length === 0) {
    console.log('[discovery] no new candidates to add this run.');
    return;
  }

  const { error: insertErr } = await supabase.from('hiring_signal_companies').insert(toInsert);
  if (insertErr) throw insertErr;

  console.log(
    `[discovery] added ${toInsert.length} companies (${existing.length + toInsert.length}/${TARGET_SIZE} total).`
  );
}

runDiscovery().catch((err) => {
  console.error('[discovery] fatal error:', err);
  process.exit(1);
});
