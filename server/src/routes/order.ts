import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import database from "../database/index";
import { metadata, orders, files } from "../database/schema";
import { eq } from "drizzle-orm";
// import { razorpay } from "../services/razorpay";
import { OAuth2Client } from "google-auth-library";
import { orderChannel } from "../channels/orderChannel";
import { authMiddleware } from "../middlewares/auth";
import { PrintConfig } from "../types/index";
import { Session } from "better-sse";
import { upgradeWebSocket } from "hono/cloudflare-workers";
import { WSContext } from "hono/ws";

const app = new Hono();
const client = new OAuth2Client();

app.post(
  "/create",
  // authMiddleware,
  zValidator("json", z.array(PrintConfig)),
  async (c) => {
    const file = c.req.valid("json")[0];
    // const user = c.get("w");

    const metadataResponse = await database.query.metadata.findFirst({
      where: eq(metadata.fileId, file.fileId),
      columns: { pages: true },
    });

    if (!metadataResponse)
      return c.json({ message: "something went wrong" }, 400);

    // // if (!metadataResponse || !user.email)
    // //   return c.json({ message: "something went wrong" });
    //

    const orderId = await database.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          name: file.name,
          amount: metadataResponse.pages * 2,
          email: "adityadav1809@gmail.com",
        })
        .returning({ id: orders.id });

      await tx.insert(files).values({
        order: order.id,
        ...file,
      });

      return order.id;
    });

    orderChannel.broadcast(file);

    // const response = await razorpay.orders.create({
    //   amount: "100",
    //   currency: "INR",
    //   receipt: "payment for print #1",
    // });

    return c.json({ orderId });
  },
);

export default app;
