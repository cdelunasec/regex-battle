/**
 * Banco de retos de KQL, el de la barra de búsqueda de Kibana.
 *
 * Un reto de KQL es un filtro: la consulta tiene que dejar pasar unos logs y
 * dejar fuera otros. Por eso el modelo de datos no cambió nada: `must_match` y
 * `must_not_match` siguen siendo listas de texto, solo que aquí cada texto es
 * un documento JSON.
 *
 * Los documentos se escriben como objetos y se serializan con `log()`, porque
 * un JSON metido a mano dentro de un string es ilegible y se llena de comillas
 * escapadas. Lo que llega a la base es el string.
 *
 * Los nombres de campo siguen el Elastic Common Schema donde tiene sentido
 * (`source.ip`, `event.outcome`, `user.name`), que es lo que se va a encontrar
 * quien abra un Kibana de verdad.
 */
import type { SeedChallenge } from "./challenges.ts";

/** Un documento de log, tal como llega al caso de prueba. */
const log = (document: Record<string, unknown>): string => JSON.stringify(document);

export const KQL_CHALLENGES: SeedChallenge[] = [
  // ------------------------------------------------------- Nivel 1: campo:valor
  {
    slug: "kql-nivel-error",
    language: "kql",
    difficulty: 1,
    match_mode: "partial",
    prompt: "Deja pasar solo los eventos cuyo campo level sea error.",
    must_match: [
      log({ level: "error", service: "auth" }),
      log({ level: "error", message: "algo se cayo" }),
      log({ level: "ERROR", service: "api" }),
    ],
    must_not_match: [
      log({ level: "warning", service: "auth" }),
      log({ level: "info", message: "todo bien" }),
      log({ service: "auth", message: "sin nivel" }),
    ],
    solution: "level:error",
  },
  {
    slug: "kql-servicio-auth",
    language: "kql",
    difficulty: 1,
    match_mode: "partial",
    prompt: "Deja pasar solo los eventos del servicio auth.",
    must_match: [
      log({ service: "auth", level: "info" }),
      log({ service: "auth", status: 200 }),
      log({ service: "auth" }),
    ],
    must_not_match: [
      log({ service: "api", level: "info" }),
      log({ service: "cron" }),
      log({ level: "error" }),
    ],
    solution: "service:auth",
  },
  {
    slug: "kql-status-404",
    language: "kql",
    difficulty: 1,
    match_mode: "partial",
    prompt: "Deja pasar solo las peticiones con código de estado 404.",
    must_match: [
      log({ status: 404, url: "/perdido" }),
      log({ status: 404, method: "GET" }),
      log({ status: 404 }),
    ],
    must_not_match: [log({ status: 200 }), log({ status: 500 }), log({ url: "/perdido" })],
    solution: "status:404",
  },
  {
    slug: "kql-usuario-admin",
    language: "kql",
    difficulty: 1,
    match_mode: "partial",
    prompt: "Deja pasar los eventos del usuario admin. El campo está anidado en user.",
    must_match: [
      log({ user: { name: "admin" }, service: "ssh" }),
      log({ user: { name: "Admin" } }),
      log({ user: { name: "admin", id: 1 } }),
    ],
    must_not_match: [
      log({ user: { name: "juan" } }),
      log({ name: "admin" }),
      log({ service: "ssh" }),
    ],
    solution: "user.name:admin",
  },
  {
    slug: "kql-ip-origen",
    language: "kql",
    difficulty: 1,
    match_mode: "partial",
    prompt: "Deja pasar los eventos que vienen de la dirección 10.0.0.5.",
    must_match: [
      log({ source: { ip: "10.0.0.5" } }),
      log({ source: { ip: "10.0.0.5", port: 22 } }),
      log({ source: { ip: "10.0.0.5" }, level: "warning" }),
    ],
    must_not_match: [
      log({ source: { ip: "10.0.0.6" } }),
      log({ source: { ip: "192.168.1.5" } }),
      log({ destination: { ip: "10.0.0.5" } }),
    ],
    solution: "source.ip:10.0.0.5",
  },
  {
    slug: "kql-metodo-post",
    language: "kql",
    difficulty: 1,
    match_mode: "partial",
    prompt: "Deja pasar solo las peticiones hechas con el método POST.",
    must_match: [
      log({ http: { method: "POST" }, status: 200 }),
      log({ http: { method: "post" } }),
      log({ http: { method: "POST", version: "1.1" } }),
    ],
    must_not_match: [
      log({ http: { method: "GET" } }),
      log({ http: { method: "PUT" } }),
      log({ method: "POST" }),
    ],
    solution: "http.method:POST",
  },
  {
    slug: "kql-puerto-22",
    language: "kql",
    difficulty: 1,
    match_mode: "partial",
    prompt: "Deja pasar las conexiones al puerto 22, el de SSH.",
    must_match: [
      log({ destination: { port: 22 } }),
      log({ destination: { port: 22 }, service: "ssh" }),
      log({ destination: { port: 22, ip: "10.0.0.1" } }),
    ],
    must_not_match: [
      log({ destination: { port: 80 } }),
      log({ destination: { port: 2222 } }),
      log({ source: { port: 22 } }),
    ],
    solution: "destination.port:22",
  },
  {
    slug: "kql-accion-denegada",
    language: "kql",
    difficulty: 1,
    match_mode: "partial",
    prompt: "Deja pasar los eventos donde la acción terminó denegada.",
    must_match: [
      log({ action: "denied", service: "firewall" }),
      log({ action: "DENIED" }),
      log({ action: "denied", source: { ip: "1.2.3.4" } }),
    ],
    must_not_match: [
      log({ action: "allowed" }),
      log({ action: "accept" }),
      log({ service: "firewall" }),
    ],
    solution: "action:denied",
  },
  {
    slug: "kql-etiqueta-ssh",
    language: "kql",
    difficulty: 1,
    match_mode: "partial",
    prompt: "Deja pasar los eventos etiquetados como ssh. Ojo que tags trae varias etiquetas.",
    must_match: [
      log({ tags: ["ssh"] }),
      log({ tags: ["auth", "ssh"] }),
      log({ tags: ["ssh", "produccion"], level: "info" }),
    ],
    must_not_match: [
      log({ tags: ["http"] }),
      log({ tags: ["auth", "vpn"] }),
      log({ level: "info" }),
    ],
    solution: "tags:ssh",
  },
  {
    slug: "kql-pais-origen",
    language: "kql",
    difficulty: 1,
    match_mode: "partial",
    prompt: "Deja pasar los eventos que vienen de República Dominicana, con el código de país DO.",
    must_match: [
      log({ source: { geo: { country: "DO" } } }),
      log({ source: { geo: { country: "do" } } }),
      log({ source: { geo: { country: "DO", city: "Santo Domingo" } } }),
    ],
    must_not_match: [
      log({ source: { geo: { country: "US" } } }),
      log({ source: { geo: { country: "ES" } } }),
      log({ source: { ip: "1.2.3.4" } }),
    ],
    solution: "source.geo.country:DO",
  },

  // --------------------------------------------- Nivel 2: existencia y lógica
  {
    slug: "kql-error-en-auth",
    language: "kql",
    difficulty: 2,
    match_mode: "partial",
    prompt: "Deja pasar solo los errores del servicio auth. Las dos condiciones a la vez.",
    must_match: [
      log({ level: "error", service: "auth" }),
      log({ level: "error", service: "auth", status: 401 }),
      log({ service: "auth", level: "error", user: { name: "x" } }),
    ],
    must_not_match: [
      log({ level: "error", service: "api" }),
      log({ level: "info", service: "auth" }),
      log({ service: "auth" }),
    ],
    solution: "level:error and service:auth",
  },
  {
    slug: "kql-error-o-aviso",
    language: "kql",
    difficulty: 2,
    match_mode: "partial",
    prompt: "Deja pasar los eventos de nivel error o warning, y ninguno más.",
    must_match: [log({ level: "error" }), log({ level: "warning" }), log({ level: "WARNING" })],
    must_not_match: [log({ level: "info" }), log({ level: "debug" }), log({ service: "auth" })],
    solution: "level:(error or warning)",
  },
  {
    slug: "kql-todo-menos-info",
    language: "kql",
    difficulty: 2,
    match_mode: "partial",
    prompt: "Deja pasar todo lo que NO sea de nivel info.",
    must_match: [log({ level: "error" }), log({ level: "debug" }), log({ service: "auth" })],
    must_not_match: [
      log({ level: "info" }),
      log({ level: "info", service: "api" }),
      log({ level: "INFO" }),
    ],
    solution: "not level:info",
  },
  {
    slug: "kql-tiene-usuario",
    language: "kql",
    difficulty: 2,
    match_mode: "partial",
    prompt: "Deja pasar los eventos que traen usuario, sea cual sea. Los que no lo traen, fuera.",
    must_match: [
      log({ user: { name: "admin" } }),
      log({ user: { name: "juan" }, level: "info" }),
      log({ user: { name: "servicio" } }),
    ],
    must_not_match: [
      log({ level: "info" }),
      log({ user: { name: null } }),
      log({ service: "cron", status: 200 }),
    ],
    solution: "user.name:*",
  },
  {
    slug: "kql-401-o-403",
    language: "kql",
    difficulty: 2,
    match_mode: "partial",
    prompt: "Deja pasar las peticiones rechazadas por permisos: código 401 o 403.",
    must_match: [log({ status: 401 }), log({ status: 403 }), log({ status: 403, url: "/admin" })],
    must_not_match: [log({ status: 200 }), log({ status: 404 }), log({ status: 500 })],
    solution: "status:(401 or 403)",
  },
  {
    slug: "kql-denegado-en-auth",
    language: "kql",
    difficulty: 2,
    match_mode: "partial",
    prompt: "Deja pasar los intentos denegados que además vengan del servicio auth.",
    must_match: [
      log({ service: "auth", action: "denied" }),
      log({ action: "denied", service: "auth", status: 401 }),
      log({ service: "auth", action: "DENIED" }),
    ],
    must_not_match: [
      log({ service: "auth", action: "allowed" }),
      log({ service: "vpn", action: "denied" }),
      log({ action: "denied" }),
    ],
    solution: "service:auth and action:denied",
  },
  {
    slug: "kql-fuera-las-pruebas",
    language: "kql",
    difficulty: 2,
    match_mode: "partial",
    prompt: "Deja fuera todo lo etiquetado como test. Lo demás pasa.",
    must_match: [
      log({ tags: ["produccion"] }),
      log({ level: "error", tags: ["auth"] }),
      log({ level: "info" }),
    ],
    must_not_match: [
      log({ tags: ["test"] }),
      log({ tags: ["auth", "test"] }),
      log({ level: "error", tags: ["test"] }),
    ],
    solution: "not tags:test",
  },
  {
    slug: "kql-tiene-codigo-de-error",
    language: "kql",
    difficulty: 2,
    match_mode: "partial",
    prompt: "Deja pasar los eventos que traen un código de error dentro de error.code.",
    must_match: [
      log({ error: { code: "E42" } }),
      log({ error: { code: 500 } }),
      log({ error: { code: "TIMEOUT" }, level: "error" }),
    ],
    must_not_match: [
      log({ error: { message: "algo" } }),
      log({ level: "error" }),
      log({ error: { code: null } }),
    ],
    solution: "error.code:*",
  },
  {
    slug: "kql-error-menos-cron",
    language: "kql",
    difficulty: 2,
    match_mode: "partial",
    prompt: "Deja pasar los errores de cualquier servicio menos los del cron, que son ruido.",
    must_match: [
      log({ level: "error", service: "auth" }),
      log({ level: "error", service: "api" }),
      log({ level: "error" }),
    ],
    must_not_match: [
      log({ level: "error", service: "cron" }),
      log({ level: "info", service: "auth" }),
      log({ service: "cron" }),
    ],
    solution: "level:error and not service:cron",
  },
  {
    slug: "kql-auth-con-usuario",
    language: "kql",
    difficulty: 2,
    match_mode: "partial",
    prompt: "Deja pasar los eventos de auth que además identifiquen al usuario.",
    must_match: [
      log({ service: "auth", user: { name: "admin" } }),
      log({ service: "auth", user: { name: "juan" }, status: 200 }),
      log({ service: "auth", user: { name: "root" } }),
    ],
    must_not_match: [
      log({ service: "auth" }),
      log({ service: "api", user: { name: "admin" } }),
      log({ service: "auth", user: { id: 7 } }),
    ],
    solution: "service:auth and user.name:*",
  },

  // ------------------------------------------- Nivel 3: comodines y rangos
  {
    slug: "kql-mensaje-password",
    language: "kql",
    difficulty: 3,
    match_mode: "partial",
    prompt: "Deja pasar los eventos cuyo mensaje mencione password en cualquier parte.",
    must_match: [
      log({ message: "Failed password for root" }),
      log({ message: "password changed" }),
      log({ message: "invalid PASSWORD attempt" }),
    ],
    must_not_match: [
      log({ message: "Accepted publickey for root" }),
      log({ message: "session opened" }),
      log({ level: "error" }),
    ],
    solution: "message:*password*",
  },
  {
    slug: "kql-peticiones-fallidas",
    language: "kql",
    difficulty: 3,
    match_mode: "partial",
    prompt: "Deja pasar las peticiones con código de estado 400 o mayor.",
    must_match: [log({ status: 400 }), log({ status: 404 }), log({ status: 503 })],
    must_not_match: [log({ status: 200 }), log({ status: 301 }), log({ status: 399 })],
    solution: "status >= 400",
  },
  {
    slug: "kql-red-interna",
    language: "kql",
    difficulty: 3,
    match_mode: "partial",
    prompt: "Deja pasar los eventos que vienen de la red 10.0.0, sea cual sea el último número.",
    must_match: [
      log({ source: { ip: "10.0.0.1" } }),
      log({ source: { ip: "10.0.0.254" } }),
      log({ source: { ip: "10.0.0.42" } }),
    ],
    must_not_match: [
      log({ source: { ip: "10.0.1.1" } }),
      log({ source: { ip: "192.168.0.1" } }),
      log({ source: { ip: "110.0.0.1" } }),
    ],
    solution: "source.ip:10.0.0.*",
  },
  {
    slug: "kql-error-de-servidor",
    language: "kql",
    difficulty: 3,
    match_mode: "partial",
    prompt: "Deja pasar solo los errores del servidor, o sea de 500 para arriba.",
    must_match: [log({ status: 500 }), log({ status: 502 }), log({ status: 599 })],
    must_not_match: [log({ status: 499 }), log({ status: 404 }), log({ status: 200 })],
    solution: "status >= 500",
  },
  {
    slug: "kql-usuarios-adm",
    language: "kql",
    difficulty: 3,
    match_mode: "partial",
    prompt: "Deja pasar los usuarios cuyo nombre empiece con adm.",
    must_match: [
      log({ user: { name: "admin" } }),
      log({ user: { name: "admin2" } }),
      log({ user: { name: "administrador" } }),
    ],
    must_not_match: [
      log({ user: { name: "juan" } }),
      log({ user: { name: "superadmin" } }),
      log({ user: { name: "ad" } }),
    ],
    solution: "user.name:adm*",
  },
  {
    slug: "kql-puertos-privilegiados",
    language: "kql",
    difficulty: 3,
    match_mode: "partial",
    prompt: "Deja pasar las conexiones a puertos privilegiados, o sea del 1024 para abajo.",
    must_match: [
      log({ destination: { port: 22 } }),
      log({ destination: { port: 443 } }),
      log({ destination: { port: 1024 } }),
    ],
    must_not_match: [
      log({ destination: { port: 1025 } }),
      log({ destination: { port: 8080 } }),
      log({ destination: { port: 49152 } }),
    ],
    solution: "destination.port <= 1024",
  },
  {
    slug: "kql-algo-fallo",
    language: "kql",
    difficulty: 3,
    match_mode: "partial",
    prompt: "Deja pasar los eventos cuyo mensaje contenga la palabra failed.",
    must_match: [
      log({ message: "Failed password for admin" }),
      log({ message: "connection failed" }),
      log({ message: "FAILED to start service" }),
    ],
    must_not_match: [
      log({ message: "connection established" }),
      log({ message: "fail" }),
      log({ message: "service started" }),
    ],
    solution: "message:*failed*",
  },
  {
    slug: "kql-maquinas-de-produccion",
    language: "kql",
    difficulty: 3,
    match_mode: "partial",
    prompt: "Deja pasar los eventos de máquinas cuyo nombre contenga prod.",
    must_match: [
      log({ host: { name: "web-prod-01" } }),
      log({ host: { name: "prod-db" } }),
      log({ host: { name: "api-PROD" } }),
    ],
    must_not_match: [
      log({ host: { name: "web-dev-01" } }),
      log({ host: { name: "staging" } }),
      log({ host: { ip: "10.0.0.1" } }),
    ],
    solution: "host.name:*prod*",
  },
  {
    slug: "kql-transferencia-grande",
    language: "kql",
    difficulty: 3,
    match_mode: "partial",
    prompt: "Deja pasar las conexiones que movieron más de un millón de bytes.",
    must_match: [
      log({ network: { bytes: 1000001 } }),
      log({ network: { bytes: 50000000 } }),
      log({ network: { bytes: 2000000 } }),
    ],
    must_not_match: [
      log({ network: { bytes: 1000000 } }),
      log({ network: { bytes: 512 } }),
      log({ network: { packets: 9999999 } }),
    ],
    solution: "network.bytes > 1000000",
  },
  {
    slug: "kql-desde-una-fecha",
    language: "kql",
    difficulty: 3,
    match_mode: "partial",
    prompt: "Deja pasar los eventos del 30 de agosto de 2026 en adelante.",
    must_match: [
      log({ "@timestamp": "2026-08-30T00:00:00Z" }),
      log({ "@timestamp": "2026-08-31T12:00:00Z" }),
      log({ "@timestamp": "2026-12-01T08:30:00Z" }),
    ],
    must_not_match: [
      log({ "@timestamp": "2026-08-29T23:59:59Z" }),
      log({ "@timestamp": "2025-01-01T00:00:00Z" }),
      log({ level: "error" }),
    ],
    solution: '@timestamp >= "2026-08-30T00:00:00Z"',
  },

  // ------------------------------------------ Nivel 4: combinaciones con peso
  {
    slug: "kql-graves-en-auth",
    language: "kql",
    difficulty: 4,
    match_mode: "partial",
    prompt: "Deja pasar los eventos graves (error o critical) que vengan del servicio auth.",
    must_match: [
      log({ level: "error", service: "auth" }),
      log({ level: "critical", service: "auth" }),
      log({ level: "CRITICAL", service: "auth", status: 500 }),
    ],
    must_not_match: [
      log({ level: "warning", service: "auth" }),
      log({ level: "error", service: "api" }),
      log({ level: "critical", service: "cron" }),
    ],
    solution: "level:(error or critical) and service:auth",
  },
  {
    slug: "kql-fallos-sin-404",
    language: "kql",
    difficulty: 4,
    match_mode: "partial",
    prompt: "Deja pasar los fallos de 400 para arriba, pero quita los 404 que son puro ruido.",
    must_match: [log({ status: 401 }), log({ status: 500 }), log({ status: 403 })],
    must_not_match: [log({ status: 404 }), log({ status: 200 }), log({ status: 302 })],
    solution: "status >= 400 and not status:404",
  },
  {
    slug: "kql-interna-menos-el-gateway",
    language: "kql",
    difficulty: 4,
    match_mode: "partial",
    prompt: "Deja pasar el tráfico de la red 10.0.0 menos el que viene del gateway, el 10.0.0.1.",
    must_match: [
      log({ source: { ip: "10.0.0.2" } }),
      log({ source: { ip: "10.0.0.50" } }),
      log({ source: { ip: "10.0.0.200" } }),
    ],
    must_not_match: [
      log({ source: { ip: "10.0.0.1" } }),
      log({ source: { ip: "192.168.1.2" } }),
      log({ destination: { ip: "10.0.0.2" } }),
    ],
    solution: "source.ip:10.0.0.* and not source.ip:10.0.0.1",
  },
  {
    slug: "kql-accesos-denegados",
    language: "kql",
    difficulty: 4,
    match_mode: "partial",
    prompt: "Deja pasar los accesos denegados que vengan de auth o de vpn, y de ningún otro sitio.",
    must_match: [
      log({ service: "auth", action: "denied" }),
      log({ service: "vpn", action: "denied" }),
      log({ service: "VPN", action: "DENIED" }),
    ],
    must_not_match: [
      log({ service: "firewall", action: "denied" }),
      log({ service: "auth", action: "allowed" }),
      log({ service: "vpn" }),
    ],
    solution: "service:(auth or vpn) and action:denied",
  },
  {
    slug: "kql-fallo-con-usuario",
    language: "kql",
    difficulty: 4,
    match_mode: "partial",
    prompt: "Deja pasar los mensajes con failed que además digan de qué usuario se trata.",
    must_match: [
      log({ message: "Failed password", user: { name: "root" } }),
      log({ message: "login failed", user: { name: "admin" } }),
      log({ message: "FAILED", user: { name: "x" } }),
    ],
    must_not_match: [
      log({ message: "Failed password" }),
      log({ message: "login ok", user: { name: "root" } }),
      log({ user: { name: "root" } }),
    ],
    solution: "message:*failed* and user.name:*",
  },
  {
    slug: "kql-caidas-y-saturacion",
    language: "kql",
    difficulty: 4,
    match_mode: "partial",
    prompt:
      "Deja pasar los errores de servidor (500 o más) y también los 403 que vengan del servicio api.",
    must_match: [
      log({ status: 500 }),
      log({ status: 503, service: "web" }),
      log({ status: 403, service: "api" }),
    ],
    must_not_match: [
      log({ status: 403, service: "web" }),
      log({ status: 404, service: "api" }),
      log({ status: 200, service: "api" }),
    ],
    solution: "status >= 500 or (status:403 and service:api)",
  },
  {
    slug: "kql-quitar-el-ruido",
    language: "kql",
    difficulty: 4,
    match_mode: "partial",
    prompt: "Deja fuera lo de nivel info y lo de nivel debug de una sola vez. Lo demás pasa.",
    must_match: [log({ level: "error" }), log({ level: "warning" }), log({ level: "critical" })],
    must_not_match: [log({ level: "info" }), log({ level: "debug" }), log({ level: "DEBUG" })],
    solution: "not level:(info or debug)",
  },
  {
    slug: "kql-ssh-autenticado",
    language: "kql",
    difficulty: 4,
    match_mode: "partial",
    prompt: "Deja pasar los eventos que traigan las dos etiquetas a la vez: ssh y auth.",
    must_match: [
      log({ tags: ["ssh", "auth"] }),
      log({ tags: ["auth", "ssh", "produccion"] }),
      log({ tags: ["ssh", "auth"], level: "error" }),
    ],
    must_not_match: [
      log({ tags: ["ssh"] }),
      log({ tags: ["auth"] }),
      log({ tags: ["http", "auth"] }),
    ],
    solution: "tags:(ssh and auth)",
  },
  {
    slug: "kql-descarga-sospechosa",
    language: "kql",
    difficulty: 4,
    match_mode: "partial",
    prompt:
      "Deja pasar las transferencias de más de un millón de bytes que no sean del usuario backup.",
    must_match: [
      log({ network: { bytes: 5000000 }, user: { name: "juan" } }),
      log({ network: { bytes: 2000000 } }),
      log({ network: { bytes: 9000000 }, user: { name: "admin" } }),
    ],
    must_not_match: [
      log({ network: { bytes: 5000000 }, user: { name: "backup" } }),
      log({ network: { bytes: 100 }, user: { name: "juan" } }),
      log({ user: { name: "juan" } }),
    ],
    solution: "network.bytes > 1000000 and not user.name:backup",
  },
  {
    slug: "kql-fallo-con-origen",
    language: "kql",
    difficulty: 4,
    match_mode: "partial",
    prompt: "Deja pasar los intentos que fallaron y de los que además se sabe la IP de origen.",
    must_match: [
      log({ event: { outcome: "failure" }, source: { ip: "1.2.3.4" } }),
      log({ event: { outcome: "failure" }, source: { ip: "10.0.0.1" } }),
      log({ event: { outcome: "FAILURE" }, source: { ip: "8.8.8.8" } }),
    ],
    must_not_match: [
      log({ event: { outcome: "failure" } }),
      log({ event: { outcome: "success" }, source: { ip: "1.2.3.4" } }),
      log({ source: { ip: "1.2.3.4" } }),
    ],
    solution: "event.outcome:failure and source.ip:*",
  },

  // ------------------------------------------------ Nivel 5: caza de verdad
  {
    slug: "kql-fuerza-bruta",
    language: "kql",
    difficulty: 5,
    match_mode: "partial",
    prompt:
      "Caza intentos de fuerza bruta: autenticación fallida, con IP de origen conocida, y que el usuario no sea una cuenta de servicio (service ni backup).",
    must_match: [
      log({
        event: { category: "authentication", outcome: "failure" },
        source: { ip: "1.2.3.4" },
        user: { name: "admin" },
      }),
      log({
        event: { category: "authentication", outcome: "failure" },
        source: { ip: "5.6.7.8" },
        user: { name: "root" },
      }),
      log({
        event: { category: "authentication", outcome: "failure" },
        source: { ip: "9.9.9.9" },
      }),
    ],
    must_not_match: [
      log({
        event: { category: "authentication", outcome: "failure" },
        source: { ip: "1.2.3.4" },
        user: { name: "backup" },
      }),
      log({
        event: { category: "authentication", outcome: "success" },
        source: { ip: "1.2.3.4" },
        user: { name: "admin" },
      }),
      log({ event: { category: "network", outcome: "failure" }, source: { ip: "1.2.3.4" } }),
    ],
    solution:
      "event.category:authentication and event.outcome:failure and source.ip:* and not user.name:(service or backup)",
  },
  {
    slug: "kql-caidas-sin-sondas",
    language: "kql",
    difficulty: 5,
    match_mode: "partial",
    prompt:
      "Deja pasar las caídas (500 o más) y las peticiones rechazadas por exceso (429), pero quita las de la ruta de salud, que las hace el monitor.",
    must_match: [
      log({ status: 500, url: { path: "/api/usuarios" } }),
      log({ status: 429, url: { path: "/api/login" } }),
      log({ status: 503, url: { path: "/" } }),
    ],
    must_not_match: [
      log({ status: 500, url: { path: "/health" } }),
      log({ status: 429, url: { path: "/api/health" } }),
      log({ status: 200, url: { path: "/api/usuarios" } }),
    ],
    solution: "status:(500 or 503 or 429) and not url.path:*health*",
  },
  {
    slug: "kql-exfiltracion",
    language: "kql",
    difficulty: 5,
    match_mode: "partial",
    prompt:
      "Caza posible exfiltración: tráfico de salida de más de diez millones de bytes hacia un dominio que no sea de la empresa.",
    must_match: [
      log({
        network: { direction: "outbound", bytes: 50000000 },
        destination: { domain: "pastebin.com" },
      }),
      log({
        network: { direction: "outbound", bytes: 11000000 },
        destination: { domain: "drive.google.com" },
      }),
      log({ network: { direction: "outbound", bytes: 90000000 }, destination: { domain: "x.io" } }),
    ],
    must_not_match: [
      log({
        network: { direction: "outbound", bytes: 50000000 },
        destination: { domain: "backup.empresa.com" },
      }),
      log({
        network: { direction: "inbound", bytes: 50000000 },
        destination: { domain: "pastebin.com" },
      }),
      log({
        network: { direction: "outbound", bytes: 1000 },
        destination: { domain: "pastebin.com" },
      }),
    ],
    solution:
      "network.direction:outbound and network.bytes > 10000000 and not destination.domain:*empresa.com",
  },
  {
    slug: "kql-escritorio-remoto",
    language: "kql",
    difficulty: 5,
    match_mode: "partial",
    prompt:
      "Caza inicios de sesión por escritorio remoto (tipo 10) de usuarios de persona, dejando fuera las cuentas de máquina, que terminan en signo de peso.",
    must_match: [
      log({ event: { action: "logon" }, winlog: { logon: { type: 10 } }, user: { name: "juan" } }),
      log({ event: { action: "logon" }, winlog: { logon: { type: 10 } }, user: { name: "admin" } }),
      log({
        event: { action: "logon" },
        winlog: { logon: { type: 10 } },
        user: { name: "soporte" },
      }),
    ],
    must_not_match: [
      log({ event: { action: "logon" }, winlog: { logon: { type: 10 } }, user: { name: "PC01$" } }),
      log({ event: { action: "logon" }, winlog: { logon: { type: 2 } }, user: { name: "juan" } }),
      log({ event: { action: "logoff" }, winlog: { logon: { type: 10 } }, user: { name: "juan" } }),
    ],
    solution: "event.action:logon and winlog.logon.type:10 and not user.name:*$",
  },
  {
    slug: "kql-powershell-codificado",
    language: "kql",
    difficulty: 5,
    match_mode: "partial",
    prompt:
      "Caza consolas de Windows (powershell.exe o cmd.exe) arrancadas con argumentos codificados, o sea que lleven -enc.",
    must_match: [
      log({ process: { name: "powershell.exe", args: "-enc SQBFAFgA" } }),
      log({ process: { name: "cmd.exe", args: "/c powershell -enc abc" } }),
      log({ process: { name: "POWERSHELL.EXE", args: "-EncodedCommand -enc x" } }),
    ],
    must_not_match: [
      log({ process: { name: "powershell.exe", args: "-File script.ps1" } }),
      log({ process: { name: "notepad.exe", args: "-enc algo" } }),
      log({ process: { name: "cmd.exe" } }),
    ],
    solution: "process.name:(powershell.exe or cmd.exe) and process.args:*-enc*",
  },
  {
    slug: "kql-ventana-de-tiempo",
    language: "kql",
    difficulty: 5,
    match_mode: "partial",
    prompt:
      "Deja pasar solo los errores ocurridos durante el 30 de agosto de 2026, ni antes ni después.",
    must_match: [
      log({ "@timestamp": "2026-08-30T00:00:00Z", level: "error" }),
      log({ "@timestamp": "2026-08-30T13:45:00Z", level: "error" }),
      log({ "@timestamp": "2026-08-30T23:59:59Z", level: "error" }),
    ],
    must_not_match: [
      log({ "@timestamp": "2026-08-31T00:00:00Z", level: "error" }),
      log({ "@timestamp": "2026-08-29T23:59:59Z", level: "error" }),
      log({ "@timestamp": "2026-08-30T12:00:00Z", level: "info" }),
    ],
    solution:
      'level:error and @timestamp >= "2026-08-30T00:00:00Z" and @timestamp < "2026-08-31T00:00:00Z"',
  },
  {
    slug: "kql-acceso-externo-exitoso",
    language: "kql",
    difficulty: 5,
    match_mode: "partial",
    prompt:
      "Caza accesos que funcionaron desde fuera de la red interna. Interno es 10.0 o 192.168, todo lo demás es de fuera.",
    must_match: [
      log({ event: { outcome: "success" }, source: { ip: "8.8.8.8" } }),
      log({ event: { outcome: "success" }, source: { ip: "200.1.2.3" } }),
      log({ event: { outcome: "SUCCESS" }, source: { ip: "172.16.0.1" } }),
    ],
    must_not_match: [
      log({ event: { outcome: "success" }, source: { ip: "10.0.0.5" } }),
      log({ event: { outcome: "success" }, source: { ip: "192.168.1.5" } }),
      log({ event: { outcome: "failure" }, source: { ip: "8.8.8.8" } }),
    ],
    solution: "event.outcome:success and not source.ip:(10.0.* or 192.168.*)",
  },
  {
    slug: "kql-dominio-que-no-resuelve",
    language: "kql",
    difficulty: 5,
    match_mode: "partial",
    prompt:
      "Caza consultas DNS a dominios .xyz que además no resolvieron a ninguna dirección. Suele ser señal de un canal encubierto.",
    must_match: [
      log({ dns: { question: { name: "abc123.xyz" } } }),
      log({ dns: { question: { name: "datos.xyz" } } }),
      log({ dns: { question: { name: "x.xyz" }, resolved: null } }),
    ],
    must_not_match: [
      log({ dns: { question: { name: "abc123.xyz" }, resolved: "1.2.3.4" } }),
      log({ dns: { question: { name: "google.com" } } }),
      log({ dns: { question: { name: "google.com" }, resolved: "8.8.8.8" } }),
    ],
    solution: "dns.question.name:*.xyz and not dns.resolved:*",
  },
  {
    slug: "kql-ejecutable-en-temporales",
    language: "kql",
    difficulty: 5,
    match_mode: "partial",
    prompt:
      "Caza archivos ejecutables (exe o dll) escritos en una carpeta temporal. La ruta lleva Temp en el medio.",
    must_match: [
      log({ file: { path: "C:/Users/juan/AppData/Temp/malo.exe", extension: "exe" } }),
      log({ file: { path: "/tmp/Temp/carga.dll", extension: "dll" } }),
      log({ file: { path: "C:/Temp/x.exe", extension: "EXE" } }),
    ],
    must_not_match: [
      log({ file: { path: "C:/Users/juan/AppData/Temp/notas.txt", extension: "txt" } }),
      log({ file: { path: "C:/Windows/System32/bueno.exe", extension: "exe" } }),
      log({ file: { extension: "exe" } }),
    ],
    solution: "file.path:*Temp* and file.extension:(exe or dll)",
  },
  {
    slug: "kql-api-escritura-fallida",
    language: "kql",
    difficulty: 5,
    match_mode: "partial",
    prompt:
      "Caza escrituras a la API que fallaron y que no vengan de un bot. Escritura es POST o PUT, fallo es 400 o más, y el bot se reconoce en el user agent.",
    must_match: [
      log({ http: { method: "POST" }, status: 401, user_agent: "curl/8.0" }),
      log({ http: { method: "PUT" }, status: 500, user_agent: "Mozilla/5.0" }),
      log({ http: { method: "POST" }, status: 403 }),
    ],
    must_not_match: [
      log({ http: { method: "POST" }, status: 401, user_agent: "googlebot/2.1" }),
      log({ http: { method: "GET" }, status: 500, user_agent: "curl/8.0" }),
      log({ http: { method: "POST" }, status: 200, user_agent: "curl/8.0" }),
    ],
    solution: "http.method:(POST or PUT) and status >= 400 and not user_agent:*bot*",
  },
];
