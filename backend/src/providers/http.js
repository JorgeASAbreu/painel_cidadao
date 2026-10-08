export async function requestJson(url, { fetchImpl = fetch, timeoutMs = 9000 } = {}) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    const error = new Error(`O serviço respondeu com HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function sourceUrl(base, path, params = {}) {
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return url.toString();
}
