import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Optimistic gate only: redirects visitors with no session cookie away from
 * protected pages. The authoritative check is requireUser() on the server,
 * which validates the session against the database.
 */
export function middleware(req: NextRequest) {
  if (!req.cookies.has(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except public auth pages, API routes (they return 401 JSON
  // themselves), Next internals and static files.
  matcher: ["/((?!login|register|verify|api/|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
