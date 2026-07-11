/** Shared guard for /api/cron/* — Vercel Cron sends Authorization: Bearer $CRON_SECRET. */
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret; // pg_cron / manual fallback
}
