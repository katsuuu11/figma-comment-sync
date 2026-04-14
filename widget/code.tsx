const { widget } = figma;
const {
  AutoLayout,
  Text,
  Input,
  useEffect,
  useSyncedState,
} = widget;

const NS = 'figma_annotation';
const CONFIG_KEY = 'config';

const TYPES = ['仕様', '修正', '確認'] as const;
const STATUS = ['未対応', '対応中', '完了'] as const;

const TYPE_COLOR: Record<string, string> = {
  仕様: '#DCEBFF',
  修正: '#FFDCE0',
  確認: '#FFF5CC',
};

type Config = {
  endpointUrl: string;
  members: string[];
};

function parseConfig(): Config {
  const raw = figma.root.getSharedPluginData(NS, CONFIG_KEY);
  if (!raw) return { endpointUrl: '', members: [] };
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

function closestFrameName(node: SceneNode | null): string {
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === 'FRAME') return current.name;
    current = current.parent;
  }
  return '';
}

function buildFigmaUrl(nodeId: string): string {
  const fileKey = figma.fileKey ?? '';
  if (!fileKey) return '';
  return `https://www.figma.com/file/${fileKey}?node-id=${encodeURIComponent(nodeId)}`;
}

async function postPayload(endpointUrl: string, payload: Record<string, unknown>) {
  if (typeof fetch === 'function') {
    return fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  return new Promise<void>((resolve, reject) => {
    figma.showUI(__html__, { visible: false, width: 1, height: 1 });
    const timeout = setTimeout(() => reject(new Error('Fetch timeout')), 15000);

    figma.ui.onmessage = (msg) => {
      if (msg.type === 'fetch-result') {
        clearTimeout(timeout);
        if (msg.ok) {
          resolve();
        } else {
          reject(new Error(msg.error || 'Fetch failed via iframe'));
        }
      }
    };

    figma.ui.postMessage({ type: 'fetch-post', endpointUrl, payload });
  });
}

function nextValue<T extends readonly string[]>(options: T, current: string): string {
  const i = options.indexOf(current as T[number]);
  return options[(i + 1) % options.length];
}

function AnnotationWidget() {
  const [id, setId] = useSyncedState('id', '');
  const [type, setType] = useSyncedState('type', '仕様');
  const [status, setStatus] = useSyncedState('status', '未対応');
  const [body, setBody] = useSyncedState('body', '');
  const [author, setAuthor] = useSyncedState('author', '');
  const [reviewer, setReviewer] = useSyncedState('reviewer', '');
  const [createdAt, setCreatedAt] = useSyncedState('createdAt', '');
  const [updatedAt, setUpdatedAt] = useSyncedState('updatedAt', '');

  const [membersCsv, setMembersCsv] = useSyncedState('membersCsv', '');
  const [endpointUrl, setEndpointUrl] = useSyncedState('endpointUrl', '');

  useEffect(() => {
    const cfg = parseConfig();
    setMembersCsv(cfg.members.join(','));
    setEndpointUrl(cfg.endpointUrl);
  }, []);

  const members = membersCsv ? membersCsv.split(',').filter(Boolean) : [];
  const fill = TYPE_COLOR[type] || '#F1F1F1';

  const onSave = async () => {
    if (!endpointUrl) {
      figma.notify('先にプラグインでApps Script URLを設定してください');
      return;
    }

    const now = new Date().toISOString();
    if (!createdAt) setCreatedAt(now);
    setUpdatedAt(now);

    const nodeId = figma.widgetId;
    const node = figma.getNodeById(nodeId) as SceneNode | null;
    const payload = {
      id: nodeId,
      type,
      status,
      body,
      author,
      reviewer,
      page: figma.currentPage.name,
      frame: closestFrameName(node),
      createdAt: createdAt || now,
      updatedAt: now,
      figmaUrl: buildFigmaUrl(nodeId),
    };

    try {
      await postPayload(endpointUrl, payload);
      figma.notify('Google Sheetsへ保存しました');
    } catch (error) {
      figma.notify(`保存失敗: ${error}`);
    }
  };

  return (
    <AutoLayout
      name="annotation-sticky"
      direction="vertical"
      fill={fill}
      cornerRadius={12}
      stroke="#B8B8B8"
      padding={12}
      spacing={10}
      width={340}
    >
      <AutoLayout width="fill-parent" spacing={8}>
        <AutoLayout
          fill="#fff"
          cornerRadius={6}
          padding={{ horizontal: 8, vertical: 6 }}
          onClick={() => setType(nextValue(TYPES, type))}
        >
          <Text fontSize={12}>注釈タイプ: {type}</Text>
        </AutoLayout>
        <AutoLayout
          fill="#fff"
          cornerRadius={6}
          padding={{ horizontal: 8, vertical: 6 }}
          onClick={() => setStatus(nextValue(STATUS, status))}
        >
          <Text fontSize={12}>ステータス: {status}</Text>
        </AutoLayout>
      </AutoLayout>

      <AutoLayout fill="#fff" cornerRadius={8} padding={8} width="fill-parent" minHeight={80}>
        <Input
          value={body}
          placeholder="本文を入力"
          onTextEditEnd={(e) => setBody(e.characters)}
          fontSize={12}
          width="fill-parent"
          inputFrameProps={{ padding: 0 }}
        />
      </AutoLayout>

      <AutoLayout width="fill-parent" spacing={8} verticalAlignItems="center">
        <AutoLayout
          fill="#fff"
          cornerRadius={6}
          padding={{ horizontal: 8, vertical: 6 }}
          onClick={() => {
            if (!members.length) return;
            setAuthor(nextValue(members as readonly string[], author || members[0]));
          }}
        >
          <Text fontSize={12}>作成者: {author || '未設定'}</Text>
        </AutoLayout>

        <AutoLayout
          fill="#fff"
          cornerRadius={6}
          padding={{ horizontal: 8, vertical: 6 }}
          onClick={() => {
            if (!members.length) return;
            setReviewer(nextValue(members as readonly string[], reviewer || members[0]));
          }}
        >
          <Text fontSize={12}>確認者: {reviewer || '未設定'}</Text>
        </AutoLayout>
      </AutoLayout>

      <AutoLayout
        fill="#1F6FEB"
        cornerRadius={8}
        padding={{ horizontal: 12, vertical: 8 }}
        horizontalAlignItems="center"
        onClick={() => {
          void onSave();
        }}
      >
        <Text fill="#fff" fontSize={12} fontWeight={600}>保存</Text>
      </AutoLayout>
    </AutoLayout>
  );
}

widget.register(AnnotationWidget);
