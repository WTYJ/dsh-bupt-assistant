/**
 * dsh-bupt-assistant — Client (browser) UI panel for DSH Settings.
 *
 * Mounts:
 * 1. `settings.section` (order: 23, right below "IM 增强开关"): "北邮个人助理"
 * 2. `main` panel + `plugins.detail.actions` button: "打开助理设置"
 */
window.__ModuleLoader__.load({
  id: 'dsh-bupt-assistant',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;

    const React = require('react');
    const h = React.createElement;

    const API_ROUTE = '/dsh-bupt-assistant/api';
    const PANEL_ID = 'dsh-bupt-assistant-panel';
    const PACKAGE_NAME = 'dsh-bupt-assistant';

    const CSS = `
.dba-wrap{box-sizing:border-box;max-width:740px;padding:20px 24px;color:var(--dsw-alias-label-primary,#0f1115);font-size:13px;line-height:1.5}
.dba-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.dba-title{margin:0;font-size:18px;font-weight:600;color:var(--dsw-alias-label-primary,#0f1115)}
.dba-sub{margin:4px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280)}
.dba-badge{padding:3px 10px;border-radius:999px;font-size:12px;font-weight:500;background:rgba(16,185,129,.14);color:#10b981;white-space:nowrap}
.dba-badge-warn{background:rgba(245,158,11,.15);color:#d97706}
.dba-badge-off{background:rgba(120,120,128,.18);color:var(--dsw-alias-label-secondary,#6b7280)}
.dba-stat-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:6px;background:rgba(59,130,246,.12);color:#3b82f6;font-size:12px;font-weight:500}
.dba-card{box-sizing:border-box;padding:16px 18px;margin-bottom:12px;border-radius:12px;background:var(--dsw-alias-bg-layer-2,#f8fafc);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.09))}
.dba-row{display:flex;align-items:center;justify-content:space-between;gap:16px}
.dba-card-title{margin:0;font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,#0f1115)}
.dba-card-desc{margin:4px 0 0;font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280)}
.dba-switch{position:relative;display:inline-flex;align-items:center;width:40px;height:22px;padding:2px;border-radius:999px;border:0;cursor:pointer;transition:background .18s ease;background:rgba(120,120,128,.32);flex:none}
.dba-switch[data-checked="true"]{background:#3b82f6}
.dba-switch:disabled{opacity:.5;cursor:default}
.dba-knob{width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .18s ease;transform:translateX(0)}
.dba-switch[data-checked="true"] .dba-knob{transform:translateX(18px)}
.dba-divider{margin-top:12px;padding-top:12px;border-top:1px dashed var(--dsw-alias-border-l2,rgba(0,0,0,.09))}
.dba-params{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:10px}
.dba-field{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280)}
.dba-input{height:30px;padding:0 10px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.15));background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#0f1115);font-size:12px;box-sizing:border-box}
.dba-input-num{width:76px}
.dba-input-cred{width:168px}
.dba-input-path{width:340px;max-width:100%}
.dba-btn{height:30px;padding:0 12px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.15));background:transparent;color:var(--dsw-alias-label-primary,#0f1115);font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap}
.dba-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}
.dba-btn:disabled{opacity:.5;cursor:default}
.dba-btn-primary{background:#3b82f6;border-color:#3b82f6;color:#fff}
.dba-btn-primary:hover:not(:disabled){background:#2563eb;border-color:#2563eb}
.dba-btn-danger{color:#ef4444;border-color:rgba(239,68,68,.35)}
.dba-btn-danger:hover:not(:disabled){background:rgba(239,68,68,.1)}
.dba-subcard{padding:12px 14px;border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));margin-top:10px}
.dba-cred-grid{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:10px}
.dba-radar{margin-top:10px;padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));font-size:12px}
.dba-radar-line{margin:3px 0;color:var(--dsw-alias-label-primary,#0f1115)}
.dba-msg{margin-top:8px;font-size:12px;color:#3b82f6}
.dba-msg-err{color:#ef4444}
.dba-msg-ok{color:#10b981}
body[data-ds-dark-theme] .dba-wrap{color:var(--dsw-alias-label-primary,#f3f4f6)}
body[data-ds-dark-theme] .dba-title,body[data-ds-dark-theme] .dba-card-title,body[data-ds-dark-theme] .dba-radar-line{color:var(--dsw-alias-label-primary,#f3f4f6)}
body[data-ds-dark-theme] .dba-sub,body[data-ds-dark-theme] .dba-card-desc,body[data-ds-dark-theme] .dba-field{color:var(--dsw-alias-label-secondary,#9ca3af)}
body[data-ds-dark-theme] .dba-card{background:var(--dsw-alias-bg-layer-2,#262629);border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.1))}
body[data-ds-dark-theme] .dba-subcard,body[data-ds-dark-theme] .dba-radar{background:var(--dsw-alias-bg-layer-1,#1c1c1e);border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.1))}
body[data-ds-dark-theme] .dba-divider{border-top-color:var(--dsw-alias-border-l2,rgba(255,255,255,.1))}
body[data-ds-dark-theme] .dba-input{background:var(--dsw-alias-bg-layer-1,#1c1c1e);color:var(--dsw-alias-label-primary,#f3f4f6);border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.16))}
body[data-ds-dark-theme] .dba-btn{color:var(--dsw-alias-label-primary,#f3f4f6);border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.16))}
body[data-ds-dark-theme] .dba-btn-primary{color:#fff;border-color:#3b82f6}
`;

    function Switch({ checked, disabled, onChange, label }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          'aria-checked': Boolean(checked),
          'aria-label': label,
          'data-checked': Boolean(checked) ? 'true' : 'false',
          className: 'dba-switch',
          disabled: Boolean(disabled),
          onClick: () => onChange(!checked),
        },
        h('span', { className: 'dba-knob' }),
      );
    }

    function CredentialCard({ title, desc, service, configured, busy, onSave, onDelete }) {
      const [username, setUsername] = React.useState('');
      const [password, setPassword] = React.useState('');

      const handleSave = async () => {
        if (!username.trim() || !password) return;
        const ok = await onSave(service, username.trim(), password);
        if (ok) {
          setPassword('');
        }
      };

      return h(
        'div',
        { className: 'dba-subcard' },
        h(
          'div',
          { className: 'dba-row' },
          h(
            'div',
            null,
            h('div', { className: 'dba-card-title', style: { fontSize: '13px' } }, title),
            h('div', { className: 'dba-card-desc' }, desc),
          ),
          h(
            'span',
            { className: configured ? 'dba-badge' : 'dba-badge dba-badge-off' },
            configured ? '已存入系统钥匙串' : '未配置',
          ),
        ),
        h(
          'div',
          { className: 'dba-cred-grid' },
          h('input', {
            type: 'text',
            className: 'dba-input dba-input-cred',
            placeholder: '学号',
            autoComplete: 'off',
            value: username,
            disabled: busy,
            onChange: (e) => setUsername(e.target.value),
          }),
          h('input', {
            type: 'password',
            className: 'dba-input dba-input-cred',
            placeholder: service === 'ucloud' ? '统一认证密码' : '移动教务密码',
            autoComplete: 'new-password',
            value: password,
            disabled: busy,
            onChange: (e) => setPassword(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') handleSave();
            },
          }),
          h(
            'button',
            {
              type: 'button',
              className: 'dba-btn dba-btn-primary',
              disabled: busy || !username.trim() || !password,
              onClick: handleSave,
            },
            configured ? '更新钥匙串' : '保存到钥匙串',
          ),
          configured
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'dba-btn dba-btn-danger',
                  disabled: busy,
                  onClick: () => onDelete(service),
                },
                '清除凭据',
              )
            : null,
        ),
      );
    }

    function BuptAssistantPanel() {
      const [meta, setMeta] = React.useState({
        name: PACKAGE_NAME,
        version: '1.0.0',
        license: 'MIT',
      });
      const [settings, setSettings] = React.useState(null);
      const [credentials, setCredentials] = React.useState({
        ucloud: { configured: false },
        academic: { configured: false },
      });
      const [syncStatus, setSyncStatus] = React.useState(null);
      const [statusMsg, setStatusMsg] = React.useState({ text: '加载中…', kind: 'info' });
      const [busy, setBusy] = React.useState(false);
      const [credMsg, setCredMsg] = React.useState(null);
      const [verifyResult, setVerifyResult] = React.useState(null);

      const loadAll = React.useCallback(() => {
        return fetch(API_ROUTE, { method: 'GET', credentials: 'same-origin' })
          .then((r) => r.json())
          .then((data) => {
            if (data?.ok && data.settings) {
              if (data.meta) setMeta(data.meta);
              setSettings(data.settings);
              if (data.credentials) setCredentials(data.credentials);
              if (data.syncStatus) setSyncStatus(data.syncStatus);
              setStatusMsg({ text: '全部开关实时热生效，无需重启 DSH', kind: 'info' });
            } else {
              setStatusMsg({ text: '读取插件状态失败', kind: 'err' });
            }
          })
          .catch(() => {
            setStatusMsg({ text: '无法连接北邮个人助理后台服务', kind: 'err' });
          });
      }, []);

      React.useEffect(() => {
        loadAll();
      }, [loadAll]);

      const postApi = (payload) =>
        fetch(API_ROUTE, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then((r) => r.json());

      const updatePatch = (patch) => {
        if (!settings) return;
        const optimistic = {
          ...settings,
          ...patch,
          autoSync: { ...settings.autoSync, ...(patch.autoSync || {}) },
          ucloudSync: { ...settings.ucloudSync, ...(patch.ucloudSync || {}) },
          academicSync: { ...settings.academicSync, ...(patch.academicSync || {}) },
          exportMarkdown: { ...settings.exportMarkdown, ...(patch.exportMarkdown || {}) },
          contextInject: { ...settings.contextInject, ...(patch.contextInject || {}) },
          paths: { ...settings.paths, ...(patch.paths || {}) },
        };
        setSettings(optimistic);
        setBusy(true);
        postApi({ action: 'saveSettings', patch })
          .then((data) => {
            if (data?.ok && data.settings) {
              setSettings(data.settings);
              if (data.credentials) setCredentials(data.credentials);
              if (data.syncStatus) setSyncStatus(data.syncStatus);
              setStatusMsg({ text: '已保存并实时生效', kind: 'ok' });
            } else {
              setStatusMsg({ text: data?.error || '保存失败', kind: 'err' });
            }
          })
          .catch(() => setStatusMsg({ text: '保存请求失败', kind: 'err' }))
          .finally(() => setBusy(false));
      };

      const handleSaveCredential = async (service, username, password) => {
        setBusy(true);
        setCredMsg({ text: '正在写入系统钥匙串…', kind: 'info' });
        try {
          const data = await postApi({ action: 'saveCredential', service, username, password });
          if (data.credentials) setCredentials(data.credentials);
          if (data.ok) {
            setCredMsg({
              text: `${service === 'ucloud' ? '教学云' : '移动教务'}凭据已安全存入系统钥匙串（可点击「测试连通」验证）`,
              kind: 'ok',
            });
            return true;
          }
          setCredMsg({ text: data?.error?.message || '写入钥匙串失败', kind: 'err' });
          return false;
        } catch {
          setCredMsg({ text: '请求异常，写入失败', kind: 'err' });
          return false;
        } finally {
          setBusy(false);
        }
      };

      const handleDeleteCredential = async (service) => {
        setBusy(true);
        setCredMsg({ text: '正在从系统钥匙串清除…', kind: 'info' });
        try {
          const data = await postApi({ action: 'deleteCredential', service });
          if (data.credentials) setCredentials(data.credentials);
          setCredMsg({
            text: data.ok
              ? `已清除${service === 'ucloud' ? '教学云' : '移动教务'}凭据`
              : data?.error?.message || '清除失败',
            kind: data.ok ? 'ok' : 'err',
          });
        } catch {
          setCredMsg({ text: '清除请求异常', kind: 'err' });
        } finally {
          setBusy(false);
        }
      };

      const handleVerify = async () => {
        setBusy(true);
        setCredMsg({ text: '正在向学校接口测试连通性…', kind: 'info' });
        setVerifyResult(null);
        try {
          const data = await postApi({ action: 'verifyCredentials' });
          if (data.credentials) setCredentials(data.credentials);
          setVerifyResult(data.verify || null);
          const uOk = data.verify?.data?.ucloud?.ok;
          const aOk = data.verify?.data?.academic?.ok;
          setCredMsg({
            text: `验证完成 — 教学云：${uOk ? '✅ 连通' : `❌ ${data.verify?.data?.ucloud?.error?.message || '未通过'}`}；移动教务：${aOk ? '✅ 连通' : `❌ ${data.verify?.data?.academic?.error?.message || '未通过'}`}`,
            kind: uOk && aOk ? 'ok' : 'err',
          });
        } catch {
          setCredMsg({ text: '连通性测试请求失败', kind: 'err' });
        } finally {
          setBusy(false);
        }
      };

      const handleSyncNow = async () => {
        setBusy(true);
        setStatusMsg({ text: '正在拉取最新教学云作业 DDL、课表与考试…', kind: 'info' });
        try {
          const data = await postApi({ action: 'syncNow' });
          if (data.syncStatus) setSyncStatus(data.syncStatus);
          if (data.ok && data.summary) {
            const s = data.summary;
            setStatusMsg({
              text: `同步成功（${s.syncedAt}）：待办作业 ${s.ucloud?.todoCount ?? 0} 项、考试 ${s.academic?.examCount ?? 0} 项`,
              kind: 'ok',
            });
          } else {
            setStatusMsg({ text: data?.summary?.error || '同步失败', kind: 'err' });
          }
        } catch {
          setStatusMsg({ text: '同步请求失败', kind: 'err' });
        } finally {
          setBusy(false);
        }
      };

      if (!settings) {
        return h(
          'div',
          { className: 'dba-wrap' },
          h('h2', { className: 'dba-title' }, '北邮个人助理'),
          h('p', { className: 'dba-sub' }, statusMsg.text),
        );
      }

      const masterOn = Boolean(settings.enabled);
      const radarLines = syncStatus?.radar?.radarLines || [];
      const syncedAt = syncStatus?.radar?.syncedAt || syncStatus?.lastSummary?.syncedAt || '尚未同步';

      return h(
        'div',
        { className: 'dba-wrap' },
        // Header
        h(
          'div',
          { className: 'dba-header' },
          h(
            'div',
            null,
            h('h2', { className: 'dba-title' }, '北邮个人助理'),
            h('p', { className: 'dba-sub' }, '系统钥匙串安全登录 · 自动同步教学云作业 DDL / 教务课表 / 考试 · 导出至任意 Markdown 目录'),
          ),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            h(
              'button',
              {
                type: 'button',
                className: 'dba-btn dba-btn-primary',
                disabled: busy || !masterOn,
                onClick: handleSyncNow,
              },
              busy ? '处理中…' : '立即同步',
            ),
            h(Switch, {
              checked: masterOn,
              disabled: busy,
              label: '北邮个人助理总开关',
              onChange: (v) => updatePatch({ enabled: v }),
            }),
          ),
        ),
        h(
          'div',
          {
            className:
              statusMsg.kind === 'err'
                ? 'dba-msg dba-msg-err'
                : statusMsg.kind === 'ok'
                  ? 'dba-msg dba-msg-ok'
                  : 'dba-msg',
            style: { marginTop: 0, marginBottom: '12px' },
          },
          `状态：${statusMsg.text}`,
        ),

        // 1. Keychain Credentials Card
        h(
          'div',
          { className: 'dba-card' },
          h(
            'div',
            { className: 'dba-row' },
            h(
              'div',
              null,
              h('h3', { className: 'dba-card-title' }, '🔐 校园账号（macOS 系统钥匙串）'),
              h(
                'p',
                { className: 'dba-card-desc' },
                '密码通过本机回环与 stdin 直写操作系统钥匙串，绝不落明文配置文件、不进聊天记录、不暴露给模型。',
              ),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dba-btn',
                disabled: busy || (!credentials.ucloud?.configured && !credentials.academic?.configured),
                onClick: handleVerify,
              },
              '测试连通',
            ),
          ),
          h(CredentialCard, {
            title: '北邮教学云（UCloud）',
            desc: '用于同步未交作业 DDL、通知中未开始作业与所属课程',
            service: 'ucloud',
            configured: Boolean(credentials.ucloud?.configured),
            busy,
            onSave: handleSaveCredential,
            onDelete: handleDeleteCredential,
          }),
          h(CredentialCard, {
            title: '北邮移动教务',
            desc: '用于同步近期课表（含节次时间）与期末/期中考试安排',
            service: 'academic',
            configured: Boolean(credentials.academic?.configured),
            busy,
            onSave: handleSaveCredential,
            onDelete: handleDeleteCredential,
          }),
          credMsg
            ? h(
                'div',
                {
                  className:
                    credMsg.kind === 'err'
                      ? 'dba-msg dba-msg-err'
                      : credMsg.kind === 'ok'
                        ? 'dba-msg dba-msg-ok'
                        : 'dba-msg',
                },
                credMsg.text,
              )
            : null,
          verifyResult && !verifyResult.ok
            ? h(
                'div',
                { className: 'dba-card-desc', style: { marginTop: '6px' } },
                '提示：如遇验证码或校园网限制，请确认网络连通后重试。',
              )
            : null,
        ),

        // 2. Built-in Auto Sync Switch
        h(
          'div',
          { className: 'dba-card' },
          h(
            'div',
            { className: 'dba-row' },
            h(
              'div',
              null,
              h('h3', { className: 'dba-card-title' }, '🔄 DSH 内置自动同步（无需系统定时任务）'),
              h(
                'p',
                { className: 'dba-card-desc' },
                `DSH 运行期间自动定时刷新 ${settings.exportMarkdown.scheduleFileName} 的同步区块，绝不覆盖你的个人手记内容。`,
              ),
            ),
            h(Switch, {
              checked: settings.autoSync.enabled,
              disabled: busy || !masterOn,
              label: '自动同步开关',
              onChange: (v) => updatePatch({ autoSync: { enabled: v } }),
            }),
          ),
          h(
            'div',
            { className: 'dba-params dba-divider' },
            h(
              'span',
              { className: 'dba-stat-pill' },
              syncStatus?.schedulerActive
                ? `最近同步：${syncedAt} · 定时运行中`
                : `最近同步：${syncedAt}`,
            ),
            h(
              'label',
              { className: 'dba-field' },
              '刷新间隔（分钟）',
              h('input', {
                type: 'number',
                min: 10,
                max: 1440,
                className: 'dba-input dba-input-num',
                value: settings.autoSync.intervalMinutes,
                disabled: busy || !masterOn || !settings.autoSync.enabled,
                onChange: (e) =>
                  setSettings({
                    ...settings,
                    autoSync: { ...settings.autoSync, intervalMinutes: Number(e.target.value) || 120 },
                  }),
                onBlur: (e) =>
                  updatePatch({ autoSync: { intervalMinutes: Number(e.target.value) || 120 } }),
              }),
            ),
            h(
              'label',
              { className: 'dba-field', style: { cursor: 'pointer' } },
              h('input', {
                type: 'checkbox',
                checked: Boolean(settings.autoSync.syncOnStartup),
                disabled: busy || !masterOn || !settings.autoSync.enabled,
                onChange: (e) => updatePatch({ autoSync: { syncOnStartup: e.target.checked } }),
              }),
              'DSH 启动后自动同步一次',
            ),
          ),
        ),

        // 3. Data Source Switches
        h(
          'div',
          { className: 'dba-card' },
          h('h3', { className: 'dba-card-title' }, '📚 数据源独立开关'),
          h(
            'div',
            { className: 'dba-row dba-divider' },
            h(
              'div',
              null,
              h('div', { className: 'dba-card-title', style: { fontSize: '13px' } }, '教学云作业与 DDL'),
              h('div', { className: 'dba-card-desc' }, '同步未完成待办、自动反查课程名，并扫描通知提前发现未开始作业'),
            ),
            h(Switch, {
              checked: settings.ucloudSync.enabled,
              disabled: busy || !masterOn,
              label: '教学云同步开关',
              onChange: (v) => updatePatch({ ucloudSync: { enabled: v } }),
            }),
          ),
          h(
            'div',
            { className: 'dba-row dba-divider' },
            h(
              'div',
              null,
              h('div', { className: 'dba-card-title', style: { fontSize: '13px' } }, '移动教务课表与考试'),
              h('div', { className: 'dba-card-desc' }, '同步今/明/后天课表（识别早八/早课）与考试倒计时'),
            ),
            h(Switch, {
              checked: settings.academicSync.enabled,
              disabled: busy || !masterOn,
              label: '教务同步开关',
              onChange: (v) => updatePatch({ academicSync: { enabled: v } }),
            }),
          ),
        ),

        // 4. Markdown Export & Generic Workspace Context Card
        h(
          'div',
          { className: 'dba-card' },
          h(
            'div',
            { className: 'dba-row' },
            h(
              'div',
              null,
              h('h3', { className: 'dba-card-title' }, '📂 Markdown 导出与工作区摘要'),
              h(
                'p',
                { className: 'dba-card-desc' },
                '将同步结果写入你指定的任意目录（如 DSH 工作区、Obsidian 笔记库等）；仅更新自动标记区，不覆盖手记内容。',
              ),
            ),
          ),
          h(
            'div',
            { className: 'dba-params dba-divider' },
            h(
              'label',
              { className: 'dba-field' },
              '导出目录',
              h('input', {
                type: 'text',
                className: 'dba-input dba-input-path',
                placeholder: syncStatus?.effectivePaths?.exportDir || '~/Documents/bupt-assistant',
                value: settings.exportMarkdown.dir,
                disabled: busy,
                onChange: (e) =>
                  setSettings({
                    ...settings,
                    exportMarkdown: { ...settings.exportMarkdown, dir: e.target.value },
                  }),
                onBlur: (e) => updatePatch({ exportMarkdown: { dir: e.target.value.trim() } }),
              }),
            ),
          ),
          h(
            'div',
            { className: 'dba-params' },
            h(
              'label',
              { className: 'dba-field' },
              '导出文件名',
              h('input', {
                type: 'text',
                className: 'dba-input dba-input-cred',
                value: settings.exportMarkdown.scheduleFileName,
                disabled: busy,
                onChange: (e) =>
                  setSettings({
                    ...settings,
                    exportMarkdown: { ...settings.exportMarkdown, scheduleFileName: e.target.value },
                  }),
                onBlur: (e) =>
                  updatePatch({
                    exportMarkdown: { scheduleFileName: e.target.value.trim() || '待办与日程.md' },
                  }),
              }),
            ),
          ),
          h(
            'div',
            { className: 'dba-row dba-divider' },
            h(
              'div',
              null,
              h('div', { className: 'dba-card-title', style: { fontSize: '13px' } }, '向匹配工作区注入客观日程摘要'),
              h(
                'div',
                { className: 'dba-card-desc' },
                '可选：仅当 DSH 当前会话的工作区等于上方「导出目录」时，将近期摘要作为中立事实上下文提供给当前 Agent（不绑任何角色，不改动 AGENTS.md）。',
              ),
            ),
            h(Switch, {
              checked: settings.contextInject.enabled,
              disabled: busy || !masterOn,
              label: '工作区日程摘要注入开关',
              onChange: (v) => updatePatch({ contextInject: { enabled: v } }),
            }),
          ),
          h(
            'div',
            { className: 'dba-radar' },
            h(
              'div',
              { style: { fontWeight: 600, marginBottom: '6px' } },
              `⚡ 当前导出摘要预览（${syncedAt}）`,
            ),
            radarLines.length > 0
              ? radarLines.map((line, i) =>
                  h('div', { key: i, className: 'dba-radar-line' }, line),
                )
              : h('div', { className: 'dba-card-desc' }, '暂无提醒项（登录并点击「立即同步」后刷新）'),
          ),
        ),

        // 5. About Card
        h(
          'div',
          { className: 'dba-card' },
          h(
            'div',
            { className: 'dba-row' },
            h(
              'div',
              null,
              h('h3', { className: 'dba-card-title' }, 'ℹ️ 关于'),
              h(
                'p',
                { className: 'dba-card-desc' },
                'DSH 独立北邮校内数据同步与 Markdown 导出插件（零外部 npm 运行时依赖，不修改原插件或工作区指令文件）。',
              ),
            ),
            h('span', { className: 'dba-badge' }, `v${meta.version || '1.0.0'}`),
          ),
          h(
            'div',
            { className: 'dba-divider', style: { display: 'grid', gap: '6px', fontSize: '12px' } },
            h(
              'div',
              { className: 'dba-row' },
              h('span', { className: 'dba-field' }, '插件包名'),
              h('code', null, meta.name || PACKAGE_NAME),
            ),
            h(
              'div',
              { className: 'dba-row' },
              h('span', { className: 'dba-field' }, '当前版本'),
              h('span', null, `v${meta.version || '1.0.0'}`),
            ),
            h(
              'div',
              { className: 'dba-row' },
              h('span', { className: 'dba-field' }, '开源协议'),
              h('span', null, meta.license || 'MIT'),
            ),
            h(
              'div',
              { className: 'dba-row' },
              h('span', { className: 'dba-field' }, '凭据安全'),
              h('span', null, '仅直写系统钥匙串（macOS Keychain），不落明文文件、不进对话'),
            ),
            h(
              'div',
              { className: 'dba-row' },
              h('span', { className: 'dba-field' }, '数据采集引擎'),
              h('span', null, '外部隔离进程调用 bupt-anything（仅直连北邮官方域名）'),
            ),
          ),
        ),
      );
    }

    function OpenAssistantButton({ subject, onOpen }) {
      if (!subject) return null;
      if (subject.kind === 'installed' && subject.plugin?.name !== PACKAGE_NAME) return null;
      if (subject.kind === 'row' && subject.row?.moduleName !== PACKAGE_NAME) return null;
      return h(
        'button',
        {
          type: 'button',
          className: 'dba-btn',
          onClick: onOpen,
        },
        '打开助理设置',
      );
    }

    function apply(ctx) {
      ctx.effect(() => {
        const style = document.createElement('style');
        style.setAttribute('data-plugin', PACKAGE_NAME);
        style.textContent = CSS;
        document.head.append(style);
        return () => style.remove();
      }, `${PACKAGE_NAME}: stylesheet`);

      // 1. Register inside Settings -> "北邮个人助理"
      if (ctx?.slots?.inject) {
        ctx.effect(
          () =>
            ctx.slots.inject('settings.section', () =>
              ctx.slots.register(
                {
                  name: 'settings.section',
                  id: 'dsh-bupt-assistant-settings',
                  order: 23,
                  label: () => '北邮个人助理',
                },
                BuptAssistantPanel,
              ),
            ),
          `${PACKAGE_NAME}: settings.section`,
        );
      }

      // 2. Register dedicated panel + Plugins detail action button
      if (typeof ctx?.inject === 'function') {
        ctx.inject(['layout'], (pageCtx) => {
          pageCtx.slots.inject('main', () => {
            const unregMain = pageCtx.slots.register(
              { name: 'main', key: PANEL_ID },
              BuptAssistantPanel,
            );
            const stopAction = pageCtx.slots.inject('plugins.detail.actions', () =>
              pageCtx.slots.register(
                {
                  name: 'plugins.detail.actions',
                  id: 'dsh-bupt-assistant-open',
                  order: 20,
                  inject: () => ({
                    onOpen: () => pageCtx.layout.selectPanel(PANEL_ID),
                  }),
                },
                OpenAssistantButton,
              ),
            );
            return () => {
              stopAction();
              unregMain();
            };
          });
        });
      }
    }

    exports.name = 'dsh-bupt-assistant-client';
    exports.inject = ['slots', 'locale'];
    exports.apply = apply;
    return module.exports;
  },
});
