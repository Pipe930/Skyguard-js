import { Request, Response } from "../src/http";
import { createApp } from "../src/app";
import type { RouteHandler } from "../src/types";
import { json, redirect, text, download, render } from "../src/helpers/http";
import { v, schema, validateRequest } from "../src/validators/validationSchema";
import { join } from "node:path";
import { cors, csrf, sessions } from "../src/middlewares";
import { MemorySessionStorage } from "../src/sessions";
import { Hasher, JWT } from "../src/crypto";
import { UnauthorizedError } from "../src/exceptions/httpExceptions";
import { createUploader } from "../src/storage/uploader";
import { StorageType } from "../src/storage/types";

const PORT = 3000;

const app = createApp();

const uploader = createUploader({
  storageType: StorageType.DISK,
  storageOptions: {
    disk: {
      destination: "./uploads",
    },
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

app.staticFiles(join(__dirname, "..", "static"));

const userSchema = schema({
  body: {
    name: v.string({ maxLength: 60 }),
    email: v.string().email(),
    age: v.number({ min: 18 }),
    active: v.boolean(),
  },
});

const validParamsAndQuery = schema({
  params: {
    id: v.convert.number(),

    param: v.string(),
  },
  query: {
    test: v.string(),
    name: v.string({ isEmpty: true }),
  },
});

app.middlewares([
  cors({
    origin: ["http://localhost:3000/", "http://127.0.0.1:3000/"],
  }),
  sessions(MemorySessionStorage, {
    name: "test",
    rolling: false,
    saveUninitialized: false,
  }),
  csrf({
    cookieName: "XSRF-TOKEN",
    headerNames: ["x-csrf-token"],
    bodyField: "csrfToken",
  }),
]);

app.get(
  "/test/{id}/nel/{param}",
  (request: Request) => {
    const jsonTest = json({
      params: request.params,
      queries: request.query,
    });
    return jsonTest;
  },
  [validateRequest(validParamsAndQuery)],
);

app.post(
  "/upload",
  (request: Request) => {
    console.log("Archivo subido:", request.files);

    request.files;
    return json({
      message: "Archivo subido exitosamente",
      file: request.files,
    });
  },
  [uploader.single("file")],
);

app.get("/home", async (request: Request) => {
  const csrfToken = request.cookies["XSRF-TOKEN"];

  return render(
    `
    <h1>Hola mundo</h1><p>Esta es una vista renderizada</p>


    <form method="POST" action="/login">
      <input type="hidden" name="csrfToken" value="${csrfToken}" />
      <label for="username">Username</label>
      <input
        type="text"
        id="username"
        name="username"
        required
        autocomplete="username"
      />

      <label for="password">Password</label>
      <input
        type="password"
        id="password"
        name="password"
        required
        autocomplete="current-password"
      />

      <button type="submit">Login</button>
    </form>
    `,
  );
});

app.get("/test", () => {
  return text("holamundo");
});

app.get("/nueva-ruta", () => {
  return text("holamundo");
});

app.post(
  "/test",
  (request: Request) => {
    const data = request.body;
    return json(data).setStatusCode(201);
  },
  [validateRequest(userSchema)],
);

app.post("/xml", (request: Request) => {
  return json({ message: request.body });
});

app.get("/redirect", () => {
  return redirect("/test");
});

app.group("/tienda", tienda => {
  tienda.get("/pagina", () => {
    return json({ message: "desde ruta grupada" });
  });

  tienda.get("/holamundo/{param}", (request: Request) => {
    return json({
      message: "desde ruta agrupada con parametros",
      params: request.params,
    });
  });
});

const authMiddleware = async (
  request: Request,
  next: RouteHandler,
): Promise<Response> => {
  if (request.headers["authorization"] !== "test")
    throw new UnauthorizedError("Unauthorized");
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
  const { username, password } = request.body;

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

app.post("/password-hashed", async (request: Request) => {
  const { password } = request.body;
  const passwordHash = await Hasher.hash(password as string);
  const verifyHash = await Hasher.verify(password as string, passwordHash);

  return json({ data: passwordHash, verified: verifyHash }).setStatusCode(200);
});

app.get("/generate-jwt", () => {
  const token = JWT.create({ sub: "123" }, "secret-key", {
    algorithm: "HS256",
    expiresIn: "1h",
  });

  return json({
    token,
  });
});

app.post("/logout", (request: Request) => {
  if (!request.cookies) throw new UnauthorizedError("Its not autenticate");

  request.session.destroy();

  return json({ message: "Logged out" }).removeCookie("test");
});

app.run(PORT, () => {
  console.log(`Server running in port: http://localhost:${PORT}`);
});
