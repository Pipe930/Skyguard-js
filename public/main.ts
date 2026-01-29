import { Request, Response, Middleware } from "../src/http";
import { App } from "../src/app";
import { NextFunction } from "../src/utils/types";
import { Layer } from "../src/routes";
import { json, redirect, text, view } from "../src/helpers";

const PORT = 3000;

const app = App.bootstrap();

app.router.get("/test/{param}", (request: Request) => {
  return json(request.getlayerParameters());
});

app.router.get("/test", (request: Request) => {
  return text("holamundo");
});

app.router.post("/test", (request: Request) => {
  return json(request.getData());
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
