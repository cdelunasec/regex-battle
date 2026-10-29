import { useId, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de contraseña con el ojito para verla.
 *
 * Escribir una contraseña a ciegas y equivocarse es de las cosas que más
 * frustran de un formulario, sobre todo en el móvil. El botón dice en voz alta
 * si está mostrando u ocultando, porque el icono solo no lo comunica a quien
 * usa lector de pantalla.
 */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  const hintId = useId();

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        aria-describedby={visible ? hintId : undefined}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-pressed={visible}
        aria-label={visible ? "Ocultar la contraseña" : "Mostrar la contraseña"}
        title={visible ? "Ocultar" : "Mostrar"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
      {visible && (
        <span id={hintId} className="sr-only">
          La contraseña se está mostrando en pantalla.
        </span>
      )}
    </div>
  );
}
