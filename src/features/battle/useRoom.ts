import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toProblem, type Problem, type Room, type Round } from "@/types/game";

export type RoomLoadStatus = "loading" | "ready" | "not-found" | "error";

/** Un golpe recién ocurrido, derivado del cambio de HP. */
export interface Hit {
  /** A quién se lo pegaron. */
  target: "host" | "guest";
  amount: number;
  /** Cambia en cada golpe, para que la UI pueda reaccionar sin repetirse. */
  id: number;
}

/**
 * Estado de una sala en vivo.
 *
 * Se suscribe a los cambios de fila de `rooms` y `rounds` en vez de escuchar
 * mensajes de broadcast. La diferencia es de anti-trampa: los cambios de fila
 * los emite Postgres y pasan por las mismas políticas de RLS, así que un
 * jugador no puede falsificar un golpe ni un fin de partida inyectando un
 * mensaje en el canal. Los eventos que describe la spec, el golpe y el fin de
 * partida, se derivan aquí comparando el estado nuevo con el anterior.
 */
export function useRoom(code: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [status, setStatus] = useState<RoomLoadStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [hit, setHit] = useState<Hit | null>(null);

  // Para derivar el golpe hace falta el HP anterior, y no debe provocar
  // re-render por sí mismo.
  const previousHp = useRef<{ host: number; guest: number } | null>(null);
  const hitCounter = useRef(0);

  const applyRoom = useCallback((next: Room) => {
    const before = previousHp.current;
    if (before) {
      if (next.host_hp < before.host) {
        hitCounter.current += 1;
        setHit({ target: "host", amount: before.host - next.host_hp, id: hitCounter.current });
      } else if (next.guest_hp < before.guest) {
        hitCounter.current += 1;
        setHit({ target: "guest", amount: before.guest - next.guest_hp, id: hitCounter.current });
      }
    }
    previousHp.current = { host: next.host_hp, guest: next.guest_hp };
    setRoom(next);
  }, []);

  // Carga inicial por código. RLS solo devuelve la sala si juegas en ella.
  useEffect(() => {
    let active = true;
    setStatus("loading");

    supabase
      .from("rooms")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          setError(loadError.message);
          setStatus("error");
          return;
        }
        if (!data) {
          setStatus("not-found");
          return;
        }
        applyRoom(data as Room);
        setStatus("ready");
      });

    return () => {
      active = false;
    };
  }, [code, applyRoom]);

  // Suscripción en vivo, una vez que se sabe qué sala es.
  useEffect(() => {
    if (!room?.id) return;
    const roomId = room.id;

    const channel = supabase
      .channel(`sala:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => applyRoom(payload.new as Room),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `room_id=eq.${roomId}` },
        () => {
          // La ronda concreta se relee abajo, cuando cambia round_number.
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room?.id, applyRoom]);

  // La ronda en curso y su reto se releen cuando la sala avanza.
  useEffect(() => {
    if (!room?.id || room.round_number < 1) {
      setRound(null);
      setProblem(null);
      return;
    }
    let active = true;

    async function load(roomId: string, roundNumber: number, problemId: string | null) {
      const { data: roundRow } = await supabase
        .from("rounds")
        .select("*")
        .eq("room_id", roomId)
        .eq("round_number", roundNumber)
        .maybeSingle();
      if (!active) return;
      setRound((roundRow as Round) ?? null);

      if (!problemId) {
        setProblem(null);
        return;
      }
      const { data: problemRow } = await supabase
        .from("problems")
        .select("*")
        .eq("id", problemId)
        .maybeSingle();
      if (!active) return;
      setProblem(problemRow ? toProblem(problemRow) : null);
    }

    void load(room.id, room.round_number, room.current_problem_id);
    return () => {
      active = false;
    };
  }, [room?.id, room?.round_number, room?.current_problem_id]);

  return { room, round, problem, status, error, hit };
}
