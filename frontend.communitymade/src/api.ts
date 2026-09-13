export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
  });
  let body: any = null;
  try {
    body = await response.json();
  } catch {}
  if (!response.ok) {
    const error = new Error(
      body?.error?.message || `Request failed (${response.status})`
    );
    (error as any).status = response.status;
    (error as any).body = body;
    throw error;
  }
  return body;
}

export function imageUrl(upload: any, width = 1200): string {
  return `${upload.url}?width=${width}&format=webp`;
}
