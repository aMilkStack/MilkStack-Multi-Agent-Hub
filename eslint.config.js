import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['dist', 'node_modules', 'coverage', '.vite', 'eslint.config.js'],
  },

  // Base JS config for non-TS files
  {
    files: ['**/*.js'],
    ...js.configs.recommended,
  },

  // TypeScript config with type-checking
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
    },
    rules: {
      // React specific rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      'react/prop-types': 'off', // We use TypeScript for prop validation
      'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform

      // React Hooks rules
      ...reactHooksPlugin.configs.recommended.rules,

      // React Refresh
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn', // Warn instead of error for gradual migration
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn', // Warn instead of error initially
      '@typescript-eslint/no-misused-promises': 'warn', // Warn instead of error initially
      '@typescript-eslint/require-await': 'warn', // Warn instead of error
      '@typescript-eslint/no-unsafe-assignment': 'warn', // Warn instead of error
      '@typescript-eslint/no-unsafe-member-access': 'warn', // Warn instead of error
      '@typescript-eslint/no-unsafe-argument': 'warn', // Warn instead of error
      '@typescript-eslint/no-unsafe-call': 'warn', // Warn instead of error
      '@typescript-eslint/no-unsafe-return': 'warn', // Warn instead of error
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn', // Warn instead of error
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn', // Warn instead of error

      // General best practices
      'no-console': 'off', // Allow console for now, can restrict later
      'prefer-const': 'error',
      'no-var': 'error',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Disable Prettier conflicting rules (must be last)
  prettierConfig,
);
