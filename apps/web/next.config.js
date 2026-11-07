module.exports = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@ytz/contracts'],
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://127.0.0.1:3311/api/:path*' }]
  },
}
