// Local staging trial. The owner cookie secret stays in this process and is not printed.
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'

process.env.AETHER_DEV_OWNER = '1'
if (!process.env.AETHER_DEV_OWNER_SECRET || process.env.AETHER_DEV_OWNER_SECRET.length < 32) {
  process.env.AETHER_DEV_OWNER_SECRET = randomBytes(32).toString('hex')
}

const child = spawn(process.execPath, ['--env-file=.env.staging', './node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '4020'], {
  stdio: 'inherit',
  env: process.env,
})
child.on('exit', (code) => process.exit(code ?? 0))
