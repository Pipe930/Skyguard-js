import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type ModulePathInfo = {
  filename: string;
  dirname: string;
};

export const getModulePathInfo = (metaUrl: string): ModulePathInfo => {
  const filename = fileURLToPath(metaUrl);
  return {
    filename,
    dirname: dirname(filename),
  };
};

export const resolveFromModuleUrl = (
  metaUrl: string,
  ...segments: string[]
): string => {
  const { dirname: moduleDirname } = getModulePathInfo(metaUrl);
  return join(moduleDirname, ...segments);
};
