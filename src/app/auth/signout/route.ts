import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/api/session-cookie";

/** POST from a <form action="/auth/signout" method="post"> to sign out. */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
