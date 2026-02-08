# Framework Web en TypeScript

Framework web ligero y experimental, inspirado en **Express**, escrito completamente en **TypeScript**. El objetivo del proyecto es aprender, experimentar y construir una base sólida para un framework backend más completo en el futuro.

Actualmente, el enfoque principal está en el **manejo de rutas**, **estructura interna** y **tipado**, dejando funcionalidades avanzadas para etapas posteriores del desarrollo.

---

## 🎯 Objetivos actuales

* Proveer una base simple para registrar y manejar rutas HTTP.
* Mantener una arquitectura clara y extensible.
* Aprovechar TypeScript para mejorar la seguridad y legibilidad del código.
* Servir como proyecto de aprendizaje y evolución progresiva.

---

## ✨ Características actuales

* TypeScript first
* Registro de rutas por método HTTP
* Separación básica entre aplicación y router
* Diseño simple y fácil de extender

---

## 📦 Instalación

```bash
npm install my-framework
```

---

## 🏁 Uso básico

```ts
import { createApp } from "my-framework";
import { text } from "my-framework/helpers";

const app = createApp();

app.get("/test", () => {
  return text("Hello, World!");
});

app.listen(3000);
```

---

## 🛣️ Rutas

Las rutas se registran utilizando los metodos HTTP de la instancia app.

```ts
app.get("/test/{param}", (request: Request) => {
  return json(request.getlayerParameters());
});

app.post("/test", (request: Request) => {
  const data = request.getData();
  return json(data);
});
```
Internamente, el framework mantiene una estructura de datos para mapear métodos HTTP a sus rutas correspondientes.

## 🚀 Rutas Agrupadas

Para agrupar rutas, puedes utilizar el método `group` de la instancia app, el cual recibe como primer parametro un string con el prefijo de las rutas y como segundo parametro una función donde se registran las rutas del grupo.

```ts
app.group("/api", (group) => {
  group.get("/users", () => {
    return json({ message: "Users" });
  });
  group.get("/products", () => {
    return json({ message: "Products" });
  });
});
```

## 🛠️ Middlewares
Para registrar middlewares, tienes que crear una función que reciba como parametros un objeto `Request` y una función `next`, la cual se encarga de ejecutar el siguiente middleware o la ruta correspondiente. Luego, puedes registrar esa función como middleware global, para un grupo de rutas o para una ruta específica.

```ts
import { Request, Response } from "my-framework/http";
import { RouteHandler } from "my-framework/types";

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

// Registrar middleware globalmente
app.middlewares([authMiddleware]);

app.group("/api", (group) => {
  group.middlewares([authMiddleware]); // Registrar middleware para un grupo de rutas

  group.get("/users", () => {
    return json({ message: "Users" });
  });
  group.get("/products", () => {
    return json({ message: "Products" });
  });
});

// Registrar middleware en una ruta específica
app.get("/testMiddleware", (request: Request) =>
  json({ message: "hola" }), [authMiddleware])
```

## 📦 Validacion de datos
Para validar los datos de una petición, tenemos una clase que se llama `ValidationSchema`, la cual se utiliza para definir un esquema de validación para los datos de una petición, y luego se puede utilizar ese esquema para validar los datos de la petición.

```ts
import { ValidationSchema } from "my-framework/validation";

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

app.post("/users", (request: Request) => {
  const data = request.getData();
  const validationResult = Validator.validateOrFail(
    data as Record<string, unknown>,
    userSchema,
  );
  return json(validationResult);
});
```

## 📄 Motor de Plantillas o Vistas
Para poder utilizar el motor de plantillas del framework, debes utilizar el helper `view`, el cual recibe como primer parametro el nombre de la vista (archivo .html) y como segundo parametro un objeto con las variables que quieres pasar a la vista.

```ts
app.get("/home", () => {
  return view(
    "home", // nombre de la vista (archivo .html)
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
    }, // variables para la vista
    "main", // nombre del layout (opcional) 
  );
});
```

Por ahora el motor se encuentra en una etapa muy temprana de desarrollo, por lo que solo soporta funcionalidades básicas como:
* Renderizado de variables
* Estructuras de control (if, for)
* Layouts
* Helpers simples (uppercase, lowercase, date)
* Helpers personalizados

---

## 🧱 Estado del proyecto

⚠️ **Proyecto en desarrollo temprano**

* EL framework aún no está completo.
* No se encuentra en una versión 100% estable.
* Muchas funcionalidades aún no están implementadas.
* No se recomienda su uso en producción.

---

## 🔮 Roadmap (tentativo)

* Middlewares (✅)
* Motor de plantillas simple (✅)
* Contexto de request/response (✅)
* Validación de datos (✅)
* Manejo de errores
* ORM y bases de datos
* Autenticación y autorización
* Sessiones y cookies
* Sistema de plugins

---

## 🧠 Motivación

Este proyecto nace como una forma de entender mejor cómo funcionan frameworks como Express, Fastify o Koa, implementando sus conceptos desde cero y adaptándolos a un enfoque moderno con TypeScript.

---

## 📄 Licencia

MIT License
