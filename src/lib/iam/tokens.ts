import { createHash, randomBytes } from 'node:crypto'

const INVITATION_TOKEN_BYTES = 32

/** A fresh random token (256 bits). It is shown once and never stored. */
export function generateInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES).toString('base64url')
}

/** The stored form of a token. */
export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}
