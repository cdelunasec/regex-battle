/**
 * Copies `src/engine` into `supabase/functions/_shared/engine`.
 *
 * The edge function has to run the exact same validation logic as the browser,
 * and a Deno function cannot reach outside its own folder when it is deployed.
 * So the engine is authored once under `src` and mirrored here.
 *
 * The engine imports its own modules with explicit `.ts` extensions, which
 * both Vite and Deno accept, so the copies are byte for byte identical.
 *
 * Usage:
 *   node scripts/sync-engine.mjs           copies
 *   node scripts/sync-engine.mjs --check   fails when the copies drifted
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const source = join(root, 'src', 'engine')
const target = join(root, 'supabase', 'functions', '_shared', 'engine')
const check = process.argv.includes('--check')

const banner =
  '// GENERATED FILE. Edit src/engine and run `npm run sync:engine`.\n'

const files = (await readdir(source)).filter(
  (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
)

await mkdir(target, { recursive: true })

const drifted = []
for (const name of files) {
  const contents = banner + (await readFile(join(source, name), 'utf8'))
  const destination = join(target, name)

  if (check) {
    const current = await readFile(destination, 'utf8').catch(() => null)
    if (current !== contents) drifted.push(name)
    continue
  }
  await writeFile(destination, contents, 'utf8')
}

if (check && drifted.length > 0) {
  console.error(
    `The shared engine copy is out of date: ${drifted.join(', ')}.\n` +
      'Run `npm run sync:engine` and commit the result.',
  )
  process.exit(1)
}

console.log(
  check
    ? `Shared engine copy is in sync (${files.length} files).`
    : `Synced ${files.length} engine files into supabase/functions/_shared/engine.`,
)
