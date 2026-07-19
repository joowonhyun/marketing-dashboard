import { NextRequest, NextResponse } from "next/server";
import { API_BASE_URL } from "@/shared/constants/api";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
} from "@/shared/constants/auth";

const LOGIN_PATH = "/login";

const tryRefresh = async (refreshToken: string): Promise<string | null> => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const { accessToken } = (await res.json()) as { accessToken: string };
    return accessToken ?? null;
  } catch {
    return null;
  }
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname.startsWith(LOGIN_PATH);

  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  // 이미 인증된 상태로 /login 접근 → 대시보드로
  if (isLoginPage && (accessToken || refreshToken)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (isLoginPage) return NextResponse.next();

  if (accessToken) return NextResponse.next();

  if (refreshToken) {
    const newAccessToken = await tryRefresh(refreshToken);
    if (newAccessToken) {
      const res = NextResponse.next();
      res.cookies.set(ACCESS_TOKEN_COOKIE, newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ACCESS_TOKEN_MAX_AGE,
        path: "/",
      });
      return res;
    }
  }

  const loginUrl = new URL(LOGIN_PATH, req.url);
  loginUrl.searchParams.set("redirectTo", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
