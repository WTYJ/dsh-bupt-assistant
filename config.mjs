import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

function defaultDshHome() {
  return process.env.DSH_HOME?.trim()
    ? resolve(process.env.DSH_HOME.trim())
    : join(homedir(), '.dsh');
}

export function defaultDataDir() {
  return join(defaultDshHome(), 'integrations', 'dsh-bupt-assistant');
}

export function defaultConfigFilePath() {
  return join(defaultDataDir(), 'settings.json');
}

export function defaultExportDir() {
  return join(homedir(), 'Documents', 'bupt-assistant');
}

export function defaultBuptAgentDir() {
  return join(homedir(), 'Projects', 'bupt-anything');
}

export function defaultUvBin() {
  const candidate = join(homedir(), '.local', 'bin', 'uv');
  return existsSync(candidate) ? candidate : 'uv';
}

export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  configFile: null,
  autoSync: Object.freeze({
    enabled: true,
    intervalMinutes: 120,
    syncOnStartup: true,
  }),
  ucloudSync: Object.freeze({
    enabled: true,
    includeUpcoming: true,
  }),
  academicSync: Object.freeze({
    enabled: true,
    scheduleDays: 3,
  }),
  exportMarkdown: Object.freeze({
    dir: '',
    scheduleFileName: '待办与日程.md',
  }),
  contextInject: Object.freeze({
    enabled: true,
  }),
  paths: Object.freeze({
    buptAgentDir: '',
    uvBin: '',
  }),
});

function clampInt(val, min, max, fallback) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function cleanStr(val, fallback = '') {
  return typeof val === 'string' ? val.trim() : fallback;
}

function expandHome(p) {
  if (!p) return '';
  if (p === '~') return homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return join(homedir(), p.slice(2));
  return p;
}

export function normalizeConfig(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const auto = src.autoSync && typeof src.autoSync === 'object' ? src.autoSync : {};
  const ucloud = src.ucloudSync && typeof src.ucloudSync === 'object' ? src.ucloudSync : {};
  const academic = src.academicSync && typeof src.academicSync === 'object' ? src.academicSync : {};
  const exp = src.exportMarkdown && typeof src.exportMarkdown === 'object' ? src.exportMarkdown : {};
  const ctxInj = src.contextInject && typeof src.contextInject === 'object' ? src.contextInject : {};
  const paths = src.paths && typeof src.paths === 'object' ? src.paths : {};

  return {
    enabled: src.enabled !== undefined ? Boolean(src.enabled) : DEFAULT_CONFIG.enabled,
    configFile: cleanStr(src.configFile) || defaultConfigFilePath(),
    autoSync: {
      enabled: auto.enabled !== undefined ? Boolean(auto.enabled) : DEFAULT_CONFIG.autoSync.enabled,
      intervalMinutes: clampInt(auto.intervalMinutes, 10, 1440, DEFAULT_CONFIG.autoSync.intervalMinutes),
      syncOnStartup:
        auto.syncOnStartup !== undefined
          ? Boolean(auto.syncOnStartup)
          : DEFAULT_CONFIG.autoSync.syncOnStartup,
    },
    ucloudSync: {
      enabled:
        ucloud.enabled !== undefined ? Boolean(ucloud.enabled) : DEFAULT_CONFIG.ucloudSync.enabled,
      includeUpcoming:
        ucloud.includeUpcoming !== undefined
          ? Boolean(ucloud.includeUpcoming)
          : DEFAULT_CONFIG.ucloudSync.includeUpcoming,
    },
    academicSync: {
      enabled:
        academic.enabled !== undefined
          ? Boolean(academic.enabled)
          : DEFAULT_CONFIG.academicSync.enabled,
      scheduleDays: clampInt(academic.scheduleDays, 1, 7, DEFAULT_CONFIG.academicSync.scheduleDays),
    },
    exportMarkdown: {
      dir: cleanStr(exp.dir),
      scheduleFileName:
        cleanStr(exp.scheduleFileName, DEFAULT_CONFIG.exportMarkdown.scheduleFileName) || '待办与日程.md',
    },
    contextInject: {
      enabled:
        ctxInj.enabled !== undefined ? Boolean(ctxInj.enabled) : DEFAULT_CONFIG.contextInject.enabled,
    },
    paths: {
      buptAgentDir: cleanStr(paths.buptAgentDir),
      uvBin: cleanStr(paths.uvBin),
    },
  };
}

export function resolveEffectivePaths(cfg) {
  const exportDir = cfg.exportMarkdown?.dir
    ? resolve(expandHome(cfg.exportMarkdown.dir))
    : defaultExportDir();
  const buptAgentDir = cfg.paths?.buptAgentDir
    ? resolve(expandHome(cfg.paths.buptAgentDir))
    : defaultBuptAgentDir();
  const uvBin = cfg.paths?.uvBin ? expandHome(cfg.paths.uvBin) : defaultUvBin();
  const stateDir = cfg.configFile ? dirname(cfg.configFile) : defaultDataDir();
  const scheduleFileName = cfg.exportMarkdown?.scheduleFileName || '待办与日程.md';

  return {
    exportDir,
    buptAgentDir,
    uvBin,
    stateFile: join(stateDir, 'state.json'),
    scheduleFile: join(exportDir, scheduleFileName),
  };
}

export function resolveLiveConfig(baseConfig) {
  const base = normalizeConfig(baseConfig);
  const filePath = base.configFile;
  if (!filePath || !existsSync(filePath)) return base;
  try {
    const fileData = JSON.parse(readFileSync(filePath, 'utf8'));
    return normalizeConfig({
      ...base,
      ...fileData,
      autoSync: { ...base.autoSync, ...(fileData?.autoSync || {}) },
      ucloudSync: { ...base.ucloudSync, ...(fileData?.ucloudSync || {}) },
      academicSync: { ...base.academicSync, ...(fileData?.academicSync || {}) },
      exportMarkdown: { ...base.exportMarkdown, ...(fileData?.exportMarkdown || {}) },
      contextInject: { ...base.contextInject, ...(fileData?.contextInject || {}) },
      paths: { ...base.paths, ...(fileData?.paths || {}) },
      configFile: filePath,
    });
  } catch {
    return base;
  }
}

export function saveLiveConfig(baseConfig, patch = {}) {
  const current = resolveLiveConfig(baseConfig);
  const next = normalizeConfig({
    ...current,
    ...patch,
    autoSync: { ...current.autoSync, ...(patch?.autoSync || {}) },
    ucloudSync: { ...current.ucloudSync, ...(patch?.ucloudSync || {}) },
    academicSync: { ...current.academicSync, ...(patch?.academicSync || {}) },
    exportMarkdown: { ...current.exportMarkdown, ...(patch?.exportMarkdown || {}) },
    contextInject: { ...current.contextInject, ...(patch?.contextInject || {}) },
    paths: { ...current.paths, ...(patch?.paths || {}) },
    configFile: current.configFile,
  });

  if (next.configFile) {
    mkdirSync(dirname(next.configFile), { recursive: true });
    const persisted = {
      enabled: next.enabled,
      autoSync: next.autoSync,
      ucloudSync: next.ucloudSync,
      academicSync: next.academicSync,
      exportMarkdown: next.exportMarkdown,
      contextInject: next.contextInject,
      paths: next.paths,
    };
    const tmp = `${next.configFile}.tmp.${process.pid}`;
    writeFileSync(tmp, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
    renameSync(tmp, next.configFile);
  }
  return next;
}
