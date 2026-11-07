import { randomBytes } from 'node:crypto'
import { writeFileSync, existsSync } from 'node:fs'
if (existsSync('.env')) throw new Error('Refusing to overwrite existing local configuration')
writeFileSync('.env', [
  'DATABASE_URL=postgresql://personal:personal_local@127.0.0.1:5547/ytz_personal',
  'REDIS_URL=redis://127.0.0.1:6397',
  'API_PORT=3311', 'WEB_PORT=3310', 'API_ORIGIN=http://127.0.0.1:3311',
  'PERSONAL_USERNAME=owner', `PERSONAL_PASSWORD=${randomBytes(24).toString('hex')}`,
  `SESSION_SECRET=${randomBytes(48).toString('hex')}`, 'UPLOAD_DIR=./data/uploads', ''
].join('\n'), { mode: 0o600 })
