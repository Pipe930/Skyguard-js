# 🛡️✈️ Skyguard.js — TypeScript Web Framework

Skyguard.js is a **lightweight and experimental web framework**, inspired by **Express**, written entirely in **TypeScript**.

The main goal of this project is to **learn, experiment, and build a solid foundation** for a more complete backend framework in the future.

At its current stage, the framework focuses on **routing**, **internal architecture**, **type safety**, and **core HTTP abstractions**, leaving advanced features for later iterations.

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
- Simple template engine with layouts and helpers
- Built-in HTTP exceptions
- Password hashing and JWT token generation
- CORS middleware
- File uploads (via middleware)
- Static file serving
- Session handling (via middleware)

---

> [!NOTE]
> It is recommended to develop with `TypeScript` for a more secure and efficient development process; the framework already has native support for `TypeScript` and includes the necessary types.

---

## 📦 Installation

```bash
npm install skyguard-js
```

---

## 🏁 Basic Usage

```ts
import { createApp, Response } from "skyguard-js";

const app = createApp();

app.get("/health", () => {
  return Response.json({ status: "ok" });
});

app.run(3000, () => {
  console.log(`Server running in port: http://localhost:${3000}`);
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
import { cors } from "skyguard-js/middlewares";

app.middlewares([
  cors({
    origin: ["http://localhost:3000", "https://myapp.com"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
]);
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

To validate data in the body of client requests, the framework provides the creation of validation schemas, which are created as follows:

```ts
import { v, schema } from "skyguard-js";

const userSchema = schema({
  name: v.string({ maxLength: 60 }),
  email: v.email(),
  age: v.number({ min: 18 }),
  active: v.boolean().default(false),
  birthdate: v.date({ max: new Date() }),
});

app.post("/users", (request: Request) => {
  const validatedData = request.validateData(userSchema);

  return Response.json({
    success: true,
    data: validatedData,
  });
});
```

By default each property you define in the schema is required, to define it optional you use the `.optional()` or `.default(value)` function

Validation is:

- Fail-fast per field
- Fully typed
- Reusable
- Decoupled from transport layer

---

## 🚨 Exceptions & Error Handling

The framework provides a set of built-in HTTP exceptions that can be thrown from route handlers or middleware. When an exception is thrown, the framework detects it and sends an appropriate HTTP response with the status code and message you specified in the class.

```ts
import { NotFoundError, InternalServerError } from "skyguard-js/exceptions";

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
import { sessions } from "skyguard-js/middlewares";
import { FileSessionStorage } from "skyguard-js";

app.middlewares([sessions(FileSessionStorage)]);

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
import { hash, verify, createJWT } from "skyguard-js/security";
import { authJWT } from "skyguard-js/middlewares";

app.post("/register", async (request: Request) => {
  const { username, password } = request.data;
  const hashedPassword = await hash(password);

  // Save username and hashedPassword to database
  // ...

  return Response.json({ message: "User registered" });
});

app.post("/login", async (request: Request) => {
  const { username, password } = request.data;

  // Retrieve user from database by username
  // ...

  const isValid = await verify(password, user.hashedPassword);

  if (!isValid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const token = createJWT({ sub: user.id, role: user.role }, "1h");

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
    destination: "./uploads",
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

---

## 🧠 Motivation

This project was created to deeply understand how frameworks like **Express**, **Fastify**, and **Koa** work internally, by reimplementing their core ideas with a **modern TypeScript-first approach**.

---

## 📄 License

MIT License

---
