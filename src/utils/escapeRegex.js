/**
 * Escapes a string for safe use inside a MongoDB $regex.
 */
export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
