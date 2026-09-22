import { NextRequest, NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const RATE_LIMITS = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return realIp ?? "unknown";
}

export function middleware(request: NextRequest) {
  const ip = getClientIp(request);
  const now = Date.now();
  const current = RATE_LIMITS.get(ip);

  if (!current || now >= current.resetAt) {
    RATE_LIMITS.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (current.count >= MAX_REQUESTS) {
    return new NextResponse(
      "Too many requests from this IP. Please try again later.",
      {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Retry-After": String(
            Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
          ),
        },
      },
    );
  }

  current.count += 1;
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
