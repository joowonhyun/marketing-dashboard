"use client";

import { useActionState } from "react";
import { loginAction } from "@/features/auth/services/actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 p-6"
      >
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          관리자 로그인
        </h1>

        <div className="space-y-1">
          <label htmlFor="email" className="text-sm text-slate-600 dark:text-slate-400">
            이메일
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-slate-600 dark:text-slate-400">
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>

        {state && !state.success && (
          <p className="text-sm text-red-600">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded bg-slate-900 dark:bg-slate-100 text-slate-50 dark:text-slate-900 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
