import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      eqeqeq: ['error', 'always'],
      'no-console': 'warn',
    },
  },
  {
    // The rules engine must stay pure and deterministic; see src/core/purity.test.ts
    // for the enforcement that also covers the DOM and framework imports.
    files: ['src/core/**/*.ts'],
    ignores: ['src/core/**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the injected Rng.' },
        { object: 'Date', property: 'now', message: 'core must not read the clock.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'core must not touch the DOM.' },
        { name: 'window', message: 'core must not touch the DOM.' },
      ],
    },
  },
);
