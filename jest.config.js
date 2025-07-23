export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/__mocks__/styleMock.js',
  },
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/e2e/',  // Exclude Playwright e2e tests
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    'user-version/**/*.js',
    '!src/lib/**',
    '!**/node_modules/**',
    '!**/*.min.js',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ['js', 'json'],
  transform: {
    '^.+\\.js$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current',
          },
          modules: false,
        }],
      ],
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@azure/msal-browser|@microsoft/microsoft-graph-client)/)',
  ],
  testEnvironmentOptions: {
    url: 'http://localhost',
  },
};