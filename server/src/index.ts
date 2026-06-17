import { Hono } from "hono";
import orderRouter from "./routes/order";
import uploadRouter from "./routes/file";
import eventRouter from "./routes/event";
import webhookRouter from "./routes/webhook";

const app = new Hono();

app.route("/order", orderRouter);
app.route("/file", uploadRouter);
app.route("/event", eventRouter);
app.route("/webhook", webhookRouter);

app.get("/", async (c) => {
  return c.text("server up");
});

export default {
  fetch: app.fetch,
  idleTimeout: 0,
};
