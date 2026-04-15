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

const TYPE_THEME: Record<string, { containerFill: string; containerStroke: string; badgeFill: string; badgeText: string }> = {
  修正: {
    containerFill: '#FFF0F2',
    containerStroke: '#F4C0D1',
    badgeFill: '#FFDCE0',
    badgeText: '#993556',
  },
  仕様: {
    containerFill: '#EFF4FF',
    containerStroke: '#C7D7F5',
    badgeFill: '#DCEBFF',
    badgeText: '#185FA5',
  },
  確認: {
    containerFill: '#FFFBEB',
    containerStroke: '#F5E0A0',
    badgeFill: '#FFF5CC',
    badgeText: '#854F0B',
  },
};

const STATUS_THEME: Record<string, { fill: string; text: string }> = {
  未対応: { fill: '#FAEEDA', text: '#854F0B' },
  対応中: { fill: '#E6F1FB', text: '#185FA5' },
  完了: { fill: '#EAF3DE', text: '#3B6D11' },
};

const MEMBER_SELECT_HTML = `<!doctype html>
<html>
  <body style="margin:0; font-family: Inter, system-ui, sans-serif;">
    <div style="padding: 12px;">
      <div id="title" style="font-size: 12px; font-weight: 600; margin-bottom: 8px;"></div>
      <div id="members" style="display:flex; flex-direction: column; gap: 6px;"></div>
    </div>

    <script>
      function render(payload) {
        const title = document.getElementById('title');
        const members = document.getElementById('members');

        title.textContent = payload.label + 'を選択';
        members.innerHTML = '';

        payload.members.forEach((name) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = name;
          button.style.border = '1px solid #E1E1E1';
          button.style.background = name === payload.current ? '#F3F8FF' : '#FFFFFF';
          button.style.padding = '6px 8px';
          button.style.textAlign = 'left';
          button.style.borderRadius = '6px';
          button.style.cursor = 'pointer';
          button.onclick = () => {
            parent.postMessage(
              { pluginMessage: { type: 'member-selected', role: payload.role, value: name } },
              '*'
            );
          };
          members.appendChild(button);
        });
      }

      window.onmessage = (event) => {
        const msg = event.data.pluginMessage;
        if (!msg || msg.type !== 'member-select-open') return;
        render(msg);
      };
    </script>
  </body>
</html>`;

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

type MemberRole = 'author' | 'reviewer';

function selectMember(role: MemberRole, label: string, current: string, members: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const height = Math.min(52 + members.length * 36, 260);

    figma.showUI(MEMBER_SELECT_HTML, { width: 220, height });

    figma.ui.onmessage = (message) => {
      if (!message || message.type !== 'member-selected' || message.role !== role) return;
      figma.closePlugin();
      resolve(typeof message.value === 'string' ? message.value : null);
    };

    figma.ui.postMessage({
      type: 'member-select-open',
      role,
      label,
      current,
      members,
    });
  });
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

  const typeTheme = TYPE_THEME[type] || TYPE_THEME['仕様'];
  const statusTheme = STATUS_THEME[status] || STATUS_THEME['未対応'];

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

  const onSelectPerson = (role: MemberRole) => {
    waitForTask(
      (async () => {
        const cfg = parseConfig();
        const members = cfg.members;
        if (!members.length) {
          figma.notify('先にプラグインでメンバーを設定してください');
          return;
        }

        const selected = await selectMember(
          role,
          role === 'author' ? '作成者' : '確認者',
          role === 'author' ? author : reviewer,
          members
        );

        if (!selected) return;
        if (role === 'author') {
          setAuthor(selected);
          return;
        }
        setReviewer(selected);
      })()
    );
  };

  return (
    <AutoLayout
      name="annotation-sticky"
      direction="vertical"
      fill={typeTheme.containerFill}
      cornerRadius={14}
      stroke={typeTheme.containerStroke}
      padding={12}
      spacing={10}
      width={340}
    >
      <AutoLayout width="fill-parent" spacing={8}>
        <AutoLayout
          fill={typeTheme.badgeFill}
          cornerRadius={20}
          padding={{ horizontal: 10, vertical: 4 }}
          onClick={() => setType(nextValue(TYPES, type))}
        >
          <Text fontSize={11} fill={typeTheme.badgeText}>{type}</Text>
        </AutoLayout>
        <AutoLayout
          fill={statusTheme.fill}
          cornerRadius={20}
          padding={{ horizontal: 10, vertical: 4 }}
          onClick={() => setStatus(nextValue(STATUS, status))}
        >
          <Text fontSize={11} fill={statusTheme.text}>{status}</Text>
        </AutoLayout>
      </AutoLayout>

      <AutoLayout width="fill-parent" height={1} fill="#E7E7E7" />

      <AutoLayout
        fill="#FFFFFF"
        cornerRadius={8}
        stroke="#E8E8E8"
        padding={8}
        width="fill-parent"
        minHeight={80}
      >
        <Input
          value={body}
          placeholder="本文を入力"
          onTextEditEnd={(e) => setBody(e.characters)}
          fontSize={12}
          width="fill-parent"
          inputFrameProps={{ padding: 0 }}
        />
      </AutoLayout>

      <AutoLayout width="fill-parent" height={1} fill="#E7E7E7" />

      <AutoLayout width="fill-parent" spacing={12}>
        <AutoLayout direction="vertical" width="fill-parent" spacing={6}>
          <Text fontSize={10} fill="#6B6B6B">作成者</Text>
          <AutoLayout
            fill="#FFFFFF"
            stroke="#E8E8E8"
            cornerRadius={20}
            padding={{ horizontal: 10, vertical: 4 }}
            onClick={() => onSelectPerson('author')}
          >
            <Text fontSize={11}>{author || '未設定'}</Text>
          </AutoLayout>
        </AutoLayout>

        <AutoLayout direction="vertical" width="fill-parent" spacing={6}>
          <Text fontSize={10} fill="#6B6B6B">確認者</Text>
          <AutoLayout
            fill="#FFFFFF"
            stroke="#E8E8E8"
            cornerRadius={20}
            padding={{ horizontal: 10, vertical: 4 }}
            onClick={() => onSelectPerson('reviewer')}
          >
            <Text fontSize={11}>{reviewer || '未設定'}</Text>
          </AutoLayout>
        </AutoLayout>
      </AutoLayout>

      <AutoLayout width="fill-parent" height={1} fill="#E7E7E7" />

      <AutoLayout width="fill-parent" horizontalAlignItems="end">
        <AutoLayout
          fill="#111111"
          cornerRadius={20}
          padding={{ horizontal: 12, vertical: 6 }}
          horizontalAlignItems="center"
          onClick={onSave}
        >
          <Text fill="#FFFFFF" fontSize={11} fontWeight={600}>保存</Text>
        </AutoLayout>
      </AutoLayout>
    </AutoLayout>
  );
}

widget.register(AnnotationWidget);
