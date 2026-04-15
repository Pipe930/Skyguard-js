import { createApp } from "../../src/app";
const app = createApp();

app.get("/", ctx => {
  return ctx.text("hellow world");
});

app.run();
