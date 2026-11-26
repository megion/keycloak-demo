/** Jest configuration: runs TypeScript unit tests from the test/ directory. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }]
  },
  moduleFileExtensions: ['ts', 'js']
};
