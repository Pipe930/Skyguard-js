import { Request, Response } from "../src/http";
import { createApp } from "../src/app";
import { RouteHandler } from "../src/types";
import { json, redirect, text, render, download } from "../src/helpers";
import { ValidationSchema } from "../src/validators";
import { join } from "node:path";
import { cors } from "../src/middlewares";

const PORT = 3000;

const app = createApp();

app.staticFiles(join(__dirname, "..", "static"));

app.middlewares([
  cors({
    origin: ["http://localhost:3000/", "http://127.0.0.1:3000/"],
  }),
]);

const userSchema = ValidationSchema.create()
  .field("name")
  .string({ maxLength: 60, isEmpty: false })
  .field("email")
  .required()
  .email()
  .field("birthdate")
  .date({ max: new Date() })
  .field("age")
  .number({ min: 18, max: 65 })
  .field("active")
  .required()
  .boolean()
  .field("bio")
  .optional()
  .string()
  .build();

app.get("/test/{id}/nel/{param}", (request: Request) => {
  const jsonTest = json({
    params: request.getParams(),
    queries: request.getQueryParams(),
  });
  return jsonTest;
});

app.get("/test", () => {
  return text("holamundo");
});

app.get("/nueva-ruta", () => {
  return text("holamundo");
});

app.post("/test", (request: Request) => {
  const dataValid = request.validateData(userSchema);
  return json(dataValid).setStatus(201);
});

app.post("/xml", (request: Request) => {
  return json({ message: request.getData() });
});

app.get("/redirect", () => {
  return redirect("/test");
});

app.get("/home", () => {
  return render(
    "home",
    {
      title: "Productos",
      products: [
        { name: "Laptop", price: 999.99, inStock: true },
        { name: "Mouse", price: 29.99, inStock: false },
      ],
      user: {
        name: "Juan Pérez",
        role: "admin",
      },
    },
    "main",
  );
});

app.group("/tienda", tienda => {
  tienda.get("/pagina", () => {
    return json({ message: "desde ruta grupada" });
  });

  tienda.get("/holamundo/{param}", (request: Request) => {
    return json({
      message: "desde ruta agrupada con parametros",
      params: request.getParams(),
    });
  });
});

const authMiddleware = async (
  request: Request,
  next: RouteHandler,
): Promise<Response> => {
  if (request.getHeaders["authorization"] !== "test") {
    return json({
      message: "NotAuthenticated",
    }).setStatus(401);
  }
  return await next(request);
};

app.get("/middlewares", () => json({ message: "hola" }), [authMiddleware]);

app.get("/download/report", async () => {
  return await download(
    join(__dirname, "..", "files", "report.pdf"),
    "reporte-2024.pdf",
  );
});

app.post("/login", (request: Request) => {
  const { username, password } = request.getData();

  if (username === "admin" && password === "secret") {
    request.getSession.set("user", {
      id: 1,
      username: "admin",
      role: "admin",
    });

    return json({ message: "Logged in" });
  }

  return json({ error: "Invalid credentials" }).setStatus(401);
});

app.get("/me", (request: Request) => {
  const user = request.getSession.get("user");

  if (!user) {
    return json({ error: "Not authenticated" }).setStatus(401);
  }

  return json({ user });
});

app.post("/logout", (request: Request) => {
  request.getSession.destroy();
  return json({ message: "Logged out" });
});

app.run(PORT, () => {
  console.log(`Server running in port: http://localhost:${PORT}`);
});
