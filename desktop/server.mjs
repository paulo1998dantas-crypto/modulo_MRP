import path from "node:path";
import { fileURLToPath } from "node:url";
import { startProdServer } from "./vinext/dist/server/prod-server.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number.parseInt(process.env.MRP_PORT ?? "38471", 10);

await startProdServer({
  port,
  host: "127.0.0.1",
  outDir: path.join(root, "dist"),
  purpose: "MRP JI",
});
