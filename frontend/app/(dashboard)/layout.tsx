import { logoutAction } from "@/features/auth/services/actions";

interface DashboardLayoutProps {
  children: React.ReactNode;
  charts: React.ReactNode;
  table: React.ReactNode;
}

export default function DashboardLayout({
  children,
  charts,
  table,
}: DashboardLayoutProps) {
  return (
    <main className="container mx-auto px-4 py-8 space-y-8 flex-1 w-full max-w-7xl">
      <form action={logoutAction} className="flex justify-end">
        <button
          type="submit"
          className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          로그아웃
        </button>
      </form>

      {children}

      <div className="w-full">{charts}</div>
      <div className="w-full">{table}</div>
    </main>
  );
}
