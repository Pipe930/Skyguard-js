/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from "jest";

const config: Config = {
  moduleNameMapper: {
    "^@exceptions/(.*)$": "<rootDir>/src/exceptions/$1",
    "^@helpers/(.*)$": "<rootDir>/src/helpers/$1",
    "^@http/(.*)$": "<rootDir>/src/http/$1",
    "^@middlewares/(.*)$": "<rootDir>/src/middlewares/$1",
    "^@parsers/(.*)$": "<rootDir>/src/parsers/$1",
    "^@routing/(.*)$": "<rootDir>/src/routing/$1",
    "^@server/(.*)$": "<rootDir>/src/server/$1",
    "^@sessions/(.*)$": "<rootDir>/src/sessions/$1",
    "^@static/(.*)$": "<rootDir>/src/static/$1",
    "^@types/(.*)$": "<rootDir>/src/types/$1",
    "^@validators/(.*)$": "<rootDir>/src/validators/$1",
    "^@views/(.*)$": "<rootDir>/src/views/$1",
  },
  clearMocks: true,

  collectCoverage: true,

  collectCoverageFrom: ["src/**/*.(t|j)s"],

  coverageDirectory: "coverage",

  coverageProvider: "v8",

  moduleFileExtensions: ["ts", "js", "json"],

  rootDir: "./",

  testEnvironment: "node",

  testRegex: "tests/.*\\.spec\\.ts$",

  transform: {
    "^.+\\.(t|j)s$": "ts-jest",
  },
};

export default config;
