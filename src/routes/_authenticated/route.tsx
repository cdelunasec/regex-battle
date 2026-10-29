import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Camino rápido: getSession lee la sesión de local y tarda cero. getUser
    // va al servidor de auth y tarda unos 170 ms, y esto corre en CADA
    // navegación a una ruta protegida, así que se notaba al moverse por la app.
    //
    // Usar la sesión local aquí no afloja nada. Este guardia es de experiencia
    // de uso, no de seguridad: quien protege los datos es el RLS, que valida
    // el token en el servidor en cada consulta, venga de donde venga.
    const { data: local } = await supabase.auth.getSession();
    if (local.session?.user) return { user: local.session.user };

    // Sin sesión en local, todavía puede haber un token que solo necesita
    // refrescarse. getUser lo intenta, y si tampoco hay, fuera.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
