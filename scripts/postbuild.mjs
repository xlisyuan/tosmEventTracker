import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");
const indexPath = resolve(distDir, "index.html");
const saDir = resolve(distDir, "SA");
const saIndexPath = resolve(saDir, "index.html");

const indexContent = await readFile(indexPath, "utf8");
await mkdir(saDir, { recursive: true });
await writeFile(saIndexPath, indexContent, "utf8");
