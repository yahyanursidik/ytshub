import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default [
  { ignores: ['dist/**', 'node_modules/**', '.astro/**', 'screenshots/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Script CLI (tools/ dan scripts/): berjalan di Node, sebagian mengeksekusi kode
    // di dalam browser, dan memang berkomunikasi lewat stdout.
    files: ['tools/**/*.mjs', 'scripts/**/*.ts'],
    languageOptions: {
      globals: {
        console: 'readonly',
        document: 'readonly',
        window: 'readonly',
        process: 'readonly',
        getComputedStyle: 'readonly',
      },
    },
    rules: { 'no-console': 'off' },
  },
];
