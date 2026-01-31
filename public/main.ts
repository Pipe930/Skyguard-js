import { Request, Response, Middleware } from "../src/http";
import { App } from "../src/app";
import { NextFunction } from "../src/utils/types";
import { Layer } from "../src/routes";
import { json, redirect, text, view } from "../src/helpers";
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

app.router.get("/test/{param}", (request: Request) => {
  return json(request.getlayerParameters());
});

app.router.get("/test", (request: Request) => {
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

app.router.get("/redirect", (request: Request) => {
  return redirect("/test");
});

app.router.get("/home", (request: Request) => {
  return view(
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
  public async handle(request: Request, next: NextFunction): Promise<Response> {
    if (request.getHeaders["authorization"] !== "test") {
      return json({
        message: "NotAuthenticated",
      }).setStatus(401);
    }

    return await next(request);
  }
}

Layer.get("/middlewares", (request: Request) =>
  json({ message: "hola" }),
).setMiddlewares([AuthMiddleware]);

app.listen(PORT);
