import { Hono } from "hono";
import { orderChannel } from "../channels/orderChannel.js";
import database from "../database/index.js";
import { eq } from "drizzle-orm";
import { orders, files, fcmTokens } from "../database/schema.js";
import { getMessaging } from "../services/fcm.js";

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
        .update(files)
        .set({ printed: true })
        .where(eq(files.fileId, fileId));

      const allOrderFiles = await database.query.files.findMany({
        where: eq(files.order, fileRecord.order),
      });

      const allPrinted = allOrderFiles.every((f) => f.printed === true);

      console.log(allPrinted);

      if (allPrinted) {
        await database
          .update(orders)
          .set({ status: 2 })
          .where(eq(orders.id, fileRecord.order));
        console.log(
          `Updated order status to 2 for order ID: ${fileRecord.order}`,
        );

        // ── Send FCM push notification to the user ──────────────────
        try {
          const order = await database.query.orders.findFirst({
            where: eq(orders.id, fileRecord.order),
          });

          if (order) {
            const userTokens = await database.query.fcmTokens.findMany({
              where: eq(fcmTokens.email, order.email),
            });

            for (const t of userTokens) {
              try {
                await getMessaging().send({
                  token: t.token,
                  notification: {
                    title: "Print Complete! 🖨️",
                    body: "Your print order is ready for pickup.",
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
                console.log(
                  `FCM sent to ${t.email} (token: ${t.token.slice(0, 10)}...)`,
                );
              } catch (fcmErr: any) {
                // If the token is invalid/expired, clean it up
                if (
                  fcmErr?.code === "messaging/invalid-registration-token" ||
                  fcmErr?.code === "messaging/registration-token-not-registered"
                ) {
                  console.warn(`Removing stale FCM token for ${t.email}`);
                  await database
                    .delete(fcmTokens)
                    .where(eq(fcmTokens.id, t.id));
                } else {
                  console.error(`FCM send error for ${t.email}:`, fcmErr);
                }
              }
            }
          }
        } catch (notifErr) {
          // Don't fail the webhook if notification fails
          console.error("Failed to send push notification:", notifErr);
        }
      } else {
        console.log(`Order ID: ${fileRecord.order} still has unprinted files.`);
      }
    } else {
      console.warn(`File ID ${fileId} not found in database`);
    }

    return c.text("ok: print completed processed");
  }

  if (payload.event !== "order.paid") return c.text("ok: unhandled event");

  const id = payload.payload.order.entity.id;

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

  orderChannel.broadcast(order.files);

  return c.text("ok: done with payment");
});

export default app;
