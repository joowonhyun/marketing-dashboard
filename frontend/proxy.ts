import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { API_BASE_URL } from "@/shared/constants/api";
import {
  ACCESS_COOKIE_OPTIONS,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/shared/constants/auth";

const LOGIN_PATH = "/login";

type RefreshResult = { token: string | null; status: number | null };

/**
 * refresh 시도 결과. status는 백엔드 응답 코드(네트워크 오류면 null).
 * 401(명시적 거부)과 5xx/네트워크 오류를 구분해야 쿠키를 지울지 판단할 수 있다.
 */
const tryRefresh = async (refreshToken: string): Promise<RefreshResult> => {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return { token: null, status: res.status };

    const { accessToken } = (await res.json()) as { accessToken: string };
    return { token: accessToken ?? null, status: res.status };
  } catch {
    return { token: null, status: null };
  }
};

const loginUrlWithRedirect = (req: NextRequest) => {
  const loginUrl = new URL(LOGIN_PATH, req.url);
  // searchParams.set이 인코딩을 담당한다. encodeURIComponent를 쓰면 이중 인코딩.
  loginUrl.searchParams.set(
    "redirectTo",
    req.nextUrl.pathname + req.nextUrl.search,
  );
  return loginUrl;
};

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname.startsWith(LOGIN_PATH);

  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  // 1) 인증 유효성을 먼저 확정한다.
  //    "쿠키 존재"로 분기하면 폐기된 refreshToken이 남아 있을 때 /login이 홈으로
  //    튕겨 로그인 자체가 불가능해진다(쿠키 자연 만료까지 잠김).
  let newAccessToken: string | null = null;
  let authed = !!accessToken;
  let refreshRejected = false; // 백엔드가 401로 명시 거부한 경우만 true

  if (!authed && refreshToken) {
    const result = await tryRefresh(refreshToken);
    newAccessToken = result.token;
    authed = !!newAccessToken;
    refreshRejected = result.status === 401;
  }

  // 2) 분기 — authed 기준
  const res = isLoginPage
    ? authed
      ? NextResponse.redirect(new URL("/", req.url))
      : NextResponse.next()
    : authed
      ? NextResponse.next()
      : NextResponse.redirect(loginUrlWithRedirect(req));

  // 3) 쿠키 정리
  if (newAccessToken) {
    res.cookies.set(ACCESS_TOKEN_COOKIE, newAccessToken, ACCESS_COOKIE_OPTIONS);
  }
  // 401로 명시 거부된 토큰만 삭제 (5xx·네트워크 오류는 일시 장애일 수 있으니 유지)
  if (refreshRejected) {
    res.cookies.delete(ACCESS_TOKEN_COOKIE);
    res.cookies.delete(REFRESH_TOKEN_COOKIE);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_vercel|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
