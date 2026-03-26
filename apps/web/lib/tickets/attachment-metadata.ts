/** Shape for inserting ticket_attachments with full metadata (storage_path remains required). */

export type TicketAttachmentInsert = {
  ticket_id: string;
  storage_path: string;
  uploaded_by?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  bucket_name?: string | null;
  checksum?: string | null;
};

export function buildTicketAttachmentRow(
  base: Pick<TicketAttachmentInsert, "ticket_id" | "storage_path">,
  meta: Partial<
    Pick<
      TicketAttachmentInsert,
      | "uploaded_by"
      | "original_filename"
      | "mime_type"
      | "file_size_bytes"
      | "bucket_name"
      | "checksum"
    >
  >
): TicketAttachmentInsert {
  return {
    ticket_id: base.ticket_id,
    storage_path: base.storage_path,
    uploaded_by: meta.uploaded_by ?? null,
    original_filename: meta.original_filename ?? null,
    mime_type: meta.mime_type ?? null,
    file_size_bytes: meta.file_size_bytes ?? null,
    bucket_name: meta.bucket_name ?? null,
    checksum: meta.checksum ?? null,
  };
}
