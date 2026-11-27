import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
// Turns off every ESLint rule that conflicts with Prettier's formatting.
import eslintConfigPrettier from 'eslint-config-prettier';
// Prettier as an ESLint rule: `prettier/prettier` reports formatting as a lint error,
// and `ng lint --fix` reformats the file using frontend/.prettierrc. ESLint 10 rejects
// nested `extends`, so the plugin is registered explicitly instead of its config preset.
import prettierPlugin from 'eslint-plugin-prettier';

export default defineConfig([
  // The config file itself is lint tooling, not application source
  // (backend/eslint.config.mjs ignores its own config the same way).
  { ignores: ['eslint.config.ts'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
      eslintConfigPrettier,
    ],
    processor: angular.processInlineTemplates,
    plugins: { prettier: prettierPlugin },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
      // Formatting is enforced as a lint error; Prettier reads frontend/.prettierrc.
      'prettier/prettier': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
      eslintConfigPrettier,
    ],
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'error',
    },
  },
]);
