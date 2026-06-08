import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";

import tailwind from "bun-plugin-tailwind";
import type { BunPlugin } from "bun";

const COMPILED_DIR = ".react-compiler";

const compiledSourceAliasPlugin: BunPlugin = {
  name: "compiled-source-alias",
  setup(build) {
    build.onResolve({ filter: /^@\// }, ({ path }) => {
      return {
        path: resolveCompiledSourcePath(path),
      };
    });
  },
};

const RESOLVABLE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".json"];

await rm("dist", { recursive: true, force: true });
runReactCompiler();

const result = await Bun.build({
  entrypoints: [`./${COMPILED_DIR}/index.html`],
  outdir: "./dist",
  target: "browser",
  minify: true,
  env: "PUBLIC_*",
  define: {
    "process.env.PUBLIC_API_BASE_URL": JSON.stringify(
      process.env.PUBLIC_API_BASE_URL ?? "",
    ),
    "process.env.PUBLIC_SKIP_STARTUP_LOADING": JSON.stringify(
      process.env.PUBLIC_SKIP_STARTUP_LOADING ?? "",
    ),
    "process.env.PUBLIC_DEV_DARK_MODE": JSON.stringify(
      process.env.PUBLIC_DEV_DARK_MODE ?? "",
    ),
  },
  plugins: [compiledSourceAliasPlugin, tailwind],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }

  process.exit(1);
}

console.log(`Built ${result.outputs.length} files into dist`);

function runReactCompiler() {
  const result = spawnSync("node", ["scripts/compile-react.mjs"], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(
      "React Compiler requires Node.js to run babel-plugin-react-compiler.",
    );
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function resolveCompiledSourcePath(path: string) {
  const basePath = `${process.cwd()}/${COMPILED_DIR}/src/${path.slice(2)}`;

  if (existsSync(basePath)) {
    const stats = statSync(basePath);

    if (stats.isFile()) {
      return basePath;
    }

    if (stats.isDirectory()) {
      for (const extension of RESOLVABLE_EXTENSIONS) {
        const indexPath = `${basePath}/index${extension}`;

        if (existsSync(indexPath)) {
          return indexPath;
        }
      }
    }
  }

  for (const extension of RESOLVABLE_EXTENSIONS) {
    const filePath = `${basePath}${extension}`;

    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return basePath;
}
