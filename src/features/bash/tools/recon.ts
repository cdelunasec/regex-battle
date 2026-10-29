/**
 * Las herramientas que tocan la red, que aquí no tocan nada.
 *
 * En un navegador no hay red que escanear, y fingir que la hay sería mentir.
 * Lo que sí se puede enseñar, y es lo que de verdad se hace en un pentest, es
 * el FLUJO: lanzar, parsear lo que escupe cada herramienta, juntarlo y sacar un
 * reporte. La salida de aquí está guardada y es del formato real, byte por
 * byte, así que el script que se escribe practicando funciona igual con la
 * salida de un nmap de verdad.
 *
 * Tres reglas que no son adorno:
 *
 * 1. Cada invocación avisa por la salida de error que es una simulación. Va por
 *    ahí y no por la salida normal para no ensuciar la tubería, que es lo que
 *    se está aprendiendo a encadenar.
 * 2. Si hay un `scope.txt` en el directorio, el objetivo tiene que estar
 *    dentro. Si no está, la herramienta se niega. El control de alcance no es
 *    un sermón pegado al final de la lección, es cómo se comportan.
 * 3. Todos los objetivos son de rangos privados y del dominio `.test`, que
 *    está reservado justo para esto. Aquí no hay nada que exista de verdad.
 */
import { fromLines, parseArgs, type Tool, type ToolContext, type ToolResult } from "./support.ts";

/** El aviso, siempre por la salida de error. */
function simulated(tool: string): string {
  return `${tool}: salida guardada, esta plataforma no tiene red\n`;
}

/**
 * Comprueba el alcance antes de dejar correr nada.
 *
 * Busca `scope.txt` en el directorio actual. Cada línea es un objetivo
 * autorizado: una IP, un rango en notación CIDR o un dominio con comodín. Si el
 * archivo no está, solo se permiten los objetivos del laboratorio.
 */
function inScope(context: ToolContext, target: string): { allowed: boolean; reason: string } {
  const scopePath = context.shell.resolve("scope.txt");

  if (!context.shell.vfs.exists(scopePath)) {
    const lab =
      /^10\.(10|0)\.\d+\.\d+$/.test(target) ||
      target.endsWith(".test") ||
      target === "example.test";
    return lab
      ? { allowed: true, reason: "" }
      : {
          allowed: false,
          reason: `${target} no es del laboratorio. Aquí solo existen 10.10.10.0/24, 10.0.0.0/24 y el dominio example.test`,
        };
  }

  const entries = context.shell.vfs
    .readFile(scopePath)
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => line !== "");

  for (const entry of entries) {
    if (entry === target) return { allowed: true, reason: "" };

    if (entry.startsWith("*.")) {
      const base = entry.slice(2);
      // Un comodín cubre también el dominio de base, que es como se escriben
      // los alcances de verdad: quien autoriza `*.example.test` no está
      // dejando fuera a `example.test`.
      if (target === base || target.endsWith("." + base)) return { allowed: true, reason: "" };
    }

    const cidr = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/.exec(entry);
    if (cidr && ipInCidr(target, entry)) return { allowed: true, reason: "" };
  }

  return {
    allowed: false,
    reason: `${target} no está en scope.txt, y lo que no está autorizado no se toca`,
  };
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [network, bitsText] = cidr.split("/");
  const address = ipToNumber(ip);
  const base = ipToNumber(network ?? "");
  const bits = Number(bitsText);
  if (address === null || base === null || !Number.isInteger(bits)) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (address & mask) === (base & mask);
}

function refuse(tool: string, reason: string): ToolResult {
  return {
    stdout: "",
    stderr: `${tool}: ${reason}.\n${tool}: (simulación; en un trabajo de verdad, el alcance se acuerda por escrito antes de tocar nada)\n`,
    status: 2,
  };
}

// --------------------------------------------------------------- el mundo de mentira

interface FakePort {
  port: number;
  service: string;
  version: string;
}

interface FakeHost {
  ip: string;
  name: string;
  ports: FakePort[];
}

const HOSTS: FakeHost[] = [
  {
    ip: "10.10.10.5",
    name: "web01.example.test",
    ports: [
      { port: 22, service: "ssh", version: "OpenSSH 8.9p1 Ubuntu 3ubuntu0.4" },
      { port: 80, service: "http", version: "nginx 1.18.0" },
      { port: 443, service: "https", version: "nginx 1.18.0" },
    ],
  },
  {
    ip: "10.10.10.12",
    name: "db01.example.test",
    ports: [
      { port: 22, service: "ssh", version: "OpenSSH 7.4" },
      { port: 3306, service: "mysql", version: "MySQL 5.7.33" },
    ],
  },
  {
    ip: "10.10.10.23",
    name: "files.example.test",
    ports: [
      { port: 139, service: "netbios-ssn", version: "Samba smbd 4.6.2" },
      { port: 445, service: "microsoft-ds", version: "Samba smbd 4.6.2" },
    ],
  },
  {
    ip: "10.10.10.40",
    name: "old.example.test",
    ports: [
      { port: 21, service: "ftp", version: "vsftpd 2.3.4" },
      { port: 23, service: "telnet", version: "Linux telnetd" },
      { port: 3389, service: "ms-wbt-server", version: "xrdp" },
    ],
  },
];

function hostsFor(target: string): FakeHost[] {
  if (target.includes("/")) return HOSTS.filter((host) => ipInCidr(host.ip, target));
  const byIp = HOSTS.find((host) => host.ip === target);
  if (byIp) return [byIp];
  const byName = HOSTS.find((host) => host.name === target);
  return byName ? [byName] : [];
}

// ------------------------------------------------------------------------ nmap

export const nmap: Tool = (context) => {
  const parsed = parseArgs(context.args, {
    flags: "sVsCAvn",
    values: "op",
    long: { open: "open" },
  });

  const target = parsed.operands[parsed.operands.length - 1];
  if (!target) {
    return { stdout: "", stderr: "nmap: falta el objetivo\n", status: 1 };
  }

  const scope = inScope(context, target.includes("/") ? target.split("/")[0]! : target);
  if (!scope.allowed) return refuse("nmap", scope.reason);

  const found = hostsFor(target);
  const grepable = parsed.values.get("o") === "G" || context.args.includes("-oG");
  const withVersion = context.args.includes("-sV") || context.args.includes("-A");

  const wantedPorts = parsed.values.get("p");
  const filter = (port: FakePort): boolean => {
    if (!wantedPorts) return true;
    return wantedPorts.split(",").some((piece) => Number(piece) === port.port);
  };

  if (grepable) {
    const lines: string[] = ["# Nmap 7.94 scan initiated as: nmap -oG - " + target];
    for (const host of found) {
      lines.push(`Host: ${host.ip} (${host.name})\tStatus: Up`);
      const ports = host.ports
        .filter(filter)
        .map(
          (port) => `${port.port}/open/tcp//${port.service}//${withVersion ? port.version : ""}/`,
        )
        .join(", ");
      lines.push(`Host: ${host.ip} (${host.name})\tPorts: ${ports}`);
    }
    lines.push(`# Nmap done -- ${found.length} IP address(es) scanned`);
    return { stdout: fromLines(lines), stderr: simulated("nmap"), status: 0 };
  }

  const lines: string[] = ["Starting Nmap 7.94 ( https://nmap.org ) at 2026-03-14 10:00 UTC"];

  for (const host of found) {
    lines.push("");
    lines.push(`Nmap scan report for ${host.name} (${host.ip})`);
    lines.push("Host is up (0.00042s latency).");
    lines.push("");
    lines.push(withVersion ? "PORT     STATE SERVICE       VERSION" : "PORT     STATE SERVICE");

    for (const port of host.ports.filter(filter)) {
      const left = `${port.port}/tcp`.padEnd(9) + "open  " + port.service.padEnd(14);
      lines.push(withVersion ? (left + port.version).trimEnd() : left.trimEnd());
    }
  }

  lines.push("");
  lines.push(
    `Nmap done: ${found.length} IP address${found.length === 1 ? "" : "es"} (${found.length} host${found.length === 1 ? "" : "s"} up) scanned in 1.24 seconds`,
  );

  return { stdout: fromLines(lines), stderr: simulated("nmap"), status: 0 };
};

// ------------------------------------------------------------------------- dig

const RECORDS: Record<string, { type: string; value: string }[]> = {
  "example.test": [
    { type: "A", value: "10.10.10.5" },
    { type: "MX", value: "10 correo.example.test." },
    { type: "TXT", value: '"v=spf1 ip4:10.10.10.0/24 -all"' },
  ],
  "web01.example.test": [{ type: "A", value: "10.10.10.5" }],
  "db01.example.test": [{ type: "A", value: "10.10.10.12" }],
  "files.example.test": [{ type: "A", value: "10.10.10.23" }],
  "old.example.test": [{ type: "A", value: "10.10.10.40" }],
  "correo.example.test": [{ type: "A", value: "10.10.10.7" }],
};

export const dig: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "", long: { short: "short" } });
  const short = context.args.includes("+short");
  const operands = parsed.operands.filter((operand) => !operand.startsWith("+"));
  const wantedType = operands.find((operand) => /^(A|MX|TXT|NS|CNAME)$/.test(operand));
  const name = operands.find((operand) => operand.includes("."));

  if (!name) return { stdout: "", stderr: "dig: falta el nombre a consultar\n", status: 1 };

  const scope = inScope(context, name);
  if (!scope.allowed) return refuse("dig", scope.reason);

  const records = (RECORDS[name] ?? []).filter(
    (record) => !wantedType || record.type === wantedType,
  );

  if (short) {
    return {
      stdout: fromLines(records.map((record) => record.value)),
      stderr: simulated("dig"),
      status: 0,
    };
  }

  const lines = [
    "; <<>> DiG 9.18.12 <<>> " + context.args.join(" "),
    ";; global options: +cmd",
    ";; Got answer:",
    ";; ->>HEADER<<- opcode: QUERY, status: NOERROR",
    "",
    ";; QUESTION SECTION:",
    `;${name}.\t\t\tIN\t${wantedType ?? "A"}`,
    "",
    ";; ANSWER SECTION:",
    ...records.map((record) => `${name}.\t3600\tIN\t${record.type}\t${record.value}`),
    "",
  ];

  return { stdout: fromLines(lines), stderr: simulated("dig"), status: 0 };
};

// ----------------------------------------------------------------------- whois

export const whois: Tool = (context) => {
  const target = context.args[context.args.length - 1];
  if (!target) return { stdout: "", stderr: "whois: falta el objetivo\n", status: 1 };

  const scope = inScope(context, target);
  if (!scope.allowed) return refuse("whois", scope.reason);

  const lines = [
    `Domain Name: ${target.toUpperCase()}`,
    "Registrar: Laboratorio Interno",
    "Creation Date: 2024-01-15T00:00:00Z",
    "Registry Expiry Date: 2027-01-15T00:00:00Z",
    "Name Server: ns1.example.test",
    "Name Server: ns2.example.test",
    "Registrant Organization: Practicas de Seguridad",
    "Registrant Country: DO",
  ];

  return { stdout: fromLines(lines), stderr: simulated("whois"), status: 0 };
};

// ------------------------------------------------------------------------ curl

const PAGES: Record<string, { status: number; headers: string[]; body: string }> = {
  "http://10.10.10.5/": {
    status: 200,
    headers: ["Server: nginx/1.18.0", "Content-Type: text/html", "X-Powered-By: PHP/7.4.3"],
    body: "<html><head><title>Panel interno</title></head><body><h1>Intranet</h1></body></html>\n",
  },
  "http://10.10.10.5/api/estado": {
    status: 200,
    headers: ["Server: nginx/1.18.0", "Content-Type: application/json"],
    body: '{"estado":"activo","version":"2.1.0","usuarios":48}\n',
  },
  "http://10.10.10.40/": {
    status: 200,
    headers: ["Server: Apache/2.2.22", "Content-Type: text/html"],
    body: "<html><body>It works!</body></html>\n",
  },
};

export const curl: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "sSILkv", values: "oX" });
  const url = parsed.operands[parsed.operands.length - 1];

  if (!url)
    return { stdout: "", stderr: "curl: try 'curl --help' for more information\n", status: 2 };

  const host = /^https?:\/\/([^/:]+)/.exec(url)?.[1] ?? url;
  const scope = inScope(context, host);
  if (!scope.allowed) return refuse("curl", scope.reason);

  const page = PAGES[url] ?? PAGES[url + "/"];
  if (!page) {
    return {
      stdout: "",
      stderr: simulated("curl") + `curl: (7) no hay nada guardado para ${url}\n`,
      status: 7,
    };
  }

  const headerLines = [
    `HTTP/1.1 ${page.status} ${page.status === 200 ? "OK" : "Not Found"}`,
    ...page.headers,
    "",
  ];

  if (parsed.flags.has("I")) {
    return { stdout: fromLines(headerLines), stderr: simulated("curl"), status: 0 };
  }
  if (parsed.flags.has("i")) {
    return { stdout: fromLines(headerLines) + page.body, stderr: simulated("curl"), status: 0 };
  }

  return { stdout: page.body, stderr: simulated("curl"), status: 0 };
};

// --------------------------------------------------- descubrimiento de rutas y nombres

const PATHS: { path: string; status: number; size: number }[] = [
  { path: "/admin", status: 301, size: 178 },
  { path: "/api", status: 200, size: 52 },
  { path: "/backup", status: 403, size: 199 },
  { path: "/index.html", status: 200, size: 812 },
  { path: "/login", status: 200, size: 1204 },
  { path: "/uploads", status: 403, size: 199 },
];

export const gobuster: Tool = (context) => {
  const parsed = parseArgs(context.args, { values: "uw" });
  const url = parsed.values.get("u");
  if (!url) return { stdout: "", stderr: "gobuster: falta -u con la URL\n", status: 1 };

  const host = /^https?:\/\/([^/:]+)/.exec(url)?.[1] ?? url;
  const scope = inScope(context, host);
  if (!scope.allowed) return refuse("gobuster", scope.reason);

  const lines = [
    "===============================================================",
    "Gobuster v3.6",
    "===============================================================",
    `[+] Url:  ${url}`,
    "[+] Method: GET",
    "===============================================================",
    ...PATHS.map(
      (entry) => `${entry.path.padEnd(20)} (Status: ${entry.status}) [Size: ${entry.size}]`,
    ),
    "===============================================================",
    "Finished",
    "===============================================================",
  ];

  return { stdout: fromLines(lines), stderr: simulated("gobuster"), status: 0 };
};

export const ffuf: Tool = (context) => {
  const parsed = parseArgs(context.args, { values: "uwo", flags: "s" });
  const url = parsed.values.get("u");
  if (!url) return { stdout: "", stderr: "ffuf: falta -u con la URL\n", status: 1 };

  const host = /^https?:\/\/([^/:]+)/.exec(url)?.[1] ?? url;
  const scope = inScope(context, host);
  if (!scope.allowed) return refuse("ffuf", scope.reason);

  // ffuf escupe JSON, que es justo la excusa para aprender `jq`.
  const results = PATHS.map((entry) => ({
    input: { FUZZ: entry.path.replace("/", "") },
    url: url.replace(/FUZZ.*$/, "") + entry.path.replace("/", ""),
    status: entry.status,
    length: entry.size,
    words: Math.ceil(entry.size / 7),
    lines: Math.ceil(entry.size / 40),
  }));

  const document = JSON.stringify(
    { commandline: "ffuf " + context.args.join(" "), results },
    null,
    2,
  );
  return { stdout: document + "\n", stderr: simulated("ffuf"), status: 0 };
};

export const subfinder: Tool = (context) => {
  const parsed = parseArgs(context.args, { values: "d", flags: "silent" });
  const domain = parsed.values.get("d");
  if (!domain) return { stdout: "", stderr: "subfinder: falta -d con el dominio\n", status: 1 };

  const scope = inScope(context, domain);
  if (!scope.allowed) return refuse("subfinder", scope.reason);

  const names = Object.keys(RECORDS)
    .filter((name) => name.endsWith(domain) && name !== domain)
    .sort();

  return { stdout: fromLines(names), stderr: simulated("subfinder"), status: 0 };
};

export const nuclei: Tool = (context) => {
  const parsed = parseArgs(context.args, { values: "ut", flags: "js" });
  const target = parsed.values.get("u") ?? parsed.operands[parsed.operands.length - 1];
  if (!target) return { stdout: "", stderr: "nuclei: falta -u con el objetivo\n", status: 1 };

  const host = /^https?:\/\/([^/:]+)/.exec(target)?.[1] ?? target;
  const scope = inScope(context, host);
  if (!scope.allowed) return refuse("nuclei", scope.reason);

  // Hallazgos informativos: qué se ve desde fuera, no cómo entrar.
  const findings = [
    {
      "template-id": "http-missing-security-headers",
      info: { name: "Faltan cabeceras de seguridad", severity: "info" },
      host,
      "matched-at": `http://${host}/`,
      "extracted-results": ["content-security-policy", "x-frame-options"],
    },
    {
      "template-id": "tech-detect",
      info: { name: "Tecnología detectada", severity: "info" },
      host,
      "matched-at": `http://${host}/`,
      "extracted-results": ["nginx", "php"],
    },
    {
      "template-id": "ssh-old-version",
      info: { name: "Versión de SSH antigua", severity: "medium" },
      host,
      "matched-at": `${host}:22`,
      "extracted-results": ["OpenSSH 7.4"],
    },
  ];

  const lines = findings.map((finding) => JSON.stringify(finding));
  return { stdout: fromLines(lines), stderr: simulated("nuclei"), status: 0 };
};

export const ping: Tool = (context) => {
  const target = context.args[context.args.length - 1];
  if (!target) return { stdout: "", stderr: "ping: falta el objetivo\n", status: 1 };

  const scope = inScope(context, target);
  if (!scope.allowed) return refuse("ping", scope.reason);

  const known = hostsFor(target).length > 0;
  const lines = [
    `PING ${target} (${target}) 56(84) bytes of data.`,
    ...(known
      ? [
          `64 bytes from ${target}: icmp_seq=1 ttl=64 time=0.412 ms`,
          `64 bytes from ${target}: icmp_seq=2 ttl=64 time=0.389 ms`,
        ]
      : []),
    "",
    `--- ${target} ping statistics ---`,
    known
      ? "2 packets transmitted, 2 received, 0% packet loss, time 1002ms"
      : "2 packets transmitted, 0 received, 100% packet loss, time 1010ms",
  ];

  return { stdout: fromLines(lines), stderr: simulated("ping"), status: known ? 0 : 1 };
};
