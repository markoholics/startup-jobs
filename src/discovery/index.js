import { getSupabaseClient } from '../lib/supabase.js';
import { ALL_SOURCES } from './sources.js';

const TARGET_SIZE = 50;

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
  for (const candidate of candidates) {
    if (toInsert.length >= room) break;
    const nameKey = candidate.name.toLowerCase();
    const domainKey = normalizeDomain(candidate.domain);

    if (existingByName.has(nameKey)) continue; // never overwrite, manual or not
    if (domainKey && existingByDomain.has(domainKey)) continue;
    if (seenThisRun.has(nameKey)) continue;

    seenThisRun.add(nameKey);
    toInsert.push({
      name: candidate.name,
      domain: candidate.domain ?? null,
      careers_url: candidate.careers_url ?? null,
      greenhouse_slug: candidate.greenhouse_slug ?? null,
      lever_slug: candidate.lever_slug ?? null,
      ashby_slug: candidate.ashby_slug ?? null,
      source: candidate.source ?? null,
      is_manual: false,
    });
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
