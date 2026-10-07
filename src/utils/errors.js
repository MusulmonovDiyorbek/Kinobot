export function errorSummary(error) {
  const code = error?.code || error?.error_code || error?.name || 'Error';
  // Never log connection strings, bot tokens, raw HTTP requests or message contents.
  return { code, status: error?.status || null, retryAfter: error?.retryAfter || null };
}
export class UserError extends Error {}
