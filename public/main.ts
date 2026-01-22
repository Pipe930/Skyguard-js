import { Request } from "../src/http/request";
import { Response } from "../src/http/response";
import { App } from "../src/app";
import { Middleware } from "../src/http/middleware";
import { NextFunction } from "../src/utils/types";
import { Layer } from "../src/routes/layer";

const PORT = 3000;

const app = App.getInstance;

app.router.get("/test/{param}", (request: Request) => {
  return Response.json(request.getlayerParameters());
});

app.router.post("/test", (request: Request) => {
  return Response.json(request.getData());
});

app.router.get("/redirect", (request: Request) => {
  return Response.redirect("/test");
});

class AuthMiddleware implements Middleware {
  public handle(request: Request, next: NextFunction): Response {
    if (request.getHeaders["authorization"] !== "test") {
      return Response.json({
        message: "NotAuthenticated",
      }).setStatus(401);
    }

    return next(request);
  }
}

Layer.getTest(
  "/middlewares",
  (request: Request) => Response.json({ message: "hola" }),
  app,
).setMiddlewares([AuthMiddleware]);

app.listen(PORT);
