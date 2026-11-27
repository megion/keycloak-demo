// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
// Turns off every ESLint rule that conflicts with Prettier's formatting.
const eslintConfigPrettier = require('eslint-config-prettier');
// Prettier as an ESLint rule: `prettier/prettier` reports formatting as a lint error,
// and `ng lint --fix` reformats the file using frontend/.prettierrc. ESLint 10 rejects
// nested `extends`, so the plugin is registered explicitly instead of its config preset.
const prettierPlugin = require('eslint-plugin-prettier');

module.exports = defineConfig([
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
