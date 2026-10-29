import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, Loader2, Swords, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BattleStage } from "@/features/battle/BattleStage";
import {
  languageLabel,
  matchDifficultyLabel,
  readMatchSettings,
} from "@/features/battle/matchSettings";
import { submitRegex } from "@/features/battle/submitRegex";
import { useRoom } from "@/features/battle/useRoom";
import { RegexEditor } from "@/features/editor/RegexEditor";
import { useLiveEvaluation } from "@/features/editor/useLiveEvaluation";
import { difficultyLabel, MATCH_MODE_LABEL } from "@/features/problems/labels";
import { supabase } from "@/integrations/supabase/client";
import type { Room } from "@/types/game";

export const Route = createFileRoute("/_authenticated/sala/$code")({
  head: () => ({
    meta: [
      { title: "Sala — Code Battle" },
      { name: "description", content: "Partida 1v1 de expresiones regulares." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Sala,
});

function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid max-w-3xl gap-5 px-4 py-8">{children}</div>;
}

function Sala() {
  const { code } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { room, round, problem, status, hit } = useRoom(code);

  const [pattern, setPattern] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const result = useLiveEvaluation(pattern, problem, problem?.language);
  const solvedLocally = result?.passed ?? false;

  const isHost = room?.host_id === user.id;
  const youHp = room ? (isHost ? room.host_hp : room.guest_hp) : 100;
  const rivalHp = room ? (isHost ? room.guest_hp : room.host_hp) : 100;

  // Cada ronda nueva empieza con el campo en blanco. Se ajusta durante el
  // render y no en un efecto, porque un efecto corre DESPUÉS de pintar, y en
  // ese hueco se llegaba a evaluar el patrón de la ronda anterior contra el
  // reto nuevo, que en una carrera es justo lo que no puede pasar.
  const [shownRoundId, setShownRoundId] = useState(round?.id);
  if (round?.id !== shownRoundId) {
    setShownRoundId(round?.id);
    setPattern("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!round || sending) return;

    setSending(true);
    const outcome = await submitRegex(round.id, pattern);
    setSending(false);

    // Si ganó, el estado nuevo llega por Realtime y el escenario lo anima solo.
    if (outcome.status === "won") return;
    if (outcome.message) toast.error(outcome.message);
  }

  async function handleJoin() {
    setBusy(true);
    const { error } = await supabase.rpc("join_room", { p_code: code.toUpperCase() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    window.location.reload();
  }

  async function handleRematch() {
    setBusy(true);
    // La revancha hereda las reglas de la partida que acaba de terminar: si
    // pelearon en experta y corta, la revancha es en experta y corta.
    const settings = room ? readMatchSettings(room) : null;
    const { data, error } = await supabase.rpc("create_room", {
      p_difficulty: settings?.difficulty ?? "progresiva",
      p_initial_hp: settings?.hp ?? 100,
      p_language: settings?.language ?? "regex",
    });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "No se pudo crear la sala.");
      return;
    }
    void navigate({ to: "/sala/$code", params: { code: (data as Room).code } });
  }

  if (status === "loading") {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando la sala...
        </p>
      </Shell>
    );
  }

  if (status === "not-found") {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">No estás en esta sala</CardTitle>
            <CardDescription>
              O el código <span className="font-mono">{code.toUpperCase()}</span> no existe, o
              todavía no has entrado. Las salas solo las ven los dos que juegan.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={handleJoin} disabled={busy}>
              {busy ? "Entrando..." : "Entrar con este código"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/jugar">Volver al lobby</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (!room) {
    return (
      <Shell>
        <p className="text-sm text-destructive">No se pudo cargar la sala.</p>
      </Shell>
    );
  }

  // A partir de aquí la sala existe, así que sus ajustes se pueden leer.
  const settings = readMatchSettings(room);

  if (room.status === "waiting") {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle>Esperando rival</CardTitle>
            <CardDescription>
              Pásale este código a quien va a jugar contigo. La partida arranca sola en cuanto
              entre.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-3">
              <span className="rounded-lg border bg-muted px-5 py-3 font-mono text-3xl tracking-[0.3em]">
                {room.code}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Copiar el código"
                onClick={() => {
                  void navigator.clipboard.writeText(room.code);
                  toast.success("Código copiado");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{languageLabel(settings.language)}</Badge>
              <Badge variant="secondary">{matchDifficultyLabel(settings.difficulty)}</Badge>
              <Badge variant="outline">
                {settings.rounds} {settings.rounds === 1 ? "golpe" : "golpes"} para ganar
              </Badge>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Nadie ha entrado todavía
            </p>
            <div>
              <Button variant="ghost" asChild>
                <Link to="/jugar">Cancelar</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (room.status === "finished") {
    const youWon = room.winner_id === user.id;
    return (
      <Shell>
        <BattleStage
          youHp={youHp}
          rivalHp={rivalHp}
          youLabel="Tú"
          rivalLabel="Tu rival"
          hit={null}
          youAreHost={isHost}
          finished
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="size-5" />
              {room.winner_id === null ? "Partida terminada" : youWon ? "Ganaste" : "Perdiste"}
            </CardTitle>
            <CardDescription>
              {room.round_number > 0
                ? `${room.round_number} ${room.round_number === 1 ? "ronda jugada" : "rondas jugadas"}, quedó ${youHp} contra ${rivalHp}.`
                : "La partida terminó sin jugarse."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={handleRematch} disabled={busy}>
              {busy ? "Creando..." : "Revancha"}
            </Button>
            <Button variant="outline" asChild>
              <Link to="/jugar">Al lobby</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/">Volver al inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Swords className="size-4" />
          Ronda {room.round_number}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{room.code}</span>
      </div>

      <BattleStage
        youHp={youHp}
        rivalHp={rivalHp}
        youLabel="Tú"
        rivalLabel="Tu rival"
        hit={hit}
        youAreHost={isHost}
      />

      {!problem || !round ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando el reto...
        </p>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{difficultyLabel(problem.difficulty)}</Badge>
              <Badge variant="outline">{MATCH_MODE_LABEL[problem.match_mode]}</Badge>
            </div>
            <CardTitle className="text-lg leading-snug">{problem.prompt}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-5">
              <RegexEditor
                value={pattern}
                onChange={setPattern}
                result={result}
                matchMode={problem.match_mode}
              language={problem.language}
                focusKey={round.id}
                disabled={sending}
                autoFocus
              />

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!solvedLocally || sending}>
                  {sending ? "Enviando..." : "Disparar"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {solvedLocally
                    ? "Pasa las pruebas aquí. El servidor lo confirma."
                    : "El botón se activa cuando tu patrón pasa las dos listas."}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={async () => {
                    await supabase.rpc("leave_room", { p_room_id: room.id });
                  }}
                >
                  Abandonar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </Shell>
  );
}
