export default function PortalLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
      <div className="animate-pulse text-center">
        <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-700 rounded mx-auto mb-4" />
        <div className="h-4 w-64 bg-neutral-200 dark:bg-neutral-700 rounded mx-auto" />
      </div>
    </div>
  );
}
