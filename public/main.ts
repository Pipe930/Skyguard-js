import { Request, Response, Middleware } from "../src/http";
import { createApp } from "../src/app";
import { RouteHandler } from "../src/types";
import { json, redirect, text, render } from "../src/helpers";
import { ValidationSchema, Validator } from "../src/validators";

const PORT = 3000;

const app = createApp();

const userSchema = ValidationSchema.create()
  .field("name")
  .string({ maxLength: 60 })
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

app.post("/test", (request: Request) => {
  const dataValid = Validator.validateOrFail(
    request.getData() as Record<string, unknown>,
    userSchema,
  );
  return json(dataValid);
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

app.group("/tienda", (tienda) => {
  tienda.get("/pagina", () => {
    return json({ message: "desde ruta grupada" });
  });

  tienda.get("/holamundo/{param}", (request) => {
    return json({
      message: "desde ruta agrupada con parametros",
      params: request.getParams(),
    });
  });
});

class TestMiddleware implements Middleware {
  public async handle(request: Request, next: RouteHandler): Promise<Response> {
    console.log("hola mundo");

    return await next(request);
  }
}

app.middlewares([TestMiddleware]);

class AuthMiddleware implements Middleware {
  public async handle(request: Request, next: RouteHandler): Promise<Response> {
    if (request.getHeaders["authorization"] !== "test") {
      return json({
        message: "NotAuthenticated",
      }).setStatus(401);
    }

    return await next(request);
  }
}

app
  .get("/middlewares", () => json({ message: "hola" }))
  .setMiddlewares([AuthMiddleware]);

app.listen(PORT);
