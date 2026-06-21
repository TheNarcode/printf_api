import { Hono } from "hono";
import database from "../database/index.js";
import { eq } from "drizzle-orm";
import { orders, files, fcmTokens } from "../database/schema.js";
import { getMessaging } from "firebase-admin/messaging";
import { zValidator } from "@hono/zod-validator";
import z from "zod";
import { redis } from "../services/redis.js";

const app = new Hono();

app.post(`/adityalovesshinde`, async (c) => {
  let payload = await c.req.json();

  if (payload.event !== "order.paid") return c.json({ ok: true }, 200);

  const id = payload.payload.order.entity.id as string;

  const order = await database.query.orders.findFirst({
    where: eq(orders.paymentRequestId, id),
    with: {
      files: true,
    },
  });

  if (!order) return c.json({ ok: true }, 200);
  if (order.paid) return c.json({ ok: true }, 200);

  await database
    .update(orders)
    .set({ paid: true })
    .where(eq(orders.id, order.id));

  await redis.lpush("printf_queue", JSON.stringify(order.files));
  return c.json({ ok: true }, 200);
});

app.post(
  "/notify",
  zValidator("json", z.object({ id: z.string() })), // add auth
  async (c) => {
    let { id } = c.req.valid("json");

    const fileRecord = await database.query.files.findFirst({
      where: eq(files.fileId, id),
    });

    if (!fileRecord) return c.json({ ok: true });

    await database
      .update(files)
      .set({ printed: true })
      .where(eq(files.fileId, id));

    const allFiles = await database.query.files.findMany({
      where: eq(files.order, fileRecord.order),
    });

    const isAllPrinted = allFiles.every((f) => f.printed);

    if (!isAllPrinted) return c.json({ ok: true });

    await database
      .update(orders)
      .set({ status: 2 })
      .where(eq(orders.id, fileRecord.order));

    const order = await database.query.orders.findFirst({
      where: eq(orders.id, fileRecord.order),
    });

    if (!order) return c.json({ ok: true });

    const userTokens = await database.query.fcmTokens.findMany({
      where: eq(fcmTokens.email, order.email),
    });

    for (const t of userTokens) {
      try {
        await getMessaging().send({
          token: t.token,
          notification: {
            title: `🖨️ order#${order.id} completed`,
            body: "your print order is ready for pickup.",
          },
          data: {
            orderId: fileRecord.order,
            type: "print_completed",
          },
          android: {
            priority: "high",
            notification: {
              channelId: "print_updates",
              sound: "default",
            },
          },
        });
      } catch (fcmErr: any) {
        if (
          fcmErr?.code === "messaging/invalid-registration-token" ||
          fcmErr?.code === "messaging/registration-token-not-registered"
        ) {
          await database.delete(fcmTokens).where(eq(fcmTokens.id, t.id));
        } else {
          console.error(`FCM send error for ${t.email}:`, fcmErr);
        }
      }
    }
  },
);

export default app;
