<div align="center">
  <img src="https://github.com/Pipe930/Skyguard-js/blob/main/logo/Skyguard-JS_logo.png" width="350px"/>
  <br/>
  <br/>
</div>

[![NPM Version](https://img.shields.io/npm/v/skyguard-js)](https://www.npmjs.com/package/skyguard-js)
[![Deployment Pipeline](https://github.com/Pipe930/Skyguard-js/actions/workflows/pipeline.yml/badge.svg)](https://github.com/Pipe930/Skyguard-js/actions/workflows/pipeline.yml)

**Skyguard.js** is a **lightweight, dependency-free web framework** built entirely with **TypeScript**.

The project aims to provide a **clean, strongly-typed foundation for building web APIs and backend applications**, with a strong emphasis on simplicity, performance, and long-term maintainability.

Skyguard.js currently delivers a solid core that includes **routing**, **type-safe HTTP abstractions**, and a carefully designed **internal architecture**, establishing a reliable base for future expansion and advanced features.

---

## 🎯 Current Goals

- Provide a simple and expressive API to register and handle HTTP routes
- Maintain a clean, extensible, and framework-agnostic architecture
- Leverage TypeScript for strong typing and better developer experience
- Serve as a learning project with progressive evolution

---

## ✨ Current Features

- TypeScript-first design
- HTTP routing by method (GET, POST, PUT, PATCH, DELETE)
- Route groups with prefixes
- Global, group, and route-level middlewares
- Unified `Context` abstraction (`ctx.req` + response helpers)
- Declarative data validation
- Support for template motors (handlebars, pugs, ejs, etc.)
- Built-in HTTP exceptions
- Password hashing and JWT token generation
- CORS middleware
- CSRF middleware protection
- File uploads (via middleware)
- Static file serving
- Session handling (via middleware)

---

## 📦 Installation

You need to have [NodeJS](https://nodejs.org/) version 22 or later installed.

Create the `package.json` file to start a new [NodeJS](https://nodejs.org/) project using the `npm init` command.

After configuring the package.json, install [Typescript](https://www.typescriptlang.org/).

```bash
npm install typescript -D
```

After installing [Typescript](https://www.typescriptlang.org/) in your project, you need to create the [Typescript](https://www.typescriptlang.org/) configuration file `tsconfig.json`.

```bash
npx tsc --init
```

Now that [Typescript](https://www.typescriptlang.org/) is configured, we can install the library. Since it's a module that's in the [NPM Registry](https://www.npmjs.com/), we use the npm package manager.

```bash
npm install skyguard-js
```

---

## 🏁 Quick Start

```ts
import { createApp } from "skyguard-js";

const app = createApp();

app.get("/", ctx => ctx.json({ status: "ok" }));

app.run();
```

---

## 📚 Documentation

Full documentation is available on the [Official Website](https://pipe930.github.io/skyguard-documentation/). A section with examples or use cases will follow.

---

## 🔮 Roadmap (Tentative)

- Middleware system (✅)
- Template engines supported (✅)
- Context abstraction (✅)
- Data validation (✅)
- Error handling improvements (✅)
- Sessions & cookies (✅)
- Passoword hashing & JWT tokens (✅)
- File uploads (✅)
- Database & ORM integration
- Authentication & authorization
- WebSockets

## 📜 License

Licensed under the [MIT License](https://github.com/Pipe930/Skyguard-js/blob/main/LICENSE).
