import { Hono } from "hono";
import orderRouter from "./routes/order";
import uploadRouter from "./routes/file";
import eventRouter from "./routes/event";

const app = new Hono();

app.route("/order", orderRouter);
app.route("/file", uploadRouter);
app.route("/event", eventRouter);

app.get("/", async (c) => {
  return c.text("server up");
});

export default app;
