import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ChallengeBank } from "@/features/diagnostics/ChallengeBank";

export const Route = createFileRoute("/_authenticated/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico — Code Battle" },
      {
        name: "description",
        content: "Qué retos hay realmente en la base de datos.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Diagnostico,
});

function Diagnostico() {
  return (
    <div className="mx-auto grid max-w-4xl gap-5 px-4 py-8">
      <ChallengeBank />
      <div>
        <Button variant="outline" asChild>
          <Link to="/">Volver</Link>
        </Button>
      </div>
    </div>
  );
}
