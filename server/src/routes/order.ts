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
import { upiGateway } from "../services/upigateway";

const app = new Hono();
const client = new OAuth2Client();

app.post(
  "/create",
  // authMiddleware,
  zValidator("json", z.array(PrintConfig)),
  async (c) => {
    const file = c.req.valid("json")[0];

    const metadataResponse = await database.query.metadata.findFirst({
      where: eq(metadata.fileId, file.fileId),
      columns: { pages: true },
    });

    if (!metadataResponse)
      return c.json({ message: "something went wrong" }, 400);

    const amount = metadataResponse.pages * 2;

    const payment = await upiGateway.createRequest({
      amount: amount.toFixed(2),
    });

    const order = await database.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          amount,
          email: "adityadav1809@gmail.com",
          paymentRequestId: payment.id,
        })
        .returning({ id: orders.id, amount: orders.amount });

      await tx.insert(files).values({
        order: order.id,
        ...file,
      });

      return order;
    });

    return c.json({ order, payment });
  },
);

export default app;
