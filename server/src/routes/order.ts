import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import database from "../database/index.js";
import { metadata, orders, files } from "../database/schema.js";
import { eq, desc } from "drizzle-orm";
import { razorpay } from "../services/razorpay.js";
import { authMiddleware } from "../middlewares/auth.js";
import { PrintConfig } from "../types/index.js";

function getUniquePrintPageCount(range: string, totalPages: number): number {
  const trimmed = range.trim().toLowerCase();
  if (!trimmed) {
    return totalPages;
  }

  const pages = new Set<number>();

  range.split(",").forEach((part) => {
    part = part.trim();

    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        // Ensure start is at least 1 and end doesn't exceed totalPages
        const actualStart = Math.max(1, start);
        const actualEnd = Math.min(totalPages, end);
        for (let i = actualStart; i <= actualEnd; i++) {
          pages.add(i);
        }
      }
    } else {
      const pageNum = Number(part);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        pages.add(pageNum);
      }
    }
  });

  return pages.size;
}

const app = new Hono();

app.post(
  "/create",
  authMiddleware,
  zValidator("json", z.array(PrintConfig)),
  async (c) => {
    const filesData = c.req.valid("json");
    const payload = c.get("payload");

    if (!filesData || filesData.length === 0) {
      return c.json({ message: "No files provided" }, 400);
    }

    let totalAmount = 0;

    for (const file of filesData) {
      const metadataResponse = await database.query.metadata.findFirst({
        where: eq(metadata.fileId, file.fileId),
        columns: { pages: true, type: true },
      });

      if (!metadataResponse) {
        return c.json(
          { message: `Metadata missing for file ${file.fileId}` },
          400,
        );
      }

      // Treat images as having exactly 1 page, even if previously saved as 0
      const isImage = metadataResponse.type.startsWith("image/");
      const totalPages = isImage ? 1 : Math.max(1, metadataResponse.pages);

      const pageCount = getUniquePrintPageCount(
        file.pageRanges,
        totalPages,
      );

      const copies = parseInt(file.copies, 10) || 1;
      const numberUp = parseInt(file.numberUp, 10) || 1;
      const effectiveSheets = Math.ceil(pageCount / numberUp);

      totalAmount += effectiveSheets * copies * 2;
    }

    totalAmount = totalAmount * 105;

    let rp;
    try {
      rp = await razorpay.orders.create({
        amount: Math.round(totalAmount),
        currency: "INR",
        receipt: `print_${Date.now()}`,
      });
    } catch (err) {
      console.error("Razorpay order creation failed:", err);
      return c.json({ message: "Payment gateway error" }, 500);
    }

    let dbOrderId = "";

    await database.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({
          amount: totalAmount,
          email: payload.email!,
          paymentRequestId: rp.id,
        })
        .returning({ id: orders.id, amount: orders.amount });

      dbOrderId = order.id;

      for (const file of filesData) {
        await tx.insert(files).values({
          order: order.id,
          ...file,
        });
      }

      return order;
    });

    return c.json({ ...rp, localOrderId: dbOrderId });
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
  });

  return c.json(result);
});

export default app;
