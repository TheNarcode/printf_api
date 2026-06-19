import { relations } from "drizzle-orm";
import { sqliteTable, text, real, integer } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  amount: real("amount").notNull(),
  paymentRequestId: text("payment_request_id").notNull(),
  paid: integer("paid", { mode: "boolean" }).notNull().default(false),
  status: integer("status").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const files = sqliteTable("files", {
  fileId: text("id").primaryKey(),
  order: text("order").notNull(),
  orientation: text("orientation").notNull(),
  color: text("color").notNull(),
  copies: text("copies").notNull(),
  paperFormat: text("paper_format").notNull(),
  pageRanges: text("page_ranges").notNull(),
  numberUp: text("number_up").notNull(),
  sides: text("sides").notNull(),
  printScaling: text("print_scaling").notNull(),
  documentFormat: text("document_format").notNull(),
  printed: integer("printed", { mode: "boolean" }),
});

export const metadata = sqliteTable("metadata", {
  fileId: text("file_id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  pages: integer("pages").notNull(),
});

export const ordersRelations = relations(orders, ({ many }) => ({
  files: many(files),
}));

export const filesRelations = relations(files, ({ one }) => ({
  order: one(orders, {
    fields: [files.order],
    references: [orders.id],
  }),
  metadata: one(metadata, {
    fields: [files.fileId],
    references: [metadata.fileId],
  }),
}));
