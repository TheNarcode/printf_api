import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import db from "../database/index";
import { metadata, orders, files } from "../database/schema";
import { eq, desc } from "drizzle-orm";
import { razorpay } from "../services/razorpay";
import { authMiddleware } from "../middlewares/auth";
import { PrintConfig } from "../types/index";

const app = new Hono<{ Bindings: Env }>();

app.post(
  "/create",
  authMiddleware,
  zValidator("json", z.array(PrintConfig)),
  async (c) => {
    const database = db(c.env.PRINTFDB);
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

      const isColor = file.color && file.color.toLowerCase() === "color";
      let price = 0;
      if (isColor) {
        price = file.sides === "one-sided" ? 5 : 10;
      } else {
        price = file.sides === "one-sided" ? 3 : 2;
      }

      totalAmount += effectivePages * copies * price;
    }

    totalAmount = totalAmount * 105;

    const rp = await razorpay.orders.create({
      amount: Math.round(totalAmount),
      currency: "INR",
      receipt: `print_${Date.now()}`,
    });

    const orderId = crypto.randomUUID();

    const batchQueries: any[] = [
      database.insert(orders).values({
        id: orderId,
        amount: totalAmount,
        email: payload.email!,
        paymentRequestId: rp.id,
      })
    ];

    for (const file of filesData) {
      batchQueries.push(
        database.insert(files).values({
          order: orderId,
          ...file,
        })
      );
    }

    await database.batch(batchQueries as any);

    return c.json({ ...rp, localOrderId: orderId });
  },
);

app.get("/list", authMiddleware, async (c) => {
  const payload = c.get("payload");
  const database = db(c.env.PRINTFDB);

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
