export function normalizeTargetUrl(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
