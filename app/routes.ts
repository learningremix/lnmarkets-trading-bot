import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("api/status", "routes/api.status.ts"),
  route("api/market", "routes/api.market.ts"),
  route("api/positions", "routes/api.positions.ts"),
] satisfies RouteConfig;
