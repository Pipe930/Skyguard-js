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
import { createApp, Response } from "skyguard-js";

const app = createApp();

const PORT = 3000;

app.get("/health", () => {
  return Response.json({ status: "ok" });
});

app.run(PORT, () => {
  console.log(`Server running in port: http://localhost:${PORT}`);
});
```

---

## 🛣️ Routing

Routes are registered using HTTP methods on the `app` instance.

```ts
app.get("/posts/{id}", (request: Request) => {
  return Response.json(request.params);
});

app.post("/posts", (request: Request) => {
  return Response.json(request.data);
});
```

Internally, the framework maps HTTP methods to route layers using an optimized routing table.

---

## 🧩 Route Groups

Route groups allow you to organize endpoints under a shared prefix.

```ts
app.group("/api", api => {
  api.get("/users", () => Response.json({ message: "Users" }));
  api.get("/products", () => Response.json({ message: "Products" }));
});
```

---

## 🛠️ Middlewares

Middlewares can be registered **globally**, **per group**, or **per route**.

```ts
import { Request, Response, RouteHandler } from "skyguard-js";

const authMiddleware = async (
  request: Request,
  next: RouteHandler,
): Promise<Response> => {
  if (request.headers["authorization"] !== "secret") {
    return Response.json({ message: "Unauthorized" }).setStatus(401);
  }

  return next(request);
};

// Global middleware
app.middlewares([authMiddleware]);

// Group middleware
app.group("/admin", admin => {
  admin.middlewares([authMiddleware]);
  admin.get("/dashboard", () => Response.json({ ok: true }));
});

// Route-level middleware
app.get("/secure", () => Response.json({ secure: true }), [authMiddleware]);
```

---

## 🌐 CORS Middleware

To enable CORS, use the built-in `cors` middleware.

```ts
import { cors, HttpMethods } from "skyguard-js";

app.middlewares([
  cors({
    origin: ["http://localhost:3000", "https://myapp.com"],
    methods: [HttpMethods.get, HttpMethods.post],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
]);
```

---

## 🛡️ CSRF Middleware

Use the built-in `csrf` middleware to protect endpoints against CSRF attacks.

```ts
import { csrf } from "skyguard-js";

app.middlewares([
  csrf({
    cookieName: "XSRF-TOKEN",
    headerNames: ["x-csrf-token"],
  }),
]);

app.post("/transfer", () => {
  return Response.json({ ok: true });
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
import { createApp, csrf, Response } from "skyguard-js";
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

app.middlewares([
  csrf({
    cookieName: "XSRF-TOKEN",
    headerNames: ["x-csrf-token"],
  }),
]);

app.get("/transfer", request => {
  return Response.render("transfer", {
    csrfToken: request.cookies["XSRF-TOKEN"],
  });
});

app.post("/transfer", request => {
  // If middleware passes, token is valid
  return Response.json({ ok: true, amount: request.body.amount });
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

## 📌 Static Files

To serve static files, use the application's `staticFiles` method with the directory path. The name of the folder will determine the initial route prefix.

```ts
import { join } from "node:path";

app.staticFiles(join(__dirname, "..", "static"));

// Route http://localhost:3000/static/style.css will serve the file located at ./static/style.css
```

---

## ⛔ Data Validation

To validate the data in the body of client requests, the framework provides the creation of validation schemes and a middleware function to validate the body of HTTP requests, used as follows:

```ts
import { v, schema, validateRequest } from "skyguard-js";

// Created Schema
const userSchema = schema({
  body: {
    name: v.string({ maxLength: 60 }),
    email: v.email(),
    age: v.number({ min: 18 }),
    active: v.boolean().default(false),
    birthdate: v.date({ max: new Date() }),
  },
});

app.post(
  "/test",
  (request: Request) => {
    const data = request.body;
    return json(data).setStatusCode(201);
  },
  [validateRequest(userSchema)],
);
```

To type the request body, an interface is used and the .getData() method is used, which allows returning the typed bodym. By default each property you define in the schema is required, to define it optional you use the `.optional()` or `.default(value)` function

Validation is:

- Fail-fast per field
- Fully typed
- Reusable
- Decoupled from transport layer

---

## 🚨 Exceptions & Error Handling

The framework provides a set of built-in HTTP exceptions that can be thrown from route handlers or middleware. When an exception is thrown, the framework detects it and sends an appropriate HTTP response with the status code and message you specified in the class.

```ts
import { NotFoundError, InternalServerError } from "skyguard-js";

const listResources = ["1", "2", "3"];

app.get("/resource/{id}", (request: Request) => {
  const resource = request.params["id"];

  if (!listResources.includes(resource)) {
    throw new NotFoundError("Resource not found");
  }

  return Response.json(resource);
});

app.get("/divide", (request: Request) => {
  try {
    const { a, b } = request.query;
    const result = Number(a) / Number(b);

    return Response.json({ result });
  } catch (error) {
    throw new InternalServerError(
      "An error occurred while processing your request",
    );
  }
});
```

---

## 🧱 Sessions

To handle sessions, you must use the framework’s built-in middleware. Depending on where you want to store them (in memory, in files, or in a database), you need to use the corresponding storage class.

```ts
import { sessions, FileSessionStorage } from "skyguard-js";

app.middlewares([
  sessions(FileSessionStorage, {
    name: "connect.sid",
    rolling: true,
    saveUninitialized: false,
    cookie: {
      maxAge: 60 * 60 * 24,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
      path: "/",
    },
  }),
]);

app.post("/login", (request: Request) => {
  const { username, password } = request.data;

  if (username === "admin" && password === "secret") {
    request.session.set("user", {
      id: 1,
      username: "admin",
      role: "admin",
    });

    return json({ message: "Logged in" });
  }

  throw new UnauthorizedError("Invalid credentials");
});

app.get("/me", (request: Request) => {
  const user = request.session.get("user");

  if (!user) throw new UnauthorizedError("Not authenticated");
  return json({ user });
});
```

---

## 🛡️ Security

The framework includes some password hashing and JWT token generation functions, and also includes JWT authentication middleware.

```ts
import { Hasher, JWT } from "skyguard-js";

app.post("/register", async (request: Request) => {
  const { username, password } = request.data;
  const hashedPassword = await Hasher.hash(password);

  // Save username and hashedPassword to database
  // ...

  return Response.json({ message: "User registered" });
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

  return Response.json({ token });
});
```

---

## 📂 File Uploads

To handle file uploads, use the built-in `createUploader` function to create an uploader middleware with the desired storage configuration.

```ts
import { createUploader, StorageType } from "skyguard-js";

const uploader = createUploader({
  storageType: StorageType.DISK,
  storageOptions: {
    disk: {
      destination: "./uploads",
    },
  },
});

app.post(
  "/upload",
  (request: Request) => {
    return Response.json({
      message: "File uploaded successfully",
      file: request.file,
    });
  },
  [uploader.single("file")],
);
```

Depending on the `Storage Type` you have selected, the storage options will contain two properties: `disk` and `memory`

---

## 📄 Views & Template Engine

To render views, you must first set up the template engine using the `engineTemplates` method of the `app`, set the view path with the `views` method of the `app`, and then you can use the `render` method within your handlers to render the views with the data you want to pass.

```ts
import { engine } from "express-handlebars";
import ejs from "ejs";
import { join } from "node:path";

app.views(__dirname, "views");

// Config for Express Handlebars
app.engineTemplates(
  "hbs",
  engine({
    extname: "hbs",
    layoutsDir: join(__dirname, "views"),
    defaultLayout: "main",
  }),
);

// Config for EJS
app.engineTemplates("ejs", (templatePath, data) => {
  return ejs.renderFile(templatePath, data);
});

app.get("/home", () => {
  return render("index", {
    title: "Home Page",
    message: "Welcome to the home page!",
  });
});
```

Currently, it works with third-party template engines such as **Express Handlebars**, **Pug**, and **EJS**, but the idea is to implement its own template engine in the future.

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
