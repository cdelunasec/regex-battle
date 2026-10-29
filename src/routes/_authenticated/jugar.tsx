import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DAMAGE_PER_ROUND,
  DEFAULT_DIFFICULTY,
  DEFAULT_HP,
  DEFAULT_LANGUAGE,
  DIFFICULTIES,
  LANGUAGES,
  LENGTHS,
  type DifficultyValue,
} from "@/features/battle/matchSettings";
import type { ChallengeLanguage } from "@/engine";
import { supabase } from "@/integrations/supabase/client";
import type { Room } from "@/types/game";

export const Route = createFileRoute("/_authenticated/jugar")({
  head: () => ({
    meta: [
      { title: "Jugar 1v1 — Code Battle" },
      { name: "description", content: "Crea una sala o entra con un código." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Jugar,
});

function Jugar() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"crear" | "entrar" | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<DifficultyValue>(DEFAULT_DIFFICULTY);
  const [hp, setHp] = useState(DEFAULT_HP);
  const [language, setLanguage] = useState<ChallengeLanguage>(DEFAULT_LANGUAGE);

  const chosenLanguage = LANGUAGES.find((option) => option.value === language);
  const chosenDifficulty = DIFFICULTIES.find((option) => option.value === difficulty);
  const chosenLength = LENGTHS.find((option) => option.value === hp);

  async function createRoom() {
    setBusy("crear");
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("create_room", {
      p_difficulty: difficulty,
      p_initial_hp: hp,
      p_language: language,
    });
    setBusy(null);

    if (rpcError || !data) {
      setError(rpcError?.message ?? "No se pudo crear la sala.");
      return;
    }
    void navigate({ to: "/sala/$code", params: { code: (data as Room).code } });
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    setBusy("entrar");
    setError(null);
    const trimmed = code.trim().toUpperCase();
    const { data, error: rpcError } = await supabase.rpc("join_room", { p_code: trimmed });
    setBusy(null);

    if (rpcError || !data) {
      setError(rpcError?.message ?? "No se pudo entrar a esa sala.");
      return;
    }
    void navigate({ to: "/sala/$code", params: { code: (data as Room).code } });
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
      <header className="grid gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Swords className="size-6" />
          1v1 por código
        </h1>
        <p className="text-muted-foreground">
          El mismo reto para los dos. El primero que lo resuelve le quita vida al otro, y se repite
          hasta que alguien llegue a cero. Quien crea la sala elige en qué nivel se pelea y cuánto
          dura.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crear una sala</CardTitle>
            <CardDescription>
              Tú pones las reglas y te llevas un código de seis caracteres para tu rival.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="lenguaje">Lenguaje</Label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as ChallengeLanguage)}
              >
                <SelectTrigger id="lenguaje">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{chosenLanguage?.hint}</p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="dificultad">Dificultad</Label>
              <Select
                value={difficulty}
                onValueChange={(value) => setDifficulty(value as DifficultyValue)}
              >
                <SelectTrigger id="dificultad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{chosenDifficulty?.hint}</p>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="duracion">Duración</Label>
              <Select value={String(hp)} onValueChange={(value) => setHp(Number(value))}>
                <SelectTrigger id="duracion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LENGTHS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {chosenLength?.hint} Cada quien arranca con {hp} de vida y una ronda perdida cuesta{" "}
                {DAMAGE_PER_ROUND}.
              </p>
            </div>

            <div>
              <Button onClick={createRoom} disabled={busy !== null}>
                {busy === "crear" ? "Creando..." : "Crear sala"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Entrar con un código</CardTitle>
            <CardDescription>El que te pasó quien creó la sala.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={joinRoom} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="code">Código</Label>
                <Input
                  id="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="font-mono text-lg tracking-[0.3em] uppercase"
                />
              </div>
              <Button type="submit" disabled={busy !== null || code.trim().length !== 6}>
                {busy === "entrar" ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <div>
        <Button variant="outline" asChild>
          <Link to="/">Volver</Link>
        </Button>
      </div>
    </div>
  );
}
