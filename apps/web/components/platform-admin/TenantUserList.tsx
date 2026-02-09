"use client";

import { useState } from "react";
import { updateUserEmail, updateUserPassword } from "@/app/platform-admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type Profile = { user_id: string; role: string };

export function TenantUserList({
  tenantId,
  profiles,
  userEmails,
}: {
  tenantId: string;
  profiles: Profile[];
  userEmails: Record<string, string>;
}) {
  if (profiles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No users in this customer yet. Users appear here when they sign up and are assigned to this tenant.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {profiles.map((p) => (
        <UserCard
          key={p.user_id}
          userId={p.user_id}
          role={p.role}
          email={userEmails[p.user_id] ?? "(loading…)"}
        />
      ))}
    </div>
  );
}

function UserCard({
  userId,
  role,
  email,
}: {
  userId: string;
  role: string;
  email: string;
}) {
  const [emailValue, setEmailValue] = useState(email);
  const [passwordValue, setPasswordValue] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailDone, setEmailDone] = useState(false);
  const [passwordDone, setPasswordDone] = useState(false);

  async function onUpdateEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailDone(false);
    setEmailLoading(true);
    const result = await updateUserEmail(userId, emailValue);
    setEmailLoading(false);
    if (result?.error) setEmailError(result.error);
    else setEmailDone(true);
  }

  async function onUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordDone(false);
    setPasswordLoading(true);
    const result = await updateUserPassword(userId, passwordValue);
    setPasswordLoading(false);
    if (result?.error) setPasswordError(result.error);
    else {
      setPasswordDone(true);
      setPasswordValue("");
    }
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-medium">{email}</p>
            <p className="text-xs text-muted-foreground">Role: {role} · ID: {userId.slice(0, 8)}…</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <form onSubmit={onUpdateEmail} className="space-y-2">
            <Label>Change email</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="new@email.com"
              />
              <Button type="submit" size="sm" disabled={emailLoading}>
                {emailLoading ? "…" : "Update"}
              </Button>
            </div>
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            {emailDone && <p className="text-xs text-green-600">Email updated.</p>}
          </form>
          <form onSubmit={onUpdatePassword} className="space-y-2">
            <Label>Change password</Label>
            <div className="flex gap-2">
              <Input
                type="password"
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                placeholder="New password (min 6)"
                minLength={6}
              />
              <Button type="submit" size="sm" disabled={passwordLoading || !passwordValue.trim()}>
                {passwordLoading ? "…" : "Update"}
              </Button>
            </div>
            {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
            {passwordDone && <p className="text-xs text-green-600">Password updated.</p>}
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
