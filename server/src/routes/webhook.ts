import { Hono } from "hono";
import { orderChannel } from "../channels/orderChannel.js";
import database from "../database";
import { eq } from "drizzle-orm";
import { orders, files } from "../database/schema.js";

const app = new Hono();

app.post(`/${process.env.WEBHOOK_SECRET || "webhook"}`, async (c) => {
  console.log("got webhook");
  let payload = await c.req.json();

  if (payload.event === "print.completed") {
    const fileId = payload.id;
    console.log(`Print completed webhook received for file: ${fileId}`);

    const fileRecord = await database.query.files.findFirst({
      where: eq(files.fileId, fileId),
    });

    if (fileRecord) {
      await database
        .update(orders)
        .set({ status: 2 })
        .where(eq(orders.id, fileRecord.order));
      console.log(`Updated order status to 2 for order ID: ${fileRecord.order}`);
    } else {
      console.warn(`File ID ${fileId} not found in database`);
    }

    return c.text("ok: print completed processed");
  }

  if (payload.event !== "order.paid") return c.text("ok: unhandled event");

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

  await database
    .update(orders)
    .set({ paid: true, status: 1 })
    .where(eq(orders.id, order.id));

  orderChannel.broadcast(order.files[0]);

  return c.text("ok: done with payment");
});

export default app;
