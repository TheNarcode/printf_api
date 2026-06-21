import { Hono } from "hono";
import orderRouter from "./routes/order.js";
import uploadRouter from "./routes/file.js";
import webhookRouter from "./routes/webhook.js";
import notificationRouter from "./routes/notification.js";

const app = new Hono();

app.route("/order", orderRouter);
app.route("/file", uploadRouter);
app.route("/webhook", webhookRouter);
app.route("/notification", notificationRouter);

app.get("/", async (c) => {
  return c.text("server up");
});

export default {
  fetch: app.fetch,
  idleTimeout: 0,
};
