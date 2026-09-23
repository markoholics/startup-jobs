// Temporary diagnostic endpoint — queries Supabase server-side with the same
// anon key the dashboard uses, so we can see the raw PostgREST response
// (status + body) without depending on browser network access. Delete once
// the empty-dashboard issue is resolved.
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  const query =
    `${url}/rest/v1/hiring_signal_job_postings` +
    `?select=role_title,role_category,is_active,hiring_signal_companies(name)&limit=5`;

  try {
    const r = await fetch(query, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    const body = await r.text();
    res.status(200).json({ requestedUrl: query, status: r.status, body });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
