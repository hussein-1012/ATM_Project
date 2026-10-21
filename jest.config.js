module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/__tests__/**/*.ts'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  // pnpm hoists into .pnpm — we must match the pnpm store path pattern.
  // @nestjs/mongoose v12 ships pure ESM; transform it so Jest can run it.
  transformIgnorePatterns: [
    '<rootDir>/node_modules/.pnpm/(?!@nestjs\\+mongoose)',
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/database/**', '!src/**/*.module.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov'],
};
