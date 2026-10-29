import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toProblems, type Problem } from "@/types/game";

interface ProblemsState {
  problems: Problem[];
  loading: boolean;
  error: string | null;
}

/**
 * Reads the challenge bank with the anon key. RLS decides what comes back, so
 * a signed out visitor gets an empty list rather than an error.
 */
export function useProblems(enabled = true) {
  const [state, setState] = useState<ProblemsState>({
    problems: [],
    loading: enabled,
    error: null,
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));

    const { data, error } = await supabase
      .from("problems")
      .select("*")
      .order("difficulty", { ascending: true })
      .order("slug", { ascending: true });

    setState({
      problems: toProblems(data ?? []),
      loading: false,
      error: error?.message ?? null,
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({ problems: [], loading: false, error: null });
      return;
    }
    void load();
  }, [enabled, load]);

  return { ...state, reload: load };
}
