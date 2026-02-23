import { Request, Response } from "../src/http";
import { createApp } from "../src/app";
import { RouteHandler } from "../src/types";
import { json, redirect, text, download } from "../src/helpers";
import { validator } from "../src/validators/validationSchema";
import { join } from "node:path";
import { cors, sessions } from "../src/middlewares";
import { FileSessionStorage } from "../src/sessions";
import { hash, verify, createJWT } from "../src/crypto";
import { UnauthorizedError } from "../src/exceptions/httpExceptions";
import { authJWT } from "../src/middlewares/auth";
import { createUploader } from "../src/storage/uploader";
import { StorageType } from "../src/storage/types";

const PORT = 3000;

const app = createApp();

const uploader = createUploader({
  storageType: StorageType.DISK,
  storageOptions: {
    destination: "./uploads",
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

app.staticFiles(join(__dirname, "..", "static"));

const userSchema = validator.schema({
  name: validator.string({ maxLength: 60 }),
  email: validator.email().required(),
  age: validator.number({ min: 18 }),
  active: validator.boolean().required(),
  birthdate: validator.date({ max: new Date() }),
});

app.middlewares([
  cors({
    origin: ["http://localhost:3000/", "http://127.0.0.1:3000/"],
  }),
  sessions(FileSessionStorage),
]);

app.get("/test/{id}/nel/{param}", (request: Request) => {
  const jsonTest = json({
    params: request.params,
    queries: request.query,
  });
  return jsonTest;
});

app.post(
  "/upload",
  (request: Request) => {
    console.log("Archivo subido:", request.file);
    return json({ message: "Archivo subido exitosamente", file: request.file });
  },
  [uploader.single("file")],
);

app.get("/test", () => {
  return text("holamundo");
});

app.get("/nueva-ruta", () => {
  return text("holamundo");
});

app.post("/test", (request: Request) => {
  const validData = request.validateData(userSchema);
  return json(validData).setStatus(201);
});

app.post("/xml", (request: Request) => {
  return json({ message: request.data });
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

app.post("/password-hashed", async (request: Request) => {
  const { password } = request.data;
  const passwordHash = await hash(password as string);
  const verifyHash = await verify(password as string, passwordHash);

  return json({ data: passwordHash, verified: verifyHash }).setStatus(200);
});

app.get("/generate-jwt", () => {
  const token = createJWT(
    { id: 1, name: "Juan Pérez", role: "admin" },
    "secret-key",
    3600,
  );

  return json({
    token,
  });
});

app.get(
  "/verify-jwt",
  (request: Request) => {
    const user = request.state.user;

    return json({ user });
  },
  [authJWT("secret-key")],
);

app.post("/logout", (request: Request) => {
  request.session.destroy();
  return json({ message: "Logged out" });
});

app.run(PORT, () => {
  console.log(`Server running in port: http://localhost:${PORT}`);
});
