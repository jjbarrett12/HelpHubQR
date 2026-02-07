"use client";

import { useState } from "react";
import { createSite } from "@/app/app/admin/sites/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

export function CreateSiteForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [roomCount, setRoomCount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(e.target as HTMLFormElement);
    formData.set("name", name);
    formData.set("address", address);
    formData.set("timezone", timezone);
    if (roomCount) formData.set("room_count", roomCount);
    const result = await createSite(formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setName("");
    setAddress("");
    setTimezone("UTC");
    setRoomCount("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add customer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="site-name">Facility name</Label>
            <Input
              id="site-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Downtown Hotel"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-address">Address (optional)</Label>
            <Input
              id="site-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-logo">Facility logo (optional)</Label>
            <Input
              id="site-logo"
              type="file"
              accept="image/*"
              name="logo"
              className="cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-room-count">Room / location count (optional)</Label>
            <Input
              id="site-room-count"
              type="number"
              min={0}
              name="room_count"
              value={roomCount}
              onChange={(e) => setRoomCount(e.target.value)}
              placeholder="e.g. 50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="site-timezone">Timezone</Label>
            <Input
              id="site-timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="UTC"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
