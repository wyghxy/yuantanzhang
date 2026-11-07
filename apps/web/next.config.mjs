import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true })
export default {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@ytz/contracts'],
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_ORIGIN || 'http://127.0.0.1:3311'}/api/:path*` }]
  },
}
