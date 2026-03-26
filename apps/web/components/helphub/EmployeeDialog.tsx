"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertEmployee } from "@/app/app/helphub/actions/employees";

type Location = { id: string; name: string };
type StaffRole = { id: string; name: string };

type Employee = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  location_id: string | null;
  is_active: boolean;
  auth_user_id?: string | null;
};

type Props = {
  locations: Location[];
  staffRoles: StaffRole[];
  employee?: Employee | null;
  trigger?: React.ReactNode;
};

export function EmployeeDialog({ locations, staffRoles, employee, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm">{employee ? "Edit" : "Add employee"}</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{employee ? "Edit employee" : "New employee"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            const res = await upsertEmployee(fd);
            if ("error" in res && res.error) {
              setError(res.error);
              return;
            }
            setOpen(false);
            router.refresh();
          }}
        >
          {employee ? <input type="hidden" name="id" value={employee.id} /> : null}
          <div className="space-y-1">
            <Label htmlFor="full_name">Name</Label>
            <Input
              id="full_name"
              name="full_name"
              defaultValue={employee?.full_name ?? ""}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={employee?.phone ?? ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={employee?.email ?? ""} />
          </div>
          {employee ? (
            <div className="space-y-1">
              <Label htmlFor="auth_user_id">App login user UUID (optional)</Label>
              <Input
                id="auth_user_id"
                name="auth_user_id"
                placeholder="auth.users id — enables My shifts"
                defaultValue={employee.auth_user_id ?? ""}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Same Supabase Auth user id as the staff member&apos;s login. Needed for /app/my-shifts workforce actions.
              </p>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="location_id">Location</Label>
            <select
              id="location_id"
              name="location_id"
              defaultValue={employee?.location_id ?? ""}
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">None</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          {!employee ? (
            <div className="space-y-1">
              <Label htmlFor="staff_role_id">Primary role</Label>
              <select
                id="staff_role_id"
                name="staff_role_id"
                required={staffRoles.length > 0}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                defaultValue={staffRoles[0]?.id ?? ""}
              >
                {staffRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <input type="hidden" name="is_active" value={employee?.is_active === false ? "false" : "true"} />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                defaultChecked={employee?.is_active !== false}
                onChange={(ev) => {
                  const hidden = ev.currentTarget.closest("form")?.querySelector<HTMLInputElement>('input[name="is_active"]');
                  if (hidden) hidden.value = ev.currentTarget.checked ? "true" : "false";
                }}
              />
              Active
            </label>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full">
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
