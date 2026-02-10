import { z } from "zod";

/** GET /api/q/resolve */
export const resolveQrQuerySchema = z.object({
  qrId: z.string().min(1, "qrId is required"),
});

/** POST /api/staff/auth */
export const staffAuthBodySchema = z.object({
  qrId: z.string().min(1, "qrId is required"),
  key: z.string().min(1, "key is required"),
  roleHint: z.enum(["hk", "eng", "sup"]).optional(),
});

/** POST /api/tasks/create (guest) */
export const tasksCreateBodySchema = z.object({
  qrId: z.string().min(1, "qrId is required"),
  requestTypeCode: z.string().min(1, "requestTypeCode is required"),
  note: z.string().max(2000).optional(),
  contact: z.string().max(200).optional(),
  deviceId: z.string().max(256).optional(), // for offline sync
});

/** GET /api/tasks/list query */
export const tasksListQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
  qrId: z.string().min(1).optional(),
  status: z.enum(["open", "assigned", "in_progress", "completed", "canceled"]).optional(),
}).refine((q) => q.locationId != null || q.qrId != null, { message: "locationId or qrId required" });

/** POST /api/tasks/event */
export const taskEventTypeSchema = z.enum(["started", "completed", "escalated", "note_added"]);
export const tasksEventBodySchema = z.object({
  taskId: z.string().uuid(),
  eventType: taskEventTypeSchema,
  note: z.string().max(2000).optional(),
  photoPath: z.string().max(500).optional(),
  qrId: z.string().min(1).optional(),
});

/** POST /api/upload/sign */
export const uploadSignBodySchema = z.object({
  taskId: z.string().uuid(),
  contentType: z.string().regex(/^image\//, "Content-Type must be image/*"),
});

export type ResolveQrQuery = z.infer<typeof resolveQrQuerySchema>;
export type StaffAuthBody = z.infer<typeof staffAuthBodySchema>;
export type TasksCreateBody = z.infer<typeof tasksCreateBodySchema>;
export type TasksListQuery = z.infer<typeof tasksListQuerySchema>;
export type TasksEventBody = z.infer<typeof tasksEventBodySchema>;
export type UploadSignBody = z.infer<typeof uploadSignBodySchema>;
