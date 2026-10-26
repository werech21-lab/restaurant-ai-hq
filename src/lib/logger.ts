type Level = 'info' | 'warn' | 'error'

type Fields = Record<string, unknown>

function write(level: Level, message: string, fields?: Fields) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), message, ...fields })
  if (level === 'error') {
    process.stderr.write(`${line}\n`)
    return
  }
  process.stdout.write(`${line}\n`)
}

export function errorFields(error: unknown): Fields {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, stack: error.stack }
  }
  return { errorMessage: String(error) }
}

export const logger = {
  info: (message: string, fields?: Fields) => write('info', message, fields),
  warn: (message: string, fields?: Fields) => write('warn', message, fields),
  error: (message: string, fields?: Fields) => write('error', message, fields),
}
