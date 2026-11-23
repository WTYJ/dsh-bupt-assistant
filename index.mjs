import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  normalizeConfig,
  resolveEffectivePaths,
  resolveLiveConfig,
  saveLiveConfig,
} from './config.mjs';
import {
  deleteCredentialFromKeychain,
  getCredentialStatus,
  saveCredentialToKeychain,
  verifyKeychainCredentials,
} from './keychain-bridge.mjs';
import { createSyncEngine, extractRadarPreview } from './sync-engine.mjs';

const PKG_META = (() => {
  try {
    const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
    return Object.freeze({
      name: pkg.name || 'dsh-bupt-assistant',
      version: pkg.version || '1.0.0',
      description: pkg.description || '',
      license: pkg.license || 'MIT',
    });
  } catch {
    return Object.freeze({
      name: 'dsh-bupt-assistant',
      version: '1.0.0',
      description: '',
      license: 'MIT',
    });
  }
})();

export const name = 'dsh-bupt-assistant';
export const inject = ['webServer'];
export const API_ROUTE = '/dsh-bupt-assistant/api';

function isLoopbackRequest(request) {
  const addr = request?.socket?.remoteAddress;
  if (!addr) return true; // allow in-process test mocks
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let total = 0;
    request.on('data', (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > 64 * 1024) {
        reject(new Error('Payload too large'));
        return;
      }
      chunks.push(buf);
    });
    request.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolvePromise(text.trim() ? JSON.parse(text) : {});
      } catch (err) {
        reject(err);
      }
    });
    request.on('error', reject);
  });
}

function workspaceOf(agent) {
  const candidates = [
    agent?.workspace,
    agent?.cwd,
    agent?.session?.workspace,
    agent?.session?.cwd,
    agent?.session?.header?.cwd,
  ];
  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item.trim();
  }
  return null;
}

export function createBuptAssistantPlugin(overrides = {}) {
  return Object.freeze({
    name,
    inject,
    apply(ctx, rawConfig = {}) {
      const logger = ctx?.logger?.(name) ?? console;
      const baseConfig = normalizeConfig(rawConfig);
      let runtimeConfig = resolveLiveConfig(baseConfig);

      const getConfig = () => {
        runtimeConfig = resolveLiveConfig(baseConfig);
        return runtimeConfig;
      };

      const keychain = {
        getStatus: overrides.getCredentialStatus || getCredentialStatus,
        save: overrides.saveCredentialToKeychain || saveCredentialToKeychain,
        remove: overrides.deleteCredentialFromKeychain || deleteCredentialFromKeychain,
        verify: overrides.verifyKeychainCredentials || verifyKeychainCredentials,
      };

      const syncEngine =
        overrides.syncEngine ||
        createSyncEngine({
          getConfig,
          cliRunner: overrides.cliRunner,
          credStatusFn: keychain.getStatus,
          nowFn: overrides.nowFn,
          logger,
        });

      // Start background timer & optional startup sync inside DSH Host
      syncEngine.applySchedule(runtimeConfig);
      if (runtimeConfig.enabled && runtimeConfig.autoSync.enabled && runtimeConfig.autoSync.syncOnStartup) {
        const startupTimer = setTimeout(() => {
          syncEngine.syncNow({ reason: 'startup' });
        }, 4000);
        if (typeof startupTimer.unref === 'function') startupTimer.unref();
        ctx?.effect?.(() => () => clearTimeout(startupTimer));
      }
      ctx?.effect?.(() => () => syncEngine.stop());

      // Mount HTTP API for DSH Settings UI
      if (typeof ctx?.webServer?.register === 'function') {
        const registerRoute = () =>
          ctx.webServer.register({
            kind: 'exact',
            path: API_ROUTE,
            handler: async (request, response) => {
              if (!isLoopbackRequest(request)) {
                sendJson(response, 403, { ok: false, error: 'Forbidden' });
                return;
              }
              try {
                const cfg = getConfig();
                const paths = resolveEffectivePaths(cfg);

                if (request.method === 'GET') {
                  const credentials = await keychain.getStatus(paths);
                  sendJson(response, 200, {
                    ok: true,
                    meta: PKG_META,
                    settings: cfg,
                    credentials,
                    syncStatus: syncEngine.getStatus(),
                  });
                  return;
                }

                if (request.method === 'POST') {
                  const body = await readJsonBody(request);
                  const action = body?.action || 'saveSettings';

                  if (action === 'saveSettings') {
                    const updated = saveLiveConfig(baseConfig, body?.patch || body);
                    runtimeConfig = updated;
                    syncEngine.applySchedule(updated);
                    const updatedPaths = resolveEffectivePaths(updated);
                    const credentials = await keychain.getStatus(updatedPaths);
                    sendJson(response, 200, {
                      ok: true,
                      settings: updated,
                      credentials,
                      syncStatus: syncEngine.getStatus(),
                    });
                    return;
                  }

                  if (action === 'saveCredential') {
                    const result = await keychain.save(paths, {
                      service: body?.service,
                      username: body?.username,
                      password: body?.password,
                    });
                    const credentials = await keychain.getStatus(paths);
                    sendJson(response, result.ok ? 200 : 400, {
                      ok: Boolean(result.ok),
                      result: { saved: Boolean(result.saved), service: body?.service },
                      error: result.error || null,
                      credentials,
                    });
                    return;
                  }

                  if (action === 'deleteCredential') {
                    const result = await keychain.remove(paths, body?.service);
                    const credentials = await keychain.getStatus(paths);
                    sendJson(response, result.ok ? 200 : 400, {
                      ok: Boolean(result.ok),
                      error: result.error || null,
                      credentials,
                    });
                    return;
                  }

                  if (action === 'verifyCredentials') {
                    const verifyRes = await keychain.verify(paths);
                    const credentials = await keychain.getStatus(paths);
                    sendJson(response, 200, {
                      ok: Boolean(verifyRes.ok),
                      verify: verifyRes,
                      credentials,
                    });
                    return;
                  }

                  if (action === 'syncNow') {
                    const summary = await syncEngine.syncNow({ reason: 'manual-ui' });
                    sendJson(response, 200, {
                      ok: Boolean(summary.ok),
                      summary,
                      syncStatus: syncEngine.getStatus(),
                    });
                    return;
                  }

                  sendJson(response, 400, { ok: false, error: `Unknown action: ${action}` });
                  return;
                }

                sendJson(response, 405, { ok: false, error: 'Method Not Allowed' });
              } catch (err) {
                logger?.warn?.(`[${name}] API error: ${err?.message || err}`);
                sendJson(response, 500, { ok: false, error: err?.message || 'Internal Error' });
              }
            },
          });

        if (typeof ctx.effect === 'function') {
          ctx.effect(registerRoute);
        } else {
          registerRoute();
        }
      }

      // Mount Agent tool + systemPrompt.context radar injection
      const installAgentCapabilities = ({ tools, systemPrompt }) => {
        if (tools && typeof tools.register === 'function') {
          const refreshTool = Object.freeze({
            name: 'bupt_refresh_schedule',
            description:
              'Immediately refresh BUPT UCloud homework DDL, academic class schedule, and exam arrangements into the exported Markdown file, and return the latest alert radar.',
            parameters: {
              type: 'object',
              additionalProperties: false,
              properties: {},
            },
            output: {
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  ok: { type: 'boolean' },
                  syncedAt: { type: 'string' },
                  todoCount: { type: 'number' },
                  examCount: { type: 'number' },
                  radarLines: { type: 'array', items: { type: 'string' } },
                  message: { type: 'string' },
                },
                required: ['ok', 'syncedAt', 'todoCount', 'examCount', 'radarLines', 'message'],
              },
              render: (_args, value) => [
                {
                  type: 'text',
                  text: value.ok
                    ? `已刷新北邮日程（${value.syncedAt}）：待办作业 ${value.todoCount} 项、考试 ${value.examCount} 项。\n近期提醒雷达：\n${value.radarLines.join('\n') || '- 暂无紧急项'}`
                    : `刷新失败：${value.message}`,
                },
              ],
            },
            async execute() {
              const cfg = getConfig();
              if (!cfg.enabled) {
                return {
                  ok: false,
                  syncedAt: '',
                  todoCount: 0,
                  examCount: 0,
                  radarLines: [],
                  message: '北邮个人助理插件当前已关闭。',
                };
              }
              const summary = await syncEngine.syncNow({ reason: 'agent-tool' });
              if (!summary.ok) {
                return {
                  ok: false,
                  syncedAt: '',
                  todoCount: 0,
                  examCount: 0,
                  radarLines: [],
                  message: summary.error || '同步失败',
                };
              }
              return {
                ok: true,
                syncedAt: summary.syncedAt || '',
                todoCount: summary.ucloud?.todoCount ?? 0,
                examCount: summary.academic?.examCount ?? 0,
                radarLines: Array.isArray(summary.radarLines) ? summary.radarLines : [],
                message: 'ok',
              };
            },
          });

          tools.register(refreshTool);
        }

        if (systemPrompt && typeof systemPrompt.context === 'function') {
          systemPrompt.context({
            name: 'dsh-bupt-assistant:digest',
            order: 120,
            text: (assembly) => {
              const cfg = getConfig();
              if (!cfg.enabled || !cfg.contextInject?.enabled) return '';

              const paths = resolveEffectivePaths(cfg);
              const activeWs = workspaceOf(assembly?.agent);
              // Only inject into sessions whose workspace matches the configured export directory
              if (activeWs && resolve(activeWs) !== resolve(paths.exportDir)) {
                return '';
              }

              const radar = extractRadarPreview(paths.scheduleFile);
              if (!radar.hasFile) return '';

              const lines = [];
              lines.push(
                `当前工作区北邮日程摘要（来源：${cfg.exportMarkdown.scheduleFileName}${
                  radar.syncedAt ? `，最近同步：${radar.syncedAt}` : ''
                }）：`,
              );
              if (radar.radarLines.length > 0) {
                lines.push(...radar.radarLines.slice(0, 8));
              }
              lines.push(
                `说明：以上为本机同步的客观作业、课表与考试事实。如需获取最新状态，可调用 bupt_refresh_schedule 实时刷新，或查阅工作区内的 ${cfg.exportMarkdown.scheduleFileName}；请按当前会话自身风格自然提醒，避免重复播报同一事项。`,
              );
              return lines.join('\n');
            },
          });
        }
      };

      if (typeof ctx?.inject === 'function') {
        ctx.inject(['tools', 'systemPrompt'], installAgentCapabilities);
      } else {
        installAgentCapabilities(ctx);
      }

      logger?.info?.(`[${name}] host ready: ${API_ROUTE}`);
    },
  });
}

const defaultPlugin = createBuptAssistantPlugin();
export const apply = defaultPlugin.apply;
export default defaultPlugin;
