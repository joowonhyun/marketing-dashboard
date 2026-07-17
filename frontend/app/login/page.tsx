"use client";

import { useActionState } from "react";
import { loginAction, demoLoginAction } from "@/features/auth/services/actions";
import ThemeToggle from "@/shared/components/layout/ThemeToggle";

const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL;
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD;

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 dark:border-slate-800 p-6"
      >
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          관리자 로그인
        </h1>

        {DEMO_EMAIL && DEMO_PASSWORD && (
          <>
            <button
              type="submit"
              formAction={demoLoginAction}
              formNoValidate
              className="w-full rounded bg-blue-600 hover:bg-blue-700 text-white py-2 text-sm font-medium cursor-pointer"
            >
              데모 계정으로 로그인
            </button>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              {DEMO_EMAIL} / {DEMO_PASSWORD}
            </p>

            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-400">또는 직접 입력</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>
          </>
        )}

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
