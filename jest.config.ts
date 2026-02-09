/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

import type { Config } from "jest";

const config: Config = {
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
