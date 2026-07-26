import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import security from 'eslint-plugin-security';
import tseslint from 'typescript-eslint';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  security.configs.recommended,
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'error',
      'no-debugger': 'error',
      'no-empty': 'error',
      'no-irregular-whitespace': 'error',
      'no-case-declarations': 'error',
      'no-fallthrough': 'error',
      'no-mixed-spaces-and-tabs': 'error',
      'no-redeclare': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-useless-escape': 'error',
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/out/**',
      '**/build/**',
      '**/next-env.d.ts',
      '**/examples/**',
      '**/skills',
      '**/src/components/ui/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/src/test/**',
    ],
  },
];

export default eslintConfig;
