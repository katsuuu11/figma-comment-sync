const NS = 'figma-annotation';
const KEY = 'config';

figma.showUI(__html__, { width: 420, height: 520 });

function readConfig() {
  const raw = figma.root.getSharedPluginData(NS, KEY);
  if (!raw) {
    return { endpointUrl: '', members: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      endpointUrl: typeof parsed.endpointUrl === 'string' ? parsed.endpointUrl : '',
      members: Array.isArray(parsed.members) ? parsed.members : [],
    };
  } catch (_error) {
    return { endpointUrl: '', members: [] };
  }
}

function saveConfig(config) {
  figma.root.setSharedPluginData(NS, KEY, JSON.stringify(config));
}

figma.ui.postMessage({ type: 'init', config: readConfig() });

figma.ui.onmessage = (msg) => {
  if (msg.type === 'save-config') {
    const members = Array.isArray(msg.config?.members)
      ? msg.config.members
          .map((name) => String(name).trim())
          .filter(Boolean)
      : [];

    const endpointUrl = typeof msg.config?.endpointUrl === 'string' ? msg.config.endpointUrl.trim() : '';

    saveConfig({ endpointUrl, members });
    figma.notify('設定を保存しました');
    figma.ui.postMessage({ type: 'saved', config: readConfig() });
    return;
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
