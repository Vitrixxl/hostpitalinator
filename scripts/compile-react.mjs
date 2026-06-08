import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import { transformAsync } from "@babel/core";
import reactCompiler from "babel-plugin-react-compiler";

const rootDir = process.cwd();
const sourceDir = join(rootDir, "src");
const publicDir = join(rootDir, "public");
const outputDir = join(rootDir, ".react-compiler");
const outputSourceDir = join(outputDir, "src");
const transformExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputSourceDir, { recursive: true });
await cp(publicDir, join(outputDir, "public"), { recursive: true });

const indexHtml = await readFile(join(rootDir, "index.html"), "utf8");
await writeFile(join(outputDir, "index.html"), indexHtml);
await compileDirectory(sourceDir, outputSourceDir);

async function compileDirectory(inputDir, outputDir) {
  await mkdir(outputDir, { recursive: true });

  for (const entry of await readdir(inputDir, { withFileTypes: true })) {
    const inputPath = join(inputDir, entry.name);
    const outputPath = join(outputDir, entry.name);

    if (entry.isDirectory()) {
      await compileDirectory(inputPath, outputPath);
      continue;
    }

    if (entry.isFile() && transformExtensions.has(extname(entry.name))) {
      await compileSourceFile(inputPath, outputPath);
      continue;
    }

    if (entry.isFile()) {
      await cp(inputPath, outputPath);
    }
  }
}

async function compileSourceFile(inputPath, outputPath) {
  const source = await readFile(inputPath, "utf8");
  const result = await transformAsync(source, {
    babelrc: false,
    configFile: false,
    filename: relative(rootDir, inputPath),
    parserOpts: {
      plugins: ["typescript", "jsx"],
    },
    plugins: [
      [
        reactCompiler,
        {
          panicThreshold: "none",
          target: "19",
        },
      ],
    ],
  });

  await writeFile(outputPath, result?.code ?? source);
}
