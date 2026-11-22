/**
 * Supabase returns the *existing* channel when two components ask for the same name, and adding
 * listeners to an already-subscribed channel throws. Every subscription therefore gets its own name.
 */
let seq = 0;
export function uniqueChannel(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}
