(() => {
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // code.tsx
  var { widget } = figma;
  var {
    AutoLayout,
    Text,
    Input,
    waitForTask,
    useSyncedState
  } = widget;
  var NS = "figma_annotation";
  var CONFIG_KEY = "config";
  var TYPES = ["\u4ED5\u69D8", "\u4FEE\u6B63", "\u78BA\u8A8D"];
  var STATUS = ["\u672A\u5BFE\u5FDC", "\u5BFE\u5FDC\u4E2D", "\u5B8C\u4E86"];
  var TYPE_THEME = {
    \u4FEE\u6B63: {
      containerFill: "#FFF0F2",
      containerStroke: "#F4C0D1",
      badgeFill: "#FFDCE0",
      badgeText: "#993556"
    },
    \u4ED5\u69D8: {
      containerFill: "#EFF4FF",
      containerStroke: "#C7D7F5",
      badgeFill: "#DCEBFF",
      badgeText: "#185FA5"
    },
    \u78BA\u8A8D: {
      containerFill: "#FFFBEB",
      containerStroke: "#F5E0A0",
      badgeFill: "#FFF5CC",
      badgeText: "#854F0B"
    }
  };
  var STATUS_THEME = {
    \u672A\u5BFE\u5FDC: { fill: "#FAEEDA", text: "#854F0B" },
    \u5BFE\u5FDC\u4E2D: { fill: "#E6F1FB", text: "#185FA5" },
    \u5B8C\u4E86: { fill: "#EAF3DE", text: "#3B6D11" }
  };
  var MEMBER_SELECT_HTML = `<!doctype html>
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

        title.textContent = payload.label + '\u3092\u9078\u629E';
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
    <\/script>
  </body>
</html>`;
  function parseConfig() {
    const raw = figma.root.getSharedPluginData(NS, CONFIG_KEY);
    if (!raw)
      return { endpointUrl: "", members: [] };
    try {
      const parsed = JSON.parse(raw);
      return {
        endpointUrl: typeof parsed.endpointUrl === "string" ? parsed.endpointUrl : "",
        members: Array.isArray(parsed.members) ? parsed.members : []
      };
    } catch (_error) {
      return { endpointUrl: "", members: [] };
    }
  }
  function closestFrameName(node) {
    let current = node;
    while (current) {
      if (current.type === "FRAME")
        return current.name;
      current = current.parent;
    }
    return "";
  }
  function buildFigmaUrl(nodeId) {
    var _a;
    const fileKey = (_a = figma.fileKey) != null ? _a : "";
    if (!fileKey)
      return "";
    return `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(nodeId)}`;
  }
  function postPayload(endpointUrl, payload) {
    return __async(this, null, function* () {
      const res = yield fetch(endpointUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      });
      return res;
    });
  }
  function nextValue(options, current) {
    const i = options.indexOf(current);
    return options[(i + 1) % options.length];
  }
  function selectMember(role, label, current, members) {
    return new Promise((resolve) => {
      const height = Math.min(52 + members.length * 36, 260);
      figma.showUI(MEMBER_SELECT_HTML, { width: 220, height });
      figma.ui.onmessage = (message) => {
        if (!message || message.type !== "member-selected" || message.role !== role)
          return;
        figma.closePlugin();
        resolve(typeof message.value === "string" ? message.value : null);
      };
      figma.ui.postMessage({
        type: "member-select-open",
        role,
        label,
        current,
        members
      });
    });
  }
  function AnnotationWidget() {
    const [id, setId] = useSyncedState("id", "");
    const [type, setType] = useSyncedState("type", "\u4ED5\u69D8");
    const [status, setStatus] = useSyncedState("status", "\u672A\u5BFE\u5FDC");
    const [body, setBody] = useSyncedState("body", "");
    const [author, setAuthor] = useSyncedState("author", "");
    const [reviewer, setReviewer] = useSyncedState("reviewer", "");
    const [createdAt, setCreatedAt] = useSyncedState("createdAt", "");
    const [updatedAt, setUpdatedAt] = useSyncedState("updatedAt", "");
    const typeTheme = TYPE_THEME[type] || TYPE_THEME["\u4ED5\u69D8"];
    const statusTheme = STATUS_THEME[status] || STATUS_THEME["\u672A\u5BFE\u5FDC"];
    const onSave = () => {
      waitForTask(
        (() => __async(this, null, function* () {
          const cfg = parseConfig();
          const url = cfg.endpointUrl;
          if (!url) {
            figma.notify("\u5148\u306B\u30D7\u30E9\u30B0\u30A4\u30F3\u3067Apps Script URL\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
            return;
          }
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const nodeId = figma.widgetId;
          const node = figma.getNodeById(nodeId);
          if (!createdAt)
            setCreatedAt(now);
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
            figmaUrl: buildFigmaUrl(nodeId)
          };
          try {
            const res = yield postPayload(url, payload);
            const text = yield res.text();
            let result;
            try {
              result = JSON.parse(text);
            } catch (e) {
              figma.notify(`\u4FDD\u5B58\u5931\u6557: \u30EC\u30B9\u30DD\u30F3\u30B9\u304CJSON\u3067\u306F\u3042\u308A\u307E\u305B\u3093: ${text}`);
              return;
            }
            if (!result.ok) {
              figma.notify(`\u4FDD\u5B58\u5931\u6557: ${result.error || "\u4E0D\u660E\u306A\u30A8\u30E9\u30FC"}`);
              return;
            }
            figma.notify("Google Sheets\u3078\u4FDD\u5B58\u3057\u307E\u3057\u305F");
          } catch (error) {
            figma.notify(`\u4FDD\u5B58\u5931\u6557: ${error}`);
          }
        }))()
      );
    };
    const onSelectPerson = (role) => {
      waitForTask(
        (() => __async(this, null, function* () {
          const cfg = parseConfig();
          const members = cfg.members;
          if (!members.length) {
            figma.notify("\u5148\u306B\u30D7\u30E9\u30B0\u30A4\u30F3\u3067\u30E1\u30F3\u30D0\u30FC\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
            return;
          }
          const selected = yield selectMember(
            role,
            role === "author" ? "\u4F5C\u6210\u8005" : "\u78BA\u8A8D\u8005",
            role === "author" ? author : reviewer,
            members
          );
          if (!selected)
            return;
          if (role === "author") {
            setAuthor(selected);
            return;
          }
          setReviewer(selected);
        }))()
      );
    };
    return /* @__PURE__ */ React.createElement(
      AutoLayout,
      {
        name: "annotation-sticky",
        direction: "vertical",
        fill: typeTheme.containerFill,
        cornerRadius: 14,
        stroke: typeTheme.containerStroke,
        padding: 12,
        spacing: 10,
        width: 340
      },
      /* @__PURE__ */ React.createElement(AutoLayout, { width: "fill-parent", spacing: 8 }, /* @__PURE__ */ React.createElement(
        AutoLayout,
        {
          fill: typeTheme.badgeFill,
          cornerRadius: 20,
          padding: { horizontal: 10, vertical: 4 },
          onClick: () => setType(nextValue(TYPES, type))
        },
        /* @__PURE__ */ React.createElement(Text, { fontSize: 11, fill: typeTheme.badgeText }, type)
      ), /* @__PURE__ */ React.createElement(
        AutoLayout,
        {
          fill: statusTheme.fill,
          cornerRadius: 20,
          padding: { horizontal: 10, vertical: 4 },
          onClick: () => setStatus(nextValue(STATUS, status))
        },
        /* @__PURE__ */ React.createElement(Text, { fontSize: 11, fill: statusTheme.text }, status)
      )),
      /* @__PURE__ */ React.createElement(AutoLayout, { width: "fill-parent", height: 1, fill: "#E7E7E7" }),
      /* @__PURE__ */ React.createElement(
        AutoLayout,
        {
          fill: "#FFFFFF",
          cornerRadius: 8,
          stroke: "#E8E8E8",
          padding: 8,
          width: "fill-parent",
          minHeight: 80
        },
        /* @__PURE__ */ React.createElement(
          Input,
          {
            value: body,
            placeholder: "\u672C\u6587\u3092\u5165\u529B",
            onTextEditEnd: (e) => setBody(e.characters),
            fontSize: 12,
            width: "fill-parent",
            inputFrameProps: { padding: 0 }
          }
        )
      ),
      /* @__PURE__ */ React.createElement(AutoLayout, { width: "fill-parent", height: 1, fill: "#E7E7E7" }),
      /* @__PURE__ */ React.createElement(AutoLayout, { width: "fill-parent", spacing: 12 }, /* @__PURE__ */ React.createElement(AutoLayout, { direction: "vertical", width: "fill-parent", spacing: 6 }, /* @__PURE__ */ React.createElement(Text, { fontSize: 10, fill: "#6B6B6B" }, "\u4F5C\u6210\u8005"), /* @__PURE__ */ React.createElement(
        AutoLayout,
        {
          fill: "#FFFFFF",
          stroke: "#E8E8E8",
          cornerRadius: 20,
          padding: { horizontal: 10, vertical: 4 },
          onClick: () => onSelectPerson("author")
        },
        /* @__PURE__ */ React.createElement(Text, { fontSize: 11 }, author || "\u672A\u8A2D\u5B9A")
      )), /* @__PURE__ */ React.createElement(AutoLayout, { direction: "vertical", width: "fill-parent", spacing: 6 }, /* @__PURE__ */ React.createElement(Text, { fontSize: 10, fill: "#6B6B6B" }, "\u78BA\u8A8D\u8005"), /* @__PURE__ */ React.createElement(
        AutoLayout,
        {
          fill: "#FFFFFF",
          stroke: "#E8E8E8",
          cornerRadius: 20,
          padding: { horizontal: 10, vertical: 4 },
          onClick: () => onSelectPerson("reviewer")
        },
        /* @__PURE__ */ React.createElement(Text, { fontSize: 11 }, reviewer || "\u672A\u8A2D\u5B9A")
      ))),
      /* @__PURE__ */ React.createElement(AutoLayout, { width: "fill-parent", height: 1, fill: "#E7E7E7" }),
      /* @__PURE__ */ React.createElement(AutoLayout, { width: "fill-parent", horizontalAlignItems: "end" }, /* @__PURE__ */ React.createElement(
        AutoLayout,
        {
          fill: "#111111",
          cornerRadius: 20,
          padding: { horizontal: 12, vertical: 6 },
          horizontalAlignItems: "center",
          onClick: onSave
        },
        /* @__PURE__ */ React.createElement(Text, { fill: "#FFFFFF", fontSize: 11, fontWeight: 600 }, "\u4FDD\u5B58")
      ))
    );
  }
  widget.register(AnnotationWidget);
})();
