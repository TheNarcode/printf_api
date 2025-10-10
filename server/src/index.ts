import { serve } from "@hono/node-server";
import { Hono } from "hono";
import "dotenv/config";
import db from "./database/index.js";
import applicationRouter from "./routes/order.js";
import uploadRouter from "./routes/file.js";
import orderEvent from "./routes/event.js";
import webHook from "./routes/webhook.js";

const app = new Hono();

app.route("/application", applicationRouter);
app.route("/file", uploadRouter);
app.route("/event", orderEvent);
app.route("/webhook", webHook);

app.get("/", async (c) => {
  return c.json([]);
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
