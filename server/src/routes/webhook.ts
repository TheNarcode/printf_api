import { createResponse } from "better-sse";
import { Hono } from "hono";
import { orderChannel } from "../channels/orderChannel.js";
import { WEBHOOK_DATA, WEBHOOK_TYPE } from "../types/index.js";
import database from "../database";
import { eq } from "drizzle-orm";
// import { type } from "razorpay";
import { orders } from "../database/schema.js";

const app = new Hono();

app.post(`/${process.env.WEBHOOK_SECRET || "webhook"}`, async (c) => {
  console.log("got webhook");
  let payload = await c.req.json();

  if (payload.event != "order.paid") return c.text("ok: done with payment");

  let id = payload.payload.order.entity.id;
  console.dir(payload, { depth: 100 });

  // if (body.type !== WEBHOOK_TYPE.SUCCESS)
  //   return c.text("error: payment failed");

  // // todo: update database

  const order = await database.query.orders.findFirst({
    where: eq(orders.paymentRequestId, id),
    with: {
      files: true,
    },
  });

  console.log(order);

  if (!order) return c.text("error: invalid order");

  orderChannel.broadcast(order.files[0]);

  return c.text("ok: done with payment");
});

export default app;
