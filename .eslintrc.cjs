/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
  root: true,
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  ignorePatterns: ['**/spine-ts/*.*'],
  rules: {
    'no-unused-vars': "off",
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'curly': ["error", "multi-line"],
    'no-constant-condition': ["error", { "checkLoops": false }]
  },
};
