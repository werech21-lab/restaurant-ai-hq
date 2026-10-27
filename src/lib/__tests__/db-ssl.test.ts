import { describe, expect, it } from 'vitest'
import { sslOptions } from '@/lib/db-ssl'
import { sslOptions as runnerSslOptions } from '../../../scripts/migrate-lib.mjs'

const pem = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----'

describe.each([
  ['the app', sslOptions],
  ['the migration runner', runnerSslOptions],
])('TLS options for %s', (_name, build) => {
  it('turns TLS off only for disable', () => {
    expect(build('disable', undefined)).toBe(false)
  })

  it('encrypts without checking the certificate for require, and ignores a CA there', () => {
    expect(build('require', undefined)).toEqual({ rejectUnauthorized: false })
    expect(build('require', pem)).toEqual({ rejectUnauthorized: false })
  })

  it('checks the certificate for verify, with the system authorities when no CA is given', () => {
    expect(build('verify', undefined)).toBe(true)
    expect(build('verify', '   ')).toBe(true)
  })

  it('checks the certificate against the given CA, accepting escaped newlines from a one-line variable', () => {
    expect(build('verify', pem)).toEqual({ rejectUnauthorized: true, ca: pem })
    expect(build('verify', pem.replace(/\n/g, '\\n'))).toEqual({ rejectUnauthorized: true, ca: pem })
  })
})
