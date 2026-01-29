import { App } from "../app";
import { Constructor } from "../utils/types";
import { Container } from "../container/container";

export function app(target: Constructor<App> = App as Constructor<App>): App {
  return Container.resolve(target);
}

export function singleton<T>(target: Constructor<T>): T {
  return Container.singleton(target);
}
