import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

// Shared no-unused-vars options
const unusedVarOptions = [
  'error',
  {
    args: 'after-used',
    ignoreRestSiblings: true,
    argsIgnorePattern: '^_',
    vars: 'all',
    caughtErrors: 'none',
  },
];

export default defineConfig([
  // Ignore build artifacts & generated code
  globalIgnores(['dist', 'dist-electron', 'build', '**/*.d.ts']),

  // JavaScript files
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react },
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': unusedVarOptions,
      // With React 17+ new JSX transform, these are usually unnecessary, but keep jsx-uses-vars for safety
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
    },
    settings: { react: { version: 'detect' } },
  },

  // TypeScript & TSX (Renderer / browser context by default) - quick noise reduction mode (no type-aware rules yet)
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended, // non type-aware
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    plugins: { '@typescript-eslint': tseslint.plugin, react },
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      globals: globals.browser,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': unusedVarOptions,
      // Temporarily relax noisy rules (can re-enable gradually)
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
    },
    settings: { react: { version: 'detect' } },
  },

  // Electron main & preload (Node context)
  {
    files: ['electron/**/*.{ts,tsx,js}', 'main.ts', 'preload.ts'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': unusedVarOptions,
      'no-unused-vars': unusedVarOptions,
      // Keep relaxed same as TS override above
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },

  // Node config / scripts / build tooling
  {
    files: ['vite.config.*', 'scripts/**/*.{js,ts}', '*.cjs'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': unusedVarOptions,
      '@typescript-eslint/no-unused-vars': unusedVarOptions,
    },
  },
]);
