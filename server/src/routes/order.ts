import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import database from "../database/index.js";
import { metadata, orders, files } from "../database/schema.js";
import { eq, desc } from "drizzle-orm";
import { razorpay } from "../services/razorpay.js";
import { authMiddleware } from "../middlewares/auth.js";
import { PrintConfig } from "../types/index.js";

const app = new Hono();

app.post(
  "/create",
  authMiddleware,
  zValidator("json", z.array(PrintConfig)),
  async (c) => {
    const filesData = c.req.valid("json");
    const payload = c.get("payload");

    if (!filesData || filesData.length === 0) return c.status(400);

    let totalAmount = 0;

    for (const file of filesData) {
      const metadataResponse = await database.query.metadata.findFirst({
        where: eq(metadata.fileId, file.fileId),
        columns: { pages: true, type: true },
      });

      if (!metadataResponse) return c.status(400);

      const pageCount = getUniquePrintPageCount(
        file.pageRanges,
        metadataResponse.pages,
      );

      const copies = parseInt(file.copies) || 1;
      const numberUp = parseInt(file.numberUp) || 1;
      const effectivePages = Math.ceil(pageCount / numberUp);
      const price = file.sides === "one-sided" ? 3 : 2; // ?

      totalAmount += effectivePages * copies * price;
    }

    totalAmount = totalAmount * 105;

    const rp = await razorpay.orders.create({
      amount: Math.round(totalAmount),
      currency: "INR",
      receipt: `print_${Date.now()}`,
    });

    let orderResponse = await database.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          amount: totalAmount,
          email: payload.email!,
          paymentRequestId: rp.id,
        })
        .returning({ id: orders.id, amount: orders.amount });

      for (const file of filesData) {
        await tx.insert(files).values({
          order: order.id,
          ...file,
        });
      }

      return order;
    });

    return c.json({ ...rp, localOrderId: orderResponse.id });
  },
);

app.get("/list", authMiddleware, async (c) => {
  const payload = c.get("payload");

  const result = await database.query.orders.findMany({
    where: eq(orders.email, payload.email!),
    orderBy: [desc(orders.createdAt)],
    with: {
      files: {
        with: {
          metadata: true,
        },
      },
    },
    limit: 5,
  });

  return c.json(result);
});

function getUniquePrintPageCount(range: string, totalPages: number): number {
  const trimmed = range.trim().toLowerCase();
  if (!trimmed) return totalPages;

  const pages = new Set<number>();

  range.split(",").forEach((part) => {
    part = part.trim();

    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          pages.add(i);
        }
      }
    } else {
      const pageNum = Number(part);
      if (!isNaN(pageNum)) {
        pages.add(pageNum);
      }
    }
  });

  return pages.size;
}

export default app;
