import { getSupabaseClient, buildDedupeKey } from './lib/supabase.js';
import { classifyRole } from './lib/taxonomy.js';
import { collectAtsPostings } from './collectors/ats.js';
import { collectPageWatch } from './collectors/pageWatcher.js';
import { collectAdzunaPostings } from './collectors/adzuna.js';

const MAX_CONSECUTIVE_MISSES = 2;

async function upsertPostings(supabase, company, rawPostings) {
  const seenKeys = new Set();
  for (const raw of rawPostings) {
    const category = classifyRole(raw.title);
    if (!category) continue;

    const dedupeKey = await buildDedupeKey({
      companyId: company.id,
      source: raw.source,
      roleTitle: raw.title,
      postingUrl: raw.url,
    });
    seenKeys.add(dedupeKey);

    const { error } = await supabase.from('hiring_signal_job_postings').upsert(
      {
        company_id: company.id,
        role_title: raw.title,
        role_category: category,
        source: raw.source,
        posting_url: raw.url ?? null,
        dedupe_key: dedupeKey,
        last_seen_at: new Date().toISOString(),
        is_active: true,
        miss_count: 0,
      },
      { onConflict: 'dedupe_key' }
    );
    if (error) console.warn(`[upsert] ${company.name} "${raw.title}": ${error.message}`);
  }
  return seenKeys;
}

async function markMissingAsStale(supabase, company, seenKeys) {
  const { data: activePostings, error } = await supabase
    .from('hiring_signal_job_postings')
    .select('id, dedupe_key, miss_count')
    .eq('company_id', company.id)
    .eq('is_active', true);
  if (error) {
    console.warn(`[stale-check] ${company.name}: ${error.message}`);
    return;
  }

  for (const posting of activePostings) {
    if (seenKeys.has(posting.dedupe_key)) continue; // still present this run

    const nextMissCount = posting.miss_count + 1;
    const shouldDeactivate = nextMissCount >= MAX_CONSECUTIVE_MISSES;

    const { error: updateErr } = await supabase
      .from('hiring_signal_job_postings')
      .update({
        miss_count: nextMissCount,
        is_active: !shouldDeactivate,
      })
      .eq('id', posting.id);
    if (updateErr) console.warn(`[stale-update] ${company.name}: ${updateErr.message}`);
  }
}

async function runCompany(supabase, company) {
  const [atsPostings, pageWatch] = await Promise.all([
    collectAtsPostings(company),
    (async () => {
      const { data: state } = await supabase
        .from('hiring_signal_page_watch_state')
        .select('content_hash')
        .eq('company_id', company.id)
        .maybeSingle();
      const result = await collectPageWatch(company, state?.content_hash);
      if (result) {
        await supabase
          .from('hiring_signal_page_watch_state')
          .upsert({ company_id: company.id, content_hash: result.contentHash, checked_at: new Date().toISOString() });
      }
      return result;
    })(),
  ]);

  const rawPostings = [...atsPostings, ...(pageWatch?.postings ?? [])];
  return { company, rawPostings };
}

async function main() {
  const supabase = getSupabaseClient();

  const { data: companies, error } = await supabase.from('hiring_signal_companies').select('*');
  if (error) throw error;
  if (!companies?.length) {
    console.log('[run] no companies in target list yet — run discovery first.');
    return;
  }

  const adzunaByCompanyId = await collectAdzunaPostings(companies);

  let totalActive = 0;
  for (const company of companies) {
    const { rawPostings } = await runCompany(supabase, company);
    const combined = [...rawPostings, ...(adzunaByCompanyId.get(company.id) ?? [])];

    const seenKeys = await upsertPostings(supabase, company, combined);
    await markMissingAsStale(supabase, company, seenKeys);

    totalActive += seenKeys.size;
    console.log(`[run] ${company.name}: ${seenKeys.size} marketing postings seen this run.`);
  }

  console.log(`[run] done. ${totalActive} postings confirmed active across ${companies.length} companies.`);
}

main().catch((err) => {
  console.error('[run] fatal error:', err);
  process.exit(1);
});
