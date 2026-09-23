// Copy to config.js (gitignored) for local preview, or set these as the
// literal values when deploying — the anon key is safe to expose publicly:
// RLS on the `companies` and `job_postings` tables only grants SELECT.
window.SUPABASE_CONFIG = {
  url: 'https://YOUR_PROJECT.supabase.co',
  anonKey: 'YOUR_ANON_KEY',
};
