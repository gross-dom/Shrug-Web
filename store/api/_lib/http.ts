// The few things every answer needs: JSON out, JSON in, and cookies.

export const json = (body: unknown, init: { status?: number; headers?: HeadersInit } = {}) =>
  new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...Object.fromEntries(new Headers(init.headers)) } })

/** The body of a request as an object, or an empty one where it is not JSON. */
export async function read(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function cookiesOf(request: Request): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const at = part.indexOf('=')
    if (at > 0) out[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim())
  }
  return out
}

/** A cookie only the server reads, sent only to this site and only over HTTPS. */
export const cookie = (name: string, value: string, maxAge: number) => `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`

export const text = (value: unknown, most = 200) => (typeof value === 'string' ? value.trim().slice(0, most) : '')
