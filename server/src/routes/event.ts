import { createResponse } from "better-sse";
import { Hono } from "hono";
import { orderChannel } from "../channels/orderChannel.js";

const app = new Hono();

app.get("/", (c) =>
  createResponse(c.req.raw, (session) => {
    orderChannel.register(session);
  }),
);

export default app;
