// Role taxonomy: loose keyword match against posting titles.
// Order matters — first category whose keywords match wins, so put the more
// specific categories before the catch-all "Related" bucket.
export const TAXONOMY = [
  {
    category: 'Growth marketing',
    keywords: ['growth marketing', 'growth lead', 'growth manager', 'growth hacker'],
  },
  {
    category: 'Product marketing',
    keywords: ['product marketing', 'pmm'],
  },
  {
    category: 'GTM',
    keywords: ['go-to-market', 'go to market', 'gtm lead', 'gtm manager', 'gtm'],
  },
  {
    category: 'Digital marketing',
    keywords: ['digital marketing', 'performance marketing', 'paid media', 'seo', 'sem'],
  },
  {
    category: 'Social media marketing',
    keywords: ['social media', 'community manager', 'content creator'],
  },
  {
    category: 'Related',
    keywords: [
      'content marketing',
      'brand marketing',
      'demand generation',
      'marketing ops',
      'marketing operations',
      'crm marketing',
      'email marketing',
      'marketing manager',
      'founding marketer',
      'growth ninja',
    ],
  },
];

/**
 * Classify a job title into a marketing role category.
 * Returns null when the title doesn't match any marketing keyword —
 * callers should skip non-matching postings entirely.
 */
export function classifyRole(title) {
  if (!title) return null;
  const normalized = title.toLowerCase();
  for (const { category, keywords } of TAXONOMY) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return category;
    }
  }
  return null;
}

const BANGALORE_ALIASES = ['bangalore', 'bengaluru', 'blr'];
const REMOTE_ALIASES = ['remote', 'anywhere', 'work from home', 'wfh'];

/**
 * Loose location filter: matches Bangalore explicitly, and (optionally)
 * remote postings from companies we already know are Bangalore-HQ — remote
 * marketing hires at a Bangalore startup are still a hiring signal.
 */
export function isBangaloreLocation(location, { includeRemote = true } = {}) {
  if (!location) return false;
  const normalized = location.toLowerCase();
  if (BANGALORE_ALIASES.some((a) => normalized.includes(a))) return true;
  if (includeRemote && REMOTE_ALIASES.some((a) => normalized.includes(a))) return true;
  return false;
}
