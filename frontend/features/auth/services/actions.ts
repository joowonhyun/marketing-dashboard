"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE_URL } from "@/shared/constants/api";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE,
} from "@/shared/constants/auth";

type LoginState = { success: true } | { success: false; message: string };

async function performLogin(email: string, password: string): Promise<LoginState> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return {
      success: false,
      message: body?.message ?? "로그인에 실패했습니다.",
    };
  }

  const { accessToken, refreshToken } = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };

  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/",
  });
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: "/",
  });

  redirect("/");
}

export async function loginAction(
  _prevState: LoginState | null,
  formData: FormData,
): Promise<LoginState> {
  return performLogin(String(formData.get("email")), String(formData.get("password")));
}

// 포트폴리오 데모용 원클릭 로그인 — 리뷰어가 계정 정보를 몰라도 바로 체험할 수 있게 함.
export async function demoLoginAction(): Promise<void> {
  await performLogin(
    process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? "",
    process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD ?? "",
  );
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
  redirect("/login");
}
