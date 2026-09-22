function isPrivateOrLocalHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  ) {
    return true;
  }

  if (normalized.endsWith(".localhost")) {
    return true;
  }

  if (
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    normalized.startsWith("172.")
  ) {
    const parts = normalized.split(".").map(Number);
    if (normalized.startsWith("172.")) {
      return (
        parts.length === 4 &&
        parts[0] === 172 &&
        parts[1] >= 16 &&
        parts[1] <= 31
      );
    }
    return true;
  }

  return false;
}

function isPrivateOrLocalAddress(hostname: string): boolean {
  if (isPrivateOrLocalHost(hostname)) return true;

  if (hostname.startsWith("[") && hostname.includes("]")) {
    return hostname.includes("::1");
  }

  return false;
}

export function normalizeTargetUrl(value: string): string | null {
  const input = value.trim();
  if (!input) return null;

  const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    if (isPrivateOrLocalAddress(url.hostname)) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}
