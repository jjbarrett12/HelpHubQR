"use client";

import { useState, useTransition } from "react";
import type { QrDestinationContent, QrDestinationType } from "@/lib/qr/types";
import { QR_DESTINATION_TYPES } from "@/lib/qr/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createQrDestination, updateQrDestination } from "@/app/app/helphub/actions/qr-hub";

const TYPE_LABEL: Record<QrDestinationType, string> = {
  checklist: "Checklist (template)",
  training: "Training",
  sop: "SOP / instructions",
  issue_report: "Issue report form",
  announcement: "Announcements",
  help: "Help / contact",
};

type Cl = { id: string; name: string };
type Loc = { id: string; name: string };

export function QrDestinationEditor({
  mode,
  checklists,
  locations,
  initial,
}: {
  mode: "create" | "edit";
  checklists: Cl[];
  locations: Loc[];
  initial?: {
    id: string;
    name: string;
    type: QrDestinationType;
    location_id: string | null;
    target_checklist_id: string | null;
    content: QrDestinationContent | null;
    is_active: boolean;
  };
}) {
  const [type, setType] = useState<QrDestinationType>(initial?.type ?? "sop");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const c = initial?.content ?? {};

  return (
    <form
      className="space-y-6 max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setMsg(null);
        startTransition(async () => {
          const action = mode === "create" ? createQrDestination : updateQrDestination;
          const res = await action(fd);
          if ("error" in res && res.error) setMsg(res.error);
          else setMsg(mode === "create" ? "Created." : "Saved.");
        });
      }}
    >
      {mode === "edit" && initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <input type="hidden" name="type" value={type} />

      <div className="space-y-2">
        <Label htmlFor="qd_name">Name</Label>
        <Input
          id="qd_name"
          name="name"
          required
          defaultValue={initial?.name ?? ""}
          placeholder="e.g. Closing duties — kitchen"
          className="bg-background/80"
        />
      </div>

      <div className="space-y-2">
        <Label>Content type</Label>
        <Select
          value={type}
          onValueChange={(v) => setType(v as QrDestinationType)}
        >
          <SelectTrigger className="bg-background/80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QR_DESTINATION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">What employees see after scanning a QR that points here.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="qd_loc">Location (optional)</Label>
        <select
          id="qd_loc"
          name="location_id"
          className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
          defaultValue={initial?.location_id ?? ""}
        >
          <option value="">Any / not set</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="qd_active">Status</Label>
        <select
          id="qd_active"
          name="is_active"
          className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
          defaultValue={initial?.is_active === false ? "false" : "true"}
        >
          <option value="true">Active</option>
          <option value="false">Inactive (scan shows not found)</option>
        </select>
      </div>

      {type === "checklist" ? (
        <div className="space-y-2">
          <Label htmlFor="qd_cl">Checklist template</Label>
          <select
            id="qd_cl"
            name="target_checklist_id"
            required
            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
            defaultValue={initial?.target_checklist_id ?? ""}
          >
            <option value="">Select…</option>
            {checklists.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Scan shows a read-only list of steps from this template (for kiosks and quick reference).
          </p>
        </div>
      ) : null}

      {type === "training" || type === "sop" || type === "help" || type === "issue_report" || type === "announcement" ? (
        <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-4">
          <p className="text-sm font-medium text-foreground">Page content</p>
          {(type === "training" || type === "sop" || type === "announcement" || type === "help" || type === "issue_report") && (
            <div className="space-y-2">
              <Label htmlFor="c_title">Title (optional)</Label>
              <Input
                id="c_title"
                name="content_title"
                defaultValue={c.title ?? ""}
                className="bg-background/80"
              />
            </div>
          )}
          {type === "issue_report" ? (
            <div className="space-y-2">
              <Label htmlFor="c_prompt">Short prompt (optional)</Label>
              <Textarea
                id="c_prompt"
                name="content_prompt"
                rows={2}
                defaultValue={c.prompt ?? ""}
                className="bg-background/80"
                placeholder="e.g. Include equipment name and location."
              />
            </div>
          ) : null}
          {(type === "training" || type === "sop" || type === "help" || type === "announcement") && (
            <div className="space-y-2">
              <Label htmlFor="c_body">
                {type === "announcement" ? "Body (optional if using list below)" : "Main text"}
              </Label>
              <Textarea
                id="c_body"
                name="content_body"
                rows={type === "sop" || type === "training" ? 10 : 4}
                defaultValue={c.body ?? ""}
                className="bg-background/80"
              />
            </div>
          )}
          {type === "training" ? (
            <div className="space-y-2">
              <Label htmlFor="c_vid">Video or resource URL (optional)</Label>
              <Input
                id="c_vid"
                name="content_videoUrl"
                type="url"
                defaultValue={c.videoUrl ?? ""}
                placeholder="https://…"
                className="bg-background/80"
              />
            </div>
          ) : null}
          {type === "announcement" ? (
            <div className="space-y-2">
              <Label htmlFor="c_items">Bullet lines (one per line)</Label>
              <Textarea
                id="c_items"
                name="content_items"
                rows={6}
                defaultValue={(c.items ?? []).join("\n")}
                className="bg-background/80"
                placeholder={"Line 1\nLine 2"}
              />
            </div>
          ) : null}
          {type === "help" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c_phone">Phone (optional)</Label>
                <Input id="c_phone" name="content_phone" defaultValue={c.phone ?? ""} className="bg-background/80" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c_email">Email (optional)</Label>
                <Input
                  id="c_email"
                  name="content_email"
                  type="email"
                  defaultValue={c.email ?? ""}
                  className="bg-background/80"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : mode === "create" ? "Create destination" : "Save changes"}
      </Button>
      {msg ? (
        <p
          className={`text-sm ${
            msg === "Created." || msg === "Saved." ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
          }`}
        >
          {msg}
        </p>
      ) : null}
    </form>
  );
}
