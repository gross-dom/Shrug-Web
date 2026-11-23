import { env } from './env.js'

// The one email the store sends for itself: the sign-in code. It goes through Resend.

export async function sendCode(to: string, code: string): Promise<boolean> {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resend}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.mailFrom,
      to: [to],
      subject: `${spaced} is your Shrug VIP code`,
      text: `Your code is ${spaced}.\n\nIt lasts ten minutes. If you didn't ask for it, ignore this: nothing happens without it.\n\nShrug VIP`,
      html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#0b0c10"><p>Your code is</p><p style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:0.08em;margin:8px 0 16px">${spaced}</p><p>It lasts ten minutes. If you didn&rsquo;t ask for it, ignore this: nothing happens without it.</p><p style="color:#6b6f76">Shrug VIP</p></div>`,
    }),
  })
  return res.ok
}
