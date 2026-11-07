import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next*/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    languageOptions: { globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', FormData: 'readonly', window: 'readonly', document: 'readonly', navigator: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly', File: 'readonly', Blob: 'readonly', Event: 'readonly', CustomEvent: 'readonly', HTMLElement: 'readonly', HTMLInputElement: 'readonly', HTMLTextAreaElement: 'readonly', HTMLMediaElement: 'readonly', HTMLVideoElement: 'readonly', HTMLAudioElement: 'readonly', ResizeObserver: 'readonly', IntersectionObserver: 'readonly', MediaQueryList: 'readonly', Node: 'readonly', performance: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly', atob: 'readonly', crypto: 'readonly' } },
    rules: { 'no-undef': 'off', '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] }
  }
)
