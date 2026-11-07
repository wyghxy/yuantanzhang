require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env'), quiet: true })
module.exports = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@ytz/contracts'],
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_ORIGIN || 'http://127.0.0.1:3311'}/api/:path*` }]
  },
}
