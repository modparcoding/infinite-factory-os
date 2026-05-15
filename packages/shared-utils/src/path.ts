import path from "node:path";

export function isSubpath(root: string, maybeChild: string): boolean {
  const relative = path.relative(root, maybeChild);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function normalizeWorkspacePath(base: string, relative: string): string {
  return path.resolve(base, relative);
}
