import { Request, Response, Middleware } from "../src/http";
import { App } from "../src/app";
import { RouteHandler } from "../src/types";
import { Layer } from "../src/routing";
import { json, redirect, text, render } from "../src/helpers";
import { ValidationSchema, Validator } from "../src/validators";

const PORT = 3000;

const app = App.bootstrap();

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

app.router.get("/test/{id}/nel/{param}", (request: Request) => {
  const jsonTest = json({
    params: request.getParams(),
    queries: request.getQueryParams(),
  });
  return jsonTest;
});

app.router.get("/test", () => {
  return text("holamundo");
});

app.router.post("/test", (request: Request) => {
  const dataValid = Validator.validateOrFail(
    request.getData() as Record<string, unknown>,
    userSchema,
  );
  return json(dataValid);
});

app.router.post("/xml", (request: Request) => {
  return json({ message: request.getData() });
});

app.router.get("/redirect", () => {
  return redirect("/test");
});

app.router.get("/home", () => {
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

Layer.get("/middlewares", () => json({ message: "hola" })).setMiddlewares([
  AuthMiddleware,
]);

app.listen(PORT);
