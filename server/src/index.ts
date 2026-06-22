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
  const res = await fetch(
    "https://api.github.com/repos/TheNarcode/printf_api/commits",
  );
  const commits = (await res.json()) as { sha: string }[];
  return c.text(commits[0].sha);
});

export default app;
