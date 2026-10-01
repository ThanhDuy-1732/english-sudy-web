// Supabase resolves failed requests with { error }; awaiting alone is not success.
export async function syncRequest<T extends { error?: unknown }>(request: PromiseLike<T>): Promise<T> {
  const result = await request;
  if (result.error) throw result.error;
  return result;
}
