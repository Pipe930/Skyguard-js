import { Context, Response } from "../src/http";
import { createApp } from "../src/app";
import type { RouteHandler } from "../src/types";
import { v, schema, validateRequest } from "../src/validators/validationSchema";
import { cors, csrf, rateLimit, sessions } from "../src/middlewares";
import { MemorySessionStorage } from "../src/sessions";
import { Hasher, JWT } from "../src/crypto";
import { UnauthorizedError } from "../src/exceptions/httpExceptions";
import { createUploader } from "../src/storage/uploader";
import { StorageType } from "../src/storage/types";

const app = createApp();

const apiRateLimit = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 100,
  message: "Too many requests from this IP",
});

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

app.middlewares(apiRateLimit);
app.middlewares(
  cors({
    origin: ["http://localhost:3000/"],
  }),
  sessions(MemorySessionStorage, {
    name: "test",
    rolling: false,
    saveUninitialized: false,
  }),
);

app.get(
  "/test/{id}/nel/{param}",
  [validateRequest(validParamsAndQuery)],
  context => {
    return context.json({
      params: context.params,
      queries: context.query,
    });
  },
);

app.post("/upload", [uploader.single("file")], context => {
  console.log("Archivo subido:", context.req.files);
  return context.json({
    message: "Archivo subido exitosamente",
    file: context.req.files,
  });
});

app.get("/home", async context => {
  const csrfToken = context.cookies["XSRF-TOKEN"];

  return context.render(
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

app.get("/test", context => {
  return context.text("holamundo");
});

app.get("/nueva-ruta", context => {
  return context.text("holamundo");
});

app.post("/test", [validateRequest(userSchema)], context => {
  const data = context.body;
  return context.json(data).setStatusCode(201);
});

app.post("/xml", context => {
  return context.json({ message: context.body });
});

app.get("/redirect", context => {
  return context.redirect("/test");
});

app.group("/tienda", tienda => {
  tienda.get("/pagina", context => {
    return context.json({ message: "desde ruta grupada" });
  });

  tienda.get("/holamundo/{param}", context => {
    return context.json({
      message: "desde ruta agrupada con parametros",
      params: context.params,
    });
  });
});

const authMiddleware = async (
  context: Context,
  next: RouteHandler,
): Promise<Response> => {
  if (context.headers["authorization"] !== "test")
    throw new UnauthorizedError("Unauthorized");
  return await next(context);
};

app.get("/middlewares", [authMiddleware], context =>
  context.json({ message: "hola" }),
);

app.post("/login", context => {
  const { username, password } = context.body;

  if (username === "admin" && password === "secret") {
    context.session.set("user", {
      id: 1,
      username: "admin",
      role: "admin",
    });

    return Response.json({ message: "Logged in" });
  }

  throw new UnauthorizedError("Invalid credentials");
});

app.get("/me", context => {
  const user = context.session.get("user");

  if (!user) throw new UnauthorizedError("Not authenticated");
  return Response.json({ user });
});

app.post("/password-hashed", async context => {
  const { password } = context.body;
  const passwordHash = await Hasher.hash(password as string);
  const verifyHash = await Hasher.verify(password as string, passwordHash);

  return Response.json({
    data: passwordHash,
    verified: verifyHash,
  }).setStatusCode(200);
});

app.get("/generate-jwt", context => {
  const token = JWT.create({ sub: "123" }, "secret-key", {
    algorithm: "HS256",
    expiresIn: "1h",
  });

  return context.json({
    token,
  });
});

app.post("/logout", context => {
  if (!context.cookies) throw new UnauthorizedError("Its not autenticate");

  context.session.destroy();

  return context.json({ message: "Logged out" }).removeCookie("test");
});

app.run(
  3000,
  () => {
    console.log("Server running in port 3000");
  },
  "0.0.0.0",
);
