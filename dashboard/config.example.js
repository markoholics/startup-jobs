// Copy to config.js (gitignored) for local preview. In Vercel, config.js is
// generated at build time by generate-config.js from SUPABASE_URL and
// SUPABASE_ANON_KEY env vars — the anon key is safe to expose publicly:
// RLS on hiring_signal_companies / hiring_signal_job_postings only grants
// SELECT.
window.SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_ANON_KEY',
};
