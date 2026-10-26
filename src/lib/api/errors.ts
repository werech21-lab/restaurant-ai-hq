import { NextResponse } from 'next/server'

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500

export type ErrorBody = { error: { code: string; message: string; details?: unknown } }

/** An expected failure with an HTTP status. Messages are safe to show to clients. */
export class AppError extends Error {
  constructor(
    readonly status: ErrorStatus,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorResponse(status: ErrorStatus, code: string, message: string, details?: unknown): NextResponse<ErrorBody> {
  const body: ErrorBody = { error: details === undefined ? { code, message } : { code, message, details } }
  return NextResponse.json(body, { status })
}
