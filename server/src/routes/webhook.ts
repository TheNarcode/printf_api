import { createResponse } from "better-sse";
import { Hono } from "hono";
import { orderChannel } from "../channels/orderChannel.js";
import { WEBHOOK_DATA, WEBHOOK_TYPE } from "../types/index.js";
import database from "../database";
import { eq } from "drizzle-orm";
import { orders } from "../database/schema.js";

const app = new Hono();

app.post(`/${process.env.WEBHOOK_SECRET || "webhook"}`, async (c) => {
  console.log("got webhook");
  const body: WEBHOOK_DATA = await c.req.json();

  if (body.type !== WEBHOOK_TYPE.SUCCESS)
    return c.text("error: payment failed");

  // todo: update database

  const order = await database.query.orders.findFirst({
    where: eq(orders.paymentRequestId, body.requestId),
    with: {
      files: true,
    },
  });

  if (!order) return c.text("error: invalid order");

  orderChannel.broadcast(order.files[0]);

  return c.text("ok: done with payment");
});

export default app;
