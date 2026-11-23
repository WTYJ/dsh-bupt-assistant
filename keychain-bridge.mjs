import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const ALLOWED_SERVICES = new Set(['ucloud', 'academic']);

function checkAgentInstalled(buptAgentDir) {
  if (!buptAgentDir || !existsSync(buptAgentDir)) {
    return {
      ok: false,
      error: {
        code: 'AGENT_DIR_NOT_FOUND',
        message: `未找到 bupt-anything 目录：${buptAgentDir}`,
      },
    };
  }
  return { ok: true };
}

export async function runBuptAgentCli({ buptAgentDir, uvBin }, subcommand, extraArgs = [], timeoutMs = 60000) {
  const dirCheck = checkAgentInstalled(buptAgentDir);
  if (!dirCheck.ok) return dirCheck;

  const args = ['--directory', buptAgentDir, 'run', 'bupt-agent', subcommand, ...extraArgs];
  try {
    const { stdout } = await execFileAsync(uvBin || 'uv', args, {
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, PYTHONUTF8: '1' },
    });
    return JSON.parse(stdout);
  } catch (err) {
    const stdout = typeof err?.stdout === 'string' ? err.stdout.trim() : '';
    if (stdout.startsWith('{')) {
      try {
        return JSON.parse(stdout);
      } catch {
        // fall through
      }
    }
    return {
      ok: false,
      error: {
        code: 'CLI_EXEC_ERROR',
        message: err?.message ? String(err.message).split('\n')[0] : '调用 bupt-agent 失败',
      },
    };
  }
}

export async function getCredentialStatus(paths) {
  const res = await runBuptAgentCli(paths, 'doctor', [], 20000);
  if (!res.ok) {
    return {
      ok: false,
      ucloud: { configured: false, reason: res.error?.code || 'ERROR' },
      academic: { configured: false, reason: res.error?.code || 'ERROR' },
      error: res.error,
    };
  }
  return {
    ok: true,
    ucloud: {
      configured: Boolean(res.data?.ucloud?.configured),
      reason: res.data?.ucloud?.reason || null,
    },
    academic: {
      configured: Boolean(res.data?.academic?.configured),
      reason: res.data?.academic?.reason || null,
    },
    runtime: res.data?.runtime || null,
  };
}

/**
 * Save credentials directly into OS Keychain via bupt-agent's CredentialStore.
 * Credentials are passed ONLY through child stdin (never argv, never env, never files).
 */
export async function saveCredentialToKeychain(paths, { service, username, password, profile = 'default' }) {
  const dirCheck = checkAgentInstalled(paths.buptAgentDir);
  if (!dirCheck.ok) return dirCheck;

  if (!ALLOWED_SERVICES.has(service)) {
    return { ok: false, error: { code: 'INVALID_SERVICE', message: '服务类型只能是 ucloud 或 academic。' } };
  }
  const cleanUser = typeof username === 'string' ? username.trim() : '';
  const cleanPass = typeof password === 'string' ? password : '';
  if (!cleanUser || !cleanPass) {
    return { ok: false, error: { code: 'EMPTY_CREDENTIAL', message: '学号和密码不能为空。' } };
  }

  const pyCode = [
    'import json, sys',
    'from bupt_agent.credentials import CredentialStore',
    'from bupt_agent.common import AgentError',
    'try:',
    '    payload = json.loads(sys.stdin.read())',
    '    CredentialStore().save(payload["service"], payload.get("profile", "default"), payload["username"], payload["password"])',
    '    print(json.dumps({"ok": True, "service": payload["service"], "saved": True}))',
    'except AgentError as e:',
    '    print(json.dumps({"ok": False, "error": {"code": e.code, "message": e.message}}))',
    '    sys.exit(1)',
    'except Exception:',
    '    print(json.dumps({"ok": False, "error": {"code": "KEYCHAIN_WRITE_ERROR", "message": "写入系统钥匙串失败"}}))',
    '    sys.exit(1)',
  ].join('\n');

  return new Promise((resolvePromise) => {
    const child = spawn(
      paths.uvBin || 'uv',
      ['--directory', paths.buptAgentDir, 'run', 'python', '-c', pyCode],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUTF8: '1' },
      },
    );

    const outChunks = [];
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolvePromise({
        ok: false,
        error: { code: 'TIMEOUT', message: '写入系统钥匙串超时，请确认系统未阻塞钥匙串授权弹窗。' },
      });
    }, 25000);

    child.stdout.on('data', (c) => outChunks.push(c));
    child.on('error', () => {
      clearTimeout(timer);
      resolvePromise({
        ok: false,
        error: { code: 'SPAWN_ERROR', message: '无法启动 uv / Python 环境。' },
      });
    });
    child.on('close', () => {
      clearTimeout(timer);
      const raw = Buffer.concat(outChunks).toString('utf8').trim();
      try {
        const parsed = JSON.parse(raw);
        resolvePromise(parsed);
      } catch {
        resolvePromise({
          ok: false,
          error: { code: 'KEYCHAIN_WRITE_ERROR', message: '写入系统钥匙串返回异常。' },
        });
      }
    });

    const stdinPayload = JSON.stringify({
      service,
      profile,
      username: cleanUser,
      password: cleanPass,
    });
    child.stdin.write(stdinPayload);
    child.stdin.end();
  });
}

export async function deleteCredentialFromKeychain(paths, service) {
  if (!ALLOWED_SERVICES.has(service)) {
    return { ok: false, error: { code: 'INVALID_SERVICE', message: '服务类型只能是 ucloud 或 academic。' } };
  }
  return runBuptAgentCli(paths, 'logout', ['--service', service], 20000);
}

export async function verifyKeychainCredentials(paths) {
  return runBuptAgentCli(paths, 'verify', [], 45000);
}
