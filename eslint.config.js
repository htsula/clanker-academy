import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['dist', 'src-tauri', 'node_modules', 'src/assets'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      'react/no-danger': 'error',
      ...reactHooks.configs.recommended.rules,
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name="innerHTML"]',
          message: 'do not assign HTML strings — render structured content instead',
        },
        {
          selector: 'MemberExpression[property.name="outerHTML"]',
          message: 'do not assign HTML strings',
        },
        {
          selector: 'MemberExpression[property.name="insertAdjacentHTML"]',
          message: 'do not inject HTML strings',
        },
        { selector: 'CallExpression[callee.name="eval"]', message: 'no eval' },
        {
          selector: 'NewExpression[callee.name="Function"]',
          message: 'no dynamic function construction',
        },
      ],
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    files: ['tests/**/*.ts', 'scripts/**/*.mjs', 'vite.config.ts', 'vitest.config.ts', 'eslint.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
)