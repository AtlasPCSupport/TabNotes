import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.*'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser, globals: { ...globals.browser, ...globals.node } },
    plugins: { '@typescript-eslint': ts, 'react-hooks': hooks },
    rules: {
      ...js.configs.recommended.rules,
      ...ts.configs.recommended.rules,
      'no-undef': 'off', // TypeScript owns identifier checking.
      'no-unused-vars': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  { files: ['**/e2e/**'], rules: { 'react-hooks/rules-of-hooks': 'off' } },
  { files: ['**/*.d.ts'], rules: { 'no-redeclare': 'off' } },
];
