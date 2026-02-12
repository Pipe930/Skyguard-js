/**
 * Builds a normalized path by applying a prefix.
 *
 * @param path - Route path
 * @param prefix - Prefix to apply
 * @returns Normalized full path
 */
export function buildFullPath(path: string, prefix: string): string {
  if (!prefix) return path;

  const cleanPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  let fullPath = `${cleanPrefix}${cleanPath}`.replace(/\/+/g, "/");

  if (fullPath.length > 1 && fullPath.endsWith("/")) {
    fullPath = fullPath.slice(0, -1);
  }

  return fullPath;
}
