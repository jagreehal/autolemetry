import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'off', // Allow @ts-ignore for edge runtime imports
      '@typescript-eslint/no-unsafe-function-type': 'off', // Needed for context manager
      '@typescript-eslint/no-this-alias': 'off', // Needed for context manager
      'prefer-rest-params': 'off', // Needed for context manager
    },
  },
  {
    files: ['**/*.test.ts', '**/*.integration.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        // Allow unused parameters in test files
        args: 'none',
      }],
    },
  },
);
