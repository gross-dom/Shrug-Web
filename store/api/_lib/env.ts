// What the server is told from outside: the keys it works with. None is in the repository. They are set on
// the Vercel project (Settings → Environment Variables), and README.md says where each comes from.

const need = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export const env = {
  /** A personal access token for the Shrug base: data.records:read and data.records:write. */
  get airtable() {
    return need('AIRTABLE_TOKEN')
  },
  /** Any long random string: sessions are signed with it. Changing it signs everyone out. */
  get secret() {
    return need('SESSION_SECRET')
  },
  /** Resend, for the sign-in code. */
  get resend() {
    return need('RESEND_API_KEY')
  },
  /** Who the code is from: "Shrug <vip@a-domain-verified-in-resend>". */
  get mailFrom() {
    return need('MAIL_FROM')
  },
  /** Twilio, which texts the sign-in codes: the account's SID and its auth token. */
  get twilioSid() {
    return need('TWILIO_ACCOUNT_SID')
  },
  get twilioToken() {
    return need('TWILIO_AUTH_TOKEN')
  },
  /** The Verify service the codes are sent through: its SID, which begins VA. */
  get twilioVerify() {
    return need('TWILIO_VERIFY_SID')
  },
  get stripe() {
    return need('STRIPE_SECRET_KEY')
  },
  /** The key the page gives Stripe: not a secret. (The name is the one Vercel's Stripe integration sets.) */
  get stripePublic() {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.STRIPE_PUBLISHABLE_KEY ?? ''
  },
  /** Stripe signs what it sends to /api/stripe with this. */
  get stripeWebhook() {
    return process.env.STRIPE_WEBHOOK_SECRET ?? ''
  },
}
