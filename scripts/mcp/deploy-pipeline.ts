import { PACKAGE_JSON, createGhHelpers, run, runPreflight, type Step } from './deploy-helpers'

interface DeployConfig {
  ghToken: string
  ghRepo: string
  baseUrl: string
  stackName: string
}

type McpResponse = { content: [{ type: 'text'; text: string }] }

function ok(data: object): McpResponse {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

export async function runDeployPipeline(
  params: {
    bump: 'patch' | 'minor' | 'major'
    message?: string
    skip_preflight: boolean
    branch: string
  },
  cfg: DeployConfig,
): Promise<McpResponse> {
  const steps: Step[] = []
  const { ghToken, ghRepo, baseUrl, stackName } = cfg
  const { readVersion, bumpVersion, triggerAndGetRunId, pollWorkflow, verifyVersion } = createGhHelpers(
    ghToken,
    ghRepo,
    baseUrl,
    PACKAGE_JSON,
  )
  const { bump, message, skip_preflight, branch } = params

  if (!ghToken) {
    return ok({
      success: false,
      blocked_by: 'no_gh_token',
      hint: 'Set GH_TOKEN di environment (GitHub PAT dengan scope: repo + workflow)',
      steps,
    })
  }

  if (!skip_preflight) {
    const pre = runPreflight(branch)
    const hintMap: Record<string, string> = {
      dirty_tree: 'Working tree kotor — commit atau stash perubahan dulu',
      credential_leak: `Credential leak terdeteksi: ${pre.credScan.issues.map((i) => i.type).join(', ')}`,
      sensitive_file: `File sensitif di diff: ${pre.fileScan.files.join(', ')}`,
      migration_missing: pre.migrationCheck.warnings.join('; '),
    }
    steps.push({
      step: 'preflight',
      status: pre.ok ? 'ok' : 'blocked',
      detail: pre.ok ? 'Credential scan + migration check OK' : hintMap[pre.blockedBy!],
      issues: pre.credScan.issues,
    })
    if (!pre.ok) {
      return ok({ success: false, blocked_by: pre.blockedBy, hint: hintMap[pre.blockedBy!], steps })
    }
  } else {
    steps.push({ step: 'preflight', status: 'skip', detail: 'Dilewati via skip_preflight=true' })
  }

  const prevVersion = readVersion()
  const newVersion = bumpVersion(bump)
  steps.push({ step: 'bump_version', status: 'ok', detail: `${prevVersion} → ${newVersion}` })

  const commitMsg = message ?? `chore: bump v${newVersion}`
  const addResult = run(`git add ${PACKAGE_JSON}`)
  const commitResult = run(`git commit -m "${commitMsg}"`)
  if (!addResult.ok || !commitResult.ok) {
    steps.push({ step: 'commit', status: 'error', detail: commitResult.err || addResult.err })
    return ok({ success: false, blocked_by: 'commit_failed', steps })
  }
  steps.push({ step: 'commit', status: 'ok', detail: commitMsg })

  const pushUrl = `https://oauth2:${ghToken}@github.com/${ghRepo}.git`
  const pushResult = run(`git push ${pushUrl} HEAD:${branch}`)
  if (!pushResult.ok) {
    steps.push({ step: 'push', status: 'error', detail: pushResult.err.replace(ghToken, '***') })
    return ok({ success: false, blocked_by: 'push_failed', steps })
  }
  steps.push({ step: 'push', status: 'ok', detail: `origin/${branch}` })

  const publishRunId = await triggerAndGetRunId('publish.yml', [`stack_env=${branch}`, `tag=${newVersion}`], branch)
  if (!publishRunId) {
    steps.push({ step: 'publish_triggered', status: 'error', detail: 'Gagal mendapatkan run ID dari publish.yml' })
    return ok({ success: false, blocked_by: 'publish_trigger_failed', steps })
  }
  steps.push({ step: 'publish_triggered', status: 'ok', detail: `run ID: ${publishRunId}` })

  const publishResult = await pollWorkflow(publishRunId, 600_000)
  if (publishResult.conclusion !== 'success') {
    steps.push({ step: 'publish_done', status: 'error', detail: `${publishResult.status}/${publishResult.conclusion}` })
    return ok({ success: false, blocked_by: 'publish_failed', steps })
  }
  steps.push({ step: 'publish_done', status: 'ok', detail: 'Image berhasil di-build dan push ke GHCR' })

  const stackFull = `${stackName}-${branch}`
  const repullRunId = await triggerAndGetRunId(
    're-pull.yml',
    [`stack_name=${stackName}`, `stack_env=${branch}`],
    branch,
  )
  if (!repullRunId) {
    steps.push({
      step: 'repull_triggered',
      status: 'error',
      detail: 'Gagal mendapatkan run ID dari re-pull.yml',
    })
    return ok({ success: false, blocked_by: 'repull_trigger_failed', steps })
  }
  steps.push({ step: 'repull_triggered', status: 'ok', detail: `stack: ${stackFull}, run ID: ${repullRunId}` })

  const repullResult = await pollWorkflow(repullRunId, 600_000)
  if (repullResult.conclusion !== 'success') {
    steps.push({ step: 'repull_done', status: 'error', detail: `${repullResult.status}/${repullResult.conclusion}` })
    return ok({ success: false, blocked_by: 'repull_failed', steps })
  }
  steps.push({ step: 'repull_done', status: 'ok', detail: `Stack ${stackFull} berhasil redeploy` })

  if (baseUrl) {
    const verified = await verifyVersion(newVersion, 120_000)
    steps.push({
      step: 'verify',
      status: verified ? 'ok' : 'error',
      detail: verified ? `${baseUrl}/api/version → ${newVersion}` : `Timeout — versi belum berubah ke ${newVersion}`,
    })
    if (!verified) {
      return ok({ success: false, blocked_by: 'verify_timeout', version: newVersion, steps })
    }
  } else {
    steps.push({ step: 'verify', status: 'skip', detail: 'BASE_URL tidak di-set, skip verifikasi' })
  }

  return ok({ success: true, version: newVersion, target_url: baseUrl || null, steps })
}
