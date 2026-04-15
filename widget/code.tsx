const { widget } = figma;
const {
  AutoLayout,
  Text,
  Input,
  waitForTask,
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
  return `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(nodeId)}`;
}

async function postPayload(endpointUrl: string, payload: Record<string, unknown>) {
  const res = await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });
  return res;
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

  const fill = TYPE_COLOR[type] || '#F1F1F1';

  const onSave = () => {
    waitForTask(
      (async () => {
        const cfg = parseConfig();
        const url = cfg.endpointUrl;
        if (!url) {
          figma.notify('先にプラグインでApps Script URLを設定してください');
          return;
        }
        const now = new Date().toISOString();
        const nodeId = figma.widgetId;
        const node = figma.getNodeById(nodeId) as SceneNode | null;

        if (!createdAt) setCreatedAt(now);
        setUpdatedAt(now);

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
          const res = await postPayload(url, payload);
          const text = await res.text();
          let result;
          try {
            result = JSON.parse(text);
          } catch {
            figma.notify(`保存失敗: レスポンスがJSONではありません: ${text}`);
            return;
          }
          if (!result.ok) {
            figma.notify(`保存失敗: ${result.error || '不明なエラー'}`);
            return;
          }
          figma.notify('Google Sheetsへ保存しました');
        } catch (error) {
          figma.notify(`保存失敗: ${error}`);
        }
      })()
    );
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
            const cfg = parseConfig();
            const members = cfg.members;
            if (!members.length) {
              figma.notify('先にプラグインでメンバーを設定してください');
              return;
            }
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
            const cfg = parseConfig();
            const members = cfg.members;
            if (!members.length) {
              figma.notify('先にプラグインでメンバーを設定してください');
              return;
            }
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
        onClick={onSave}
      >
        <Text fill="#fff" fontSize={12} fontWeight={600}>保存</Text>
      </AutoLayout>
    </AutoLayout>
  );
}

widget.register(AnnotationWidget);
