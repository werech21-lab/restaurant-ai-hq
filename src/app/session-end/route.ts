import { NextResponse } from "next/server";
import {
  EXEC_SESSION_COOKIE,
  execCookieOptions,
  isSecureRequest,
} from "@/lib/auth/exec-session";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function GET(request: Request) {
  const isSecure = isSecureRequest(request);
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
    headers: {
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Cache-Control": "no-store",
    },
  });
  response.cookies.set(EXEC_SESSION_COOKIE, "", {
    ...execCookieOptions(isSecure),
    maxAge: 0,
    path: "/",
  });
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions,
    secure: isSecure,
    maxAge: 0,
    path: "/",
  });
  return response;
}
