"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safePostLoginPath } from "@/lib/nav/safe-post-login-path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const afterLogin = safePostLoginPath(searchParams.get("next"));
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const supabase = createClient();
    if (isSignUp) {
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (err) {
        setError(err.message);
        return;
      }
      if (data?.user && !data.user.identities?.length) {
        setError("An account with this email already exists. Sign in instead.");
        return;
      }
      if (data?.user?.confirmed_at) {
        router.push("/app/today");
        router.refresh();
        return;
      }
      setMessage("Check your email to confirm your account, then sign in.");
      return;
    }
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    router.push(afterLogin);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="text-lg font-medium">{isSignUp ? "Create account" : "Sign in"}</h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            {isSignUp && (
              <p className="text-xs text-muted-foreground">At least 6 characters</p>
            )}
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="text-sm text-green-600 dark:text-green-400" role="status">
              {message}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (isSignUp ? "Creating…" : "Signing in…") : isSignUp ? "Sign up" : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account? " : "No account yet? "}
            <button
              type="button"
              className="text-primary underline underline-offset-2 hover:no-underline"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setMessage(null);
              }}
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
