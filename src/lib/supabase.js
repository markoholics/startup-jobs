import { createClient } from '@supabase/supabase-js';

let client;

/**
 * Service-role client for collectors/discovery running in GitHub Actions.
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (never the anon key — writes
 * need to bypass RLS). Use the pooler connection string's project URL, not
 * the IPv6-only direct one.
 */
export function getSupabaseClient() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. See .env.example.'
    );
  }

  client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return client;
}

export async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(digest).toString('hex');
}

export function buildDedupeKey({ companyId, source, roleTitle, postingUrl }) {
  const parts = [companyId, source, roleTitle.trim().toLowerCase(), (postingUrl || '').trim()];
  return sha256Hex(parts.join('|'));
}
