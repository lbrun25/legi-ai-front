/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './'
});

/** @type {import('jest').Config} */
const config = {
  coverageReporters: ['json', 'json-summary'],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  moduleNameMapper: {
    '^~/(.*)$': '<rootDir>/$1'
  },
  reporters: ['default'],
  testMatch: ['**/__tests__/*.test.ts']
};

export default createJestConfig(config);
