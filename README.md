<div align="center">
  <img src="https://github.com/Pipe930/Skyguard-js/blob/main/logo/Skyguard-JS_logo.png" width="350px"/>
  <br/>
  <br/>
</div>

[![NPM Version](https://img.shields.io/npm/v/skyguard-js)](https://www.npmjs.com/package/skyguard-js)
[![Deployment Pipeline](https://github.com/Pipe930/Skyguard-js/actions/workflows/pipeline.yml/badge.svg)](https://github.com/Pipe930/Skyguard-js/actions/workflows/pipeline.yml)
[![Socket Badge](https://badge.socket.dev/npm/package/skyguard-js/1.1.8)](https://badge.socket.dev/npm/package/skyguard-js/1.1.8)

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
- Request / Response abstractions
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

## 🌐 CORS Middleware

To enable CORS, use the built-in `cors` middleware.

> Security note: by default CORS is now **disabled** unless you explicitly set
> `origin`.

```ts
import { cors, HttpMethods } from "skyguard-js";

app.middlewares(
  cors({
    origin: ["http://localhost:3000", "https://myapp.com"],
    methods: [HttpMethods.get, HttpMethods.post],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
```

---

## 🛡️ CSRF Middleware

Use the built-in `csrf` middleware to protect endpoints against CSRF attacks.

```ts
import { csrf, json } from "skyguard-js";

app.middlewares(
  csrf({
    cookieName: "XSRF-TOKEN",
    headerNames: ["x-csrf-token"],
  }),
);

app.post("/transfer", () => {
  return json({ ok: true });
});
```

The middleware follows a hardened **double-submit cookie** strategy:

- It issues a CSRF cookie when missing (including first GET/HEAD/OPTIONS and failed protected requests).
- For state-changing requests (POST/PUT/PATCH/DELETE), it validates the token from header/body against the cookie value.
- It validates `Origin`/`Referer` for protected requests (and requires `Referer` on HTTPS when `Origin` is missing).
- It rejects duplicated CSRF header values to avoid ambiguous token parsing.

### Example: CSRF token in HTML templates (Express Handlebars)

When you render server-side HTML, you can pass the CSRF token to your template and include it as a hidden field in forms.

```ts
import { createApp, csrf, render, json } from "skyguard-js";
import { engine } from "express-handlebars";
import { join } from "node:path";

const app = createApp();

app.views(__dirname, "views");
app.engineTemplates(
  "hbs",
  engine({
    extname: "hbs",
    layoutsDir: join(__dirname, "views"),
    defaultLayout: "main",
  }),
);

app.middlewares(
  csrf({
    cookieName: "XSRF-TOKEN",
    headerNames: ["x-csrf-token"],
  }),
);

app.get("/transfer", request => {
  return render("transfer", {
    csrfToken: request.cookies["XSRF-TOKEN"],
  });
});

app.post("/transfer", request => {
  // If middleware passes, token is valid
  return json({ ok: true, amount: request.body.amount });
});
```

`views/transfer.hbs`:

```hbs
<form action="/transfer" method="POST">
  <input type="hidden" name="csrf" value="{{csrfToken}}" />
  <input type="number" name="amount" />
  <button type="submit">Send</button>
</form>
```

For `fetch`/AJAX requests, send the same token in headers:

```html
<script>
  const csrfToken = "{{csrfToken}}";

  async function sendTransfer() {
    await fetch("/transfer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify({ amount: 150 }),
    });
  }
</script>
```

---

## 🚦 Rate Limit Middleware

You can limit requests with the built-in `rateLimit` middleware.

```ts
import { rateLimit, Response } from "skyguard-js";

const apiRateLimit = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 100,
  message: "Too many requests from this IP",
  trustProxy: true, // only enable when running behind trusted reverse proxies
});

app.get("/api/users", [apiRateLimit], () => {
  return Response.json([{ id: 1 }]);
});
```

For multi-instance deployments, provide a shared store (for example Redis) by
implementing the `RateLimitStore` interface and passing it in `store`.

---

## 🛡️ Security

The framework includes some password hashing and JWT token generation functions, and also includes JWT authentication middleware.

```ts
import { Hasher, JWT, json } from "skyguard-js";

app.post("/register", async (request: Request) => {
  const { username, password } = request.data;
  const hashedPassword = await Hasher.hash(password);

  // Save username and hashedPassword to database
  // ...

  return json({ message: "User registered" });
});

app.post("/login", async (request: Request) => {
  const { username, password } = request.data;

  // Retrieve user from database by username
  // ...

  const isValid = await Hasher.verify(password, user.hashedPassword);

  if (!isValid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const token = JWT.create({ sub: "123" }, "secret-key", {
    algorithm: "HS256",
    expiresIn: "1h",
  });

  return json({ token });
});
```

---

## 📂 File Uploads

To handle file uploads, use the built-in `createUploader` function to create an uploader middleware with the desired storage configuration.

```ts
import { createUploader, StorageType, json } from "skyguard-js";

const uploader = createUploader({
  storageType: StorageType.DISK,
  storageOptions: {
    disk: {
      destination: "./uploads",
    },
  },
});

app.post("/upload", [uploader.single("file")], (request: Request) => {
  return json({
    message: "File uploaded successfully",
    file: request.file,
  });
});
```

Depending on the `Storage Type` you have selected, the storage options will contain two properties: `disk` and `memory`

---

## 🔮 Roadmap (Tentative)

- Middleware system (✅)
- Template engines supported (✅)
- Request / Response abstraction (✅)
- Data validation (✅)
- Error handling improvements (✅)
- Sessions & cookies (✅)
- Passoword hashing & JWT tokens (✅)
- File uploads (✅)
- Database & ORM integration
- Authentication & authorization
- WebSockets
