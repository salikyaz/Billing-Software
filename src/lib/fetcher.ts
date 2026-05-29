/**
 * Thin fetch wrapper for client components. Throws an Error carrying the
 * server-provided message (from `{ error }`) when the response is not ok.
 */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json", ...(init?.headers ?? {}) }
        : init?.headers,
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error && typeof data.error === "string") message = data.error;
    } catch {
      // body was not JSON — keep default message
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  // Some endpoints may return empty body
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
