import { cookies } from "next/headers";
import { API_BASE_URL } from "@/shared/constants/api";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
} from "@/shared/constants/auth";

type ApiErrorBody = { statusCode: number; message: string | string[] };

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const parseBody = async (res: Response) => {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
};

const throwIfError = async (res: Response) => {
  if (res.ok) return;
  const body = (await parseBody(res)) as ApiErrorBody | null;
  const message = Array.isArray(body?.message)
    ? body.message.join(", ")
    : (body?.message ?? `요청 실패 (${res.status})`);
  throw new ApiError(res.status, message);
};

const buildRequest = (
  path: string,
  token: string | null,
  options?: RequestInit,
): [string, RequestInit] => [
  `${API_BASE_URL}${path}`,
  {
    ...options,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  },
];

/**
 * RSC(Server Component)에서 사용. RSC는 쿠키를 쓸 수 없으므로 갱신을 시도하지
 * 않는다 — accessToken 최신 상태 보장은 proxy의 책임.
 */
export const serverFetch = async <T>(
  path: string,
  options?: RequestInit,
): Promise<T> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;

  const [url, init] = buildRequest(path, token, options);
  const res = await fetch(url, init);
  await throwIfError(res);
  return (await parseBody(res)) as T;
};

/**
 * Server Action에서 사용. Server Action은 쿠키를 쓸 수 있으므로, 401을 받으면
 * refreshToken으로 갱신을 시도하고 accessToken 쿠키를 새로 쓴 뒤 원 요청을 1회
 * 재시도한다. 갱신도 실패하면 두 쿠키를 지우고 원래 401 에러를 던진다.
 */
export const actionFetch = async <T>(
  path: string,
  options?: RequestInit,
): Promise<T> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;

  const [url, init] = buildRequest(path, token, options);
  const res = await fetch(url, init);

  if (res.status !== 401) {
    await throwIfError(res);
    return (await parseBody(res)) as T;
  }

  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    cookieStore.delete(ACCESS_TOKEN_COOKIE);
    cookieStore.delete(REFRESH_TOKEN_COOKIE);
    await throwIfError(res);
  }

  const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });

  if (!refreshRes.ok) {
    cookieStore.delete(ACCESS_TOKEN_COOKIE);
    cookieStore.delete(REFRESH_TOKEN_COOKIE);
    await throwIfError(res);
  }

  const { accessToken } = (await refreshRes.json()) as { accessToken: string };
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ACCESS_TOKEN_MAX_AGE,
    path: "/",
  });

  const [retryUrl, retryInit] = buildRequest(path, accessToken, options);
  const retryRes = await fetch(retryUrl, retryInit);
  await throwIfError(retryRes);
  return (await parseBody(retryRes)) as T;
};
