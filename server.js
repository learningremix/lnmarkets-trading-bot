import compression from "compression";
import express from "express";
import morgan from "morgan";

// Short-circuit the type-checking of the built output.
const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";
const PORT = Number.parseInt(process.env.PORT || "3000");

const app = express();

app.use(compression());
app.disable("x-powered-by");

// Bootstrap trading swarm
async function bootstrapSwarm() {
  try {
    if (DEVELOPMENT) {
      // In development, dynamically import the bootstrap
      const { bootstrapTradingSwarm } = await import("./server/bootstrap.ts");
      await bootstrapTradingSwarm();
    } else {
      // In production, import from build
      const { bootstrapTradingSwarm } = await import("./build/server/bootstrap.js");
      await bootstrapTradingSwarm();
    }
  } catch (error) {
    console.error("Failed to bootstrap trading swarm:", error);
    console.log("Continuing without trading swarm...");
  }
}

if (DEVELOPMENT) {
  console.log("Starting development server");
  const viteDevServer = await import("vite").then((vite) =>
    vite.createServer({
      server: { middlewareMode: true },
    }),
  );
  app.use(viteDevServer.middlewares);
  app.use(async (req, res, next) => {
    try {
      const source = await viteDevServer.ssrLoadModule("./server/app.ts");
      return await source.app(req, res, next);
    } catch (error) {
      if (typeof error === "object" && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error);
      }
      next(error);
    }
  });
} else {
  console.log("Starting production server");
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
  );
  app.use(morgan("tiny"));
  app.use(express.static("build/client", { maxAge: "1h" }));
  app.use(await import(BUILD_PATH).then((mod) => mod.app));
}

// Start server and bootstrap swarm
app.listen(PORT, async () => {
  console.log(`\n⚡ Server is running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard\n`);
  
  // Bootstrap trading swarm after server starts
  await bootstrapSwarm();
});
