"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Mode = "login" | "register";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);

  // login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // register fields
  const [rName, setRName] = useState("");
  const [rEmail, setREmail] = useState("");
  const [rPassword, setRPassword] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      toast.error("Invalid email or password.");
      return;
    }
    // Force a full reload to refresh server session
    window.location.reload();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!rName || !rEmail || !rPassword) {
      toast.error("Please fill all fields.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: rName, email: rEmail, password: rPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || "Registration failed.");
        setLoading(false);
        return;
      }
      // Auto-login
      const r2 = await signIn("credentials", {
        email: rEmail,
        password: rPassword,
        redirect: false,
      });
      setLoading(false);
      if (r2?.error) {
        toast.error("Account created! Please sign in.");
        setMode("login");
        setEmail(rEmail);
        return;
      }
      window.location.reload();
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-yellow-50 via-amber-100 to-yellow-200 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-6xl mb-2 inline-block animate-bounce">🍌</div>
          <h1 className="text-3xl font-bold tracking-tight text-yellow-950">Kela Tracker</h1>
          <p className="text-sm text-yellow-800 mt-1">
            Catch your friends eating kela. Real-time Among Us-style voting.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in or create an account with your email.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
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
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="rName">Name</Label>
                    <Input
                      id="rName"
                      type="text"
                      placeholder="Your name"
                      value={rName}
                      onChange={(e) => setRName(e.target.value)}
                      maxLength={40}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rEmail">Email</Label>
                    <Input
                      id="rEmail"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={rEmail}
                      onChange={(e) => setREmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rPassword">Password</Label>
                    <Input
                      id="rPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      value={rPassword}
                      onChange={(e) => setRPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-950" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-yellow-800/80 mt-4">
          Tip: open this in multiple browsers (or send to a friend) and register different accounts to test voting together.
        </p>
      </div>
    </div>
  );
}
