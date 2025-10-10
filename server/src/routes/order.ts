import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import db from "../database/index.js";
import { metadata, orders, files } from "../database/schema.js";
import { eq } from "drizzle-orm";
import { razorpay } from "../services/razorpay.js";
import { OAuth2Client } from "google-auth-library";
import { orderChannel } from "../channels/orderChannel.js";
import { authMiddleware } from "../middlewares/auth.js";
import { PrintConfig } from "../types/index.js";

const app = new Hono();
const client = new OAuth2Client();

app.post(
  "/create",
  authMiddleware,
  zValidator("json", PrintConfig),
  async (c) => {
    const { name, ...config } = c.req.valid("json");
    const user = c.get("payload");

    const metadataResponse = await db.query.metadata.findFirst({
      where: eq(metadata.fileId, config.fileId),
      columns: { pages: true },
    });

    if (!metadataResponse || !user.email)
      return c.json({ message: "something went wrong" });

    const [order] = await db
      .insert(orders)
      .values({ name: name, amount: 1, email: user.email })
      .returning({ id: orders.id });

    const [file] = await db
      .insert(files)
      .values({ order: order.id, ...config })
      .returning({ id: files.fileId });

    // const response = await razorpay.orders.create({
    //   amount: "100",
    //   currency: "INR",
    //   receipt: "payment for print #1",
    // });

    return c.json({ message: "order created successfully" });
  },
);

export default app;
