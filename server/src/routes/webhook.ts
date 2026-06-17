import { Hono } from "hono";
import { orderChannel } from "../channels/orderChannel.js";
import database from "../database";
import { eq } from "drizzle-orm";
import { orders } from "../database/schema.js";

const app = new Hono();

app.post(`/${process.env.WEBHOOK_SECRET || "webhook"}`, async (c) => {
  console.log("got webhook");
  let payload = await c.req.json();

  if (payload.event != "order.paid") return c.text("ok: done with payment");

  const id = payload.payload.order.entity.id;

  // if (body.type !== WEBHOOK_TYPE.SUCCESS)
  //   return c.text("error: payment failed");

  // // todo: update database & check key

  const order = await database.query.orders.findFirst({
    where: eq(orders.paymentRequestId, id),
    with: {
      files: true,
    },
  });

  if (!order) return c.text("error: invalid order");

  orderChannel.broadcast(order.files[0]);

  return c.text("ok: done with payment");
});

export default app;
