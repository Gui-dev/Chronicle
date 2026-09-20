import type { BetterAuthPlugin } from 'better-auth'
import { emailOTP } from 'better-auth/plugins'

export const plugins: BetterAuthPlugin[] = [
  emailOTP({
    sendVerificationOTP: async ({ email, otp }) => {
      // TODO: Send OTP via email (Mailpit in dev)
      console.log(`OTP for ${email}: ${otp}`)
    },
  }),
]
