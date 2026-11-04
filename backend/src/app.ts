import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import pinoHttp from "pino-http";
import { createProxyMiddleware } from "http-proxy-middleware";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

// Number of proxy hops in front of the app (App Platform and a typical nginx setup are both 1).
const trustProxy = process.env.TRUST_PROXY?.trim();
app.set("trust proxy", trustProxy === "true" ? true : trustProxy === "false" ? false : Number(trustProxy) || 1);

// Optional header the hosting edge sets to the visitor's IP, e.g. "do-connecting-ip" on
// DigitalOcean App Platform. Only set this when every request comes through that edge.
const clientIpHeader = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
function clientIp(req: express.Request): string {
  const fromEdge = clientIpHeader ? req.get(clientIpHeader)?.split(",")[0].trim() : "";
  return fromEdge || req.ip || "unknown";
}

// The SPA is served from this same origin, so cross-origin access is off unless listed here.
const corsOrigins = (process.env.CORS_ORIGINS || "").split(",").map(o => o.trim().replace(/\/+$/, "")).filter(Boolean);

app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req: any) => {
        const url = req.url || "";
        return !url.startsWith("/api");
      },
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(cors({ origin: corsOrigins.length ? corsOrigins : false }));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(clientIp(req)),
  message: { error: "Too many requests from this IP, please try again after 15 minutes." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/2fa", authLimiter);

app.use("/api", router);

// Any /api path not matched by the router is a hard 404. Without this, in dev
// unknown /api paths fall through to the Vite proxy below, and Vite proxies
// /api back here — an infinite proxy loop that hangs requests.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

if (process.env.NODE_ENV === "development") {
  // Dev only: proxy all non-API requests to the Vite dev server (HMR, etc).
  app.use(
    "/",
    createProxyMiddleware({
      target: `http://localhost:${process.env.FRONTEND_PORT || "5000"}`,
      changeOrigin: true,
      ws: true,
    }),
  );
} else {
  // Production: serve the built frontend directly from Express so the API and
  // the SPA are served by the same server.
  const clientDist = path.resolve(__dirname, "../../frontend/dist");
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

export default app;
