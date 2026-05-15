import { promises as fs } from "node:fs";
import path from "node:path";
import * as YAML from "js-yaml";

export async function readJsonOrYamlFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".yaml" || extension === ".yml") {
    return YAML.load(content) as T;
  }
  return JSON.parse(content) as T;
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}
