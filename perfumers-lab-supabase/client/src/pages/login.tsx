import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <form onSubmit={signIn} className="w-full max-w-sm bg-card border border-border rounded-lg p-6 space-y-3">
        <img src="./logo-full.png" alt="Drip of Infinity" className="w-40 mx-auto mb-2 opacity-90" />
        <Input type="email" autoComplete="username" placeholder="E-mail" value={email}
          onChange={e => setEmail(e.target.value)} data-testid="input-login-email" />
        <Input type="password" autoComplete="current-password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)} data-testid="input-login-password" />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !email || !password} data-testid="button-login">
          Sign in
        </Button>
      </form>
    </div>
  );
}
