// Runs as the Vercel build command for this static dashboard. Writes
// config.js from env vars so the anon key never needs to be committed —
// it's safe to expose (RLS grants SELECT only), but this keeps it out of
// git history regardless.
import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars.');
  process.exit(1);
}

const contents = `window.SUPABASE_CONFIG = ${JSON.stringify({ url, anonKey }, null, 2)};\n`;
writeFileSync(new URL('./config.js', import.meta.url), contents);
console.log('Wrote dashboard/config.js from env vars.');
