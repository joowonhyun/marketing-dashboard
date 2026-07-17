export default function TableLoading() {
  return (
    <div className="w-full h-[400px] mt-8 flex flex-col items-center justify-center space-y-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-slate-900 dark:text-slate-100">
      <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin"></div>
      <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">
        캠페인 목록을 불러오는 중입니다.
      </p>
    </div>
  );
}
