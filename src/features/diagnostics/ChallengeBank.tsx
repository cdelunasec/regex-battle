import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useProblems } from "@/features/problems/useProblems";
import { difficultyLabel, MATCH_MODE_LABEL } from "@/features/problems/labels";

function CaseList({ values, tone }: { values: string[]; tone: "match" | "reject" }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <li
          key={value}
          className={
            "rounded-md border px-2 py-0.5 font-mono text-xs " +
            (tone === "match"
              ? "border-success/40 bg-success/10 text-success"
              : "border-destructive/40 bg-destructive/10 text-destructive")
          }
        >
          {value === "" ? <span className="italic opacity-60">vacío</span> : value}
        </li>
      ))}
    </ul>
  );
}

/**
 * Read-only view of what actually reached the database.
 *
 * There is no Supabase CLI in this setup, the migrations are applied by the
 * hosting platform when it pulls the repo, so this screen is how we confirm a
 * migration landed: it reads `problems` with the anon key, through RLS, the
 * same way any player would.
 */
export function ChallengeBank() {
  const { problems, loading, error } = useProblems();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Banco de retos</CardTitle>
        <CardDescription>
          {loading
            ? "Cargando desde Supabase..."
            : `${problems.length} retos leídos con la anon key, pasando por las políticas de RLS.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && !error && problems.length === 0 && (
          <p className="text-sm text-muted-foreground">
            La consulta funcionó pero no devolvió filas, así que las migraciones todavía no están
            aplicadas en esta base.
          </p>
        )}

        {problems.map((problem) => (
          <div key={problem.id} className="grid gap-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{difficultyLabel(problem.difficulty)}</Badge>
              <Badge variant="outline">{MATCH_MODE_LABEL[problem.match_mode]}</Badge>
              <span className="font-mono text-xs text-muted-foreground">{problem.slug}</span>
            </div>
            <p className="text-sm">{problem.prompt}</p>
            <CaseList values={problem.must_match} tone="match" />
            <CaseList values={problem.must_not_match} tone="reject" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
