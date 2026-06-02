import { rm } from "node:fs/promises";
import tailwind from "bun-plugin-tailwind";

await rm("dist", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "./dist",
  target: "browser",
  minify: true,
  env: "PUBLIC_*",
  define: {
    "process.env.PUBLIC_API_BASE_URL": JSON.stringify(
      process.env.PUBLIC_API_BASE_URL ?? "",
    ),
  },
  plugins: [tailwind],
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }

  process.exit(1);
}

console.log(`Built ${result.outputs.length} files into dist`);
