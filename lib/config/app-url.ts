/**
 * Safe application URL resolver.
 *
 * In production, requires NEXT_PUBLIC_APP_URL to be set.
 * In development, falls back to http://localhost:3000.
 * Also checks APP_URL and VERCEL_URL as secondary options.
 */
export function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

  if (url) return url;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is not configured. ' +
      'Set it to your production domain (e.g., https://your-domain.com)'
    );
  }

  return 'http://localhost:3000';
}
