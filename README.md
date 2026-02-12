# 🛡️✈️ Skyguard.js — TypeScript Web Framework

Skyguard.js is a **lightweight and experimental web framework**, inspired by **Express**, written entirely in **TypeScript**.

The main goal of this project is to **learn, experiment, and build a solid foundation** for a more complete backend framework in the future.

At its current stage, the framework focuses on **routing**, **internal architecture**, **type safety**, and **core HTTP abstractions**, leaving advanced features for later iterations.

---

## 🎯 Current Goals

* Provide a simple and expressive API to register and handle HTTP routes
* Maintain a clean, extensible, and framework-agnostic architecture
* Leverage TypeScript for strong typing and better developer experience
* Serve as a learning project with progressive evolution

---

## ✨ Current Features

* TypeScript-first design
* HTTP routing by method (GET, POST, PUT, PATCH, DELETE)
* Route groups with prefixes
* Global, group, and route-level middlewares
* Request / Response abstractions
* Declarative data validation
* Simple template engine with layouts and helpers
* Static file serving
* Session handling (via middleware)

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
  console.log(`Server running in port: http://localhost:${3000}`)
});
```

---

## 🛣️ Routing

Routes are registered using HTTP methods on the `app` instance.

```ts
app.get("/posts/{id}", (request: Request) => {
  return Response.json(request.getParams());
});

app.post("/posts", (request: Request) => {
  return Response.json(request.getData());
});
```

Internally, the framework maps HTTP methods to route layers using an optimized routing table.

---

## 🧩 Route Groups

Route groups allow you to organize endpoints under a shared prefix.

```ts
app.group("/api", (api) => {
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
  if (request.getHeaders["authorization"] !== "secret") {
    return Response.json({ message: "Unauthorized" }).setStatus(401);
  }

  return next(request);
};

// Global middleware
app.middlewares([authMiddleware]);

// Group middleware
app.group("/admin", (admin) => {
  admin.middlewares([authMiddleware]);
  admin.get("/dashboard", () => Response.json({ ok: true }));
});

// Route-level middleware
app.get(
  "/secure",
  () => Response.json({ secure: true }),
  [authMiddleware],
);
```

---

## 📦 Data Validation

Skyguard.js provides a **declarative validation system** using schemas.

```ts
import { ValidationSchema } from "skyguard-js/validation";

export const userSchema = ValidationSchema.create()
  .field("name")
    .required("Name is required")
    .string({ maxLength: 60 })
  .field("email")
    .required()
    .email()
  .field("age")
    .number({ min: 18, max: 99 })
  .field("active")
    .boolean()
  .build();

app.post("/users", (request: Request) => {
  const validatedData = request.validateData(userSchema);

  return Response.json({
    success: true,
    data: validatedData,
  });
});
```

Validation is:

* Fail-fast per field
* Fully typed
* Reusable
* Decoupled from transport layer

---

## 📄 Views & Template Engine

To render HTML views, use the `render` helper.

```ts
import { render } from "skyguard-js/helpers";

app.get("/home", () => {
  return render(
    "home",
    {
      title: "Products",
      products: [
        { name: "Laptop", price: 999.99 },
        { name: "Mouse", price: 29.99 },
      ],
      user: { name: "John", role: "admin" },
    },
    "main",
  );
});
```

### Supported features

* Variable interpolation (`{{ variable }}`)
* Conditionals (`{{#if}}`)
* Loops (`{{#each}}`)
* Layouts
* Partials
* Built-in helpers (`upper`, `lower`, `date`)
* Custom helpers

---

## 🧱 Project Status

⚠️ **Early-stage project**

* Not production-ready
* API may change
* Features are still evolving
* Intended primarily for learning and experimentation

---

## 🔮 Roadmap (Tentative)

* Middleware system (✅)
* Template engine (✅)
* Request / Response abstraction (✅)
* Data validation (✅)
* Error handling improvements
* Database & ORM integration
* Authentication & authorization
* Sessions & cookies (in progress)
* Plugin system

---

## 🧠 Motivation

This project was created to deeply understand how frameworks like **Express**, **Fastify**, and **Koa** work internally, by reimplementing their core ideas with a **modern TypeScript-first approach**.

---

## 📄 License

MIT License

---