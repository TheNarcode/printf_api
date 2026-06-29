import { Hono } from "hono";
import orderRouter from "./routes/order.js";
import uploadRouter from "./routes/file.js";
import webhookRouter from "./routes/webhook.js";
import notificationRouter from "./routes/notification.js";
import db from "./database/index.js";
import { files } from "./database/schema.js";

const app = new Hono<{ Bindings: Env }>();

app.route("/order", orderRouter);
app.route("/file", uploadRouter);
app.route("/webhook", webhookRouter);
app.route("/notification", notificationRouter);

app.get("/", async (c) => {
  return c.text("ok");
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

app.get("/stats", async (c) => {
  const monthParam = c.req.query("month");
  const database = db(c.env.PRINTFDB);
  const allFiles = await database.query.files.findMany({
    with: {
      metadata: true,
      order: true,
    },
  });

  const stats = {
    "b/w single sided": { prints: 0, pages: 0 },
    "b/w double sided": { prints: 0, pages: 0 },
    "color single sided": { prints: 0, pages: 0 },
    "color double sided": { prints: 0, pages: 0 },
  };

  for (const file of allFiles) {
    if (monthParam && file.order?.createdAt) {
      const date = new Date(file.order.createdAt);
      if (!isNaN(date.getTime())) {
        const monthNum = date.getMonth() + 1;
        const yearNum = date.getFullYear();
        const monthStrPadded = monthNum.toString().padStart(2, "0");
        const yyyyMm = `${yearNum}-${monthStrPadded}`;
        const monthNameLower = date.toLocaleString("en-US", { month: "long" }).toLowerCase();
        const monthShortLower = date.toLocaleString("en-US", { month: "short" }).toLowerCase();

        const paramClean = monthParam.trim().toLowerCase();
        const paramAsNum = parseInt(paramClean, 10);

        const matches =
          yyyyMm === paramClean ||
          monthNum.toString() === paramClean ||
          monthStrPadded === paramClean ||
          paramAsNum === monthNum ||
          monthNameLower === paramClean ||
          monthShortLower === paramClean ||
          `${monthNameLower} ${yearNum}` === paramClean ||
          `${monthShortLower} ${yearNum}` === paramClean;

        if (!matches) {
          continue;
        }
      }
    }

    const isColor = file.color?.toLowerCase() === "color";
    const isSingleSided = file.sides === "one-sided";

    let groupKey: keyof typeof stats;
    if (isColor) {
      groupKey = isSingleSided ? "color single sided" : "color double sided";
    } else {
      groupKey = isSingleSided ? "b/w single sided" : "b/w double sided";
    }

    const metaPages = file.metadata?.pages || 1;
    const pageCount = getUniquePrintPageCount(file.pageRanges || "", metaPages);
    const copies = parseInt(file.copies) || 1;
    const numberUp = parseInt(file.numberUp) || 1;
    const effectivePages = Math.ceil(pageCount / numberUp);

    const group = stats[groupKey];
    group.prints += 1;
    group.pages += effectivePages * copies;
  }

  return c.json(stats);
});

export default app;
