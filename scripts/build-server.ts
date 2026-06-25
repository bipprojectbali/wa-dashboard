#!/usr/bin/env bun
/**
 * Compiles the production server to a self-contained binary.
 *
 * Why a script instead of `bun build --compile` directly:
 * `@elysiajs/swagger` statically imports `@scalar/themes` (just for the
 * `elysiajsTheme` CSS string), which transitively pulls `@scalar/types` —
 * a package written against Zod v3 (`z.function().returns()`). This project
 * uses Zod v4, so when the bundler unifies `zod` to v4 the Scalar code
 * evaluates `.returns()` (removed in v4) and the binary crashes on startup.
 * The crash only surfaces under `--frozen-lockfile` (Docker), where the
 * nested Zod v3 artifact is absent.
 *
 * Stubbing `@scalar/themes` severs that chain. The Scalar docs UI loads its
 * real assets from the CDN at runtime, so the CSS fallback string is the only
 * thing lost — backend behavior is unchanged.
 */

export {}

const stubScalarThemes = {
  name: 'stub-scalar-themes',
  setup(build: Bun.PluginBuilder) {
    build.onResolve({ filter: /^@scalar\/themes$/ }, () => ({
      path: 'scalar-themes-stub',
      namespace: 'stub-scalar-themes',
    }))
    build.onLoad({ filter: /.*/, namespace: 'stub-scalar-themes' }, () => ({
      contents: 'export const elysiajsTheme = "";',
      loader: 'js',
    }))
  },
}

const result = await Bun.build({
  entrypoints: ['src/server.prod.ts'],
  target: 'bun',
  compile: { target: 'bun-linux-x64', outfile: 'server' },
  plugins: [stubScalarThemes],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

console.log('Compiled server binary')
