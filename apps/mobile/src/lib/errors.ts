/** A message that is safe to show: the error's own message, or `fallback` for anything else. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
