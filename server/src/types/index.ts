import z from "zod";

export const PrintConfig = z.object({
  fileId: z.string(),
  name: z.string(),
  orientation: z.string(),
  color: z.string(),
  copies: z.string(),
  paperFormat: z.string(),
  pageRanges: z.string(),
  numberUp: z.string(),
  sides: z.string(),
  printScaling: z.string(),
  documentFormat: z.string(),
});

export type PrintConfigType = z.infer<typeof PrintConfig>;

export enum WEBHOOK_TYPE {
  SUCCESS = "SUCCESS", // 1
  EXPIRED = "EXPIRED", // 2
  CANCELLED = "CANCELLED", // 3
}

export type WEBHOOK_DATA = {
  type: WEBHOOK_TYPE;
  webhookId: string;
  requestId: string;
  status: number;
  timestamp: number;
};
