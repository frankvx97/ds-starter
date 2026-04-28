import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';

type Var = { name: string; value: string };

const DOC_BORDER = '#e2e8f0';
const DOC_HEADER_BG = '#f8fafc';
const DOC_HEADER_FG = '#0f172a';
const DOC_CARD_BG = '#ffffff';

const cell: CSSProperties = {
  padding: '8px 12px',
  borderBottom: `1px solid ${DOC_BORDER}`,
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: 13,
  verticalAlign: 'middle',
  color: DOC_HEADER_FG,
};

const table: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginBlock: 16,
};

const th: CSSProperties = {
  ...cell,
  textAlign: 'left',
  fontWeight: 600,
  background: DOC_HEADER_BG,
  color: DOC_HEADER_FG,
};

function isColorValue(v: string): boolean {
  return (
    /^#([0-9a-f]{3,8})$/i.test(v) ||
    /^rgba?\(/i.test(v) ||
    /^hsla?\(/i.test(v) ||
    /^var\(--palette-/i.test(v)
  );
}

export function TokenTable({
  vars,
  preview,
}: {
  vars: Var[];
  preview?: 'color' | 'radius' | 'spacing' | 'shadow' | 'none';
}) {
  return (
    <table style={table}>
      <thead>
        <tr>
          <th style={th}>Token</th>
          <th style={th}>Value</th>
          {preview && preview !== 'none' && <th style={th}>Preview</th>}
        </tr>
      </thead>
      <tbody>
        {vars.map((v) => (
          <tr key={v.name}>
            <td style={cell}>{v.name}</td>
            <td style={cell}>{v.value}</td>
            {preview && preview !== 'none' && (
              <td style={cell}>
                <Preview kind={preview} token={v.name} value={v.value} />
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Preview({
  kind,
  token,
  value,
}: {
  kind: 'color' | 'radius' | 'spacing' | 'shadow';
  token: string;
  value: string;
}): ReactNode {
  if (kind === 'color') {
    const display = isColorValue(value)
      ? value.startsWith('var(')
        ? value
        : value
      : `var(${token})`;
    return (
      <span
        style={{
          display: 'inline-block',
          width: 96,
          height: 28,
          borderRadius: 6,
          background: `var(${token})`,
          border: '1px solid rgba(0,0,0,0.08)',
          backgroundImage:
            'linear-gradient(45deg,#0001 25%,transparent 25%,transparent 75%,#0001 75%),linear-gradient(45deg,#0001 25%,transparent 25%,transparent 75%,#0001 75%)',
          backgroundSize: '12px 12px',
          backgroundPosition: '0 0, 6px 6px',
        }}
        title={display}
      >
        <span
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            background: `var(${token})`,
            borderRadius: 6,
          }}
        />
      </span>
    );
  }
  if (kind === 'radius') {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 64,
          height: 32,
          background: 'var(--accent-default, #0ea5e9)',
          borderRadius: `var(${token})`,
        }}
      />
    );
  }
  if (kind === 'spacing') {
    return (
      <span
        style={{
          display: 'inline-block',
          width: `var(${token})`,
          height: 16,
          background: 'var(--accent-default, #0ea5e9)',
          verticalAlign: 'middle',
        }}
      />
    );
  }
  if (kind === 'shadow') {
    return (
      <span
        style={{
          display: 'inline-block',
          width: 96,
          height: 32,
          borderRadius: 6,
          background: DOC_CARD_BG,
          boxShadow: `var(${token})`,
        }}
      />
    );
  }
  return null;
}

export function ColorSwatchGrid({ vars }: { vars: Var[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
        marginBlock: 16,
      }}
    >
      {vars.map((v) => (
        <div
          key={v.name}
          style={{
            border: `1px solid ${DOC_BORDER}`,
            borderRadius: 8,
            overflow: 'hidden',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 12,
          }}
        >
          <div
            style={{
              height: 56,
              background: `var(${v.name})`,
              borderBottom: '1px solid rgba(0,0,0,0.06)',
            }}
          />
          <div style={{ padding: '8px 10px' }}>
            <div style={{ fontWeight: 600 }}>{v.name}</div>
            <div style={{ opacity: 0.7, marginTop: 2 }}>{v.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShadowGrid({ vars }: { vars: Var[] }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 24,
        marginBlock: 16,
      }}
    >
      {vars.map((v) => (
        <div key={v.name} style={{ textAlign: 'center' }}>
          <div
            style={{
              height: 64,
              borderRadius: 12,
              background: 'var(--surface-default)',
              boxShadow: `var(${v.name})`,
              marginBottom: 8,
            }}
          />
          <div
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 12,
            }}
          >
            {v.name}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FocusGrid({ vars }: { vars: Var[] }) {
  const labelFor = (name: string) => {
    const tail = name.replace(/^--/, '');
    return tail
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 24,
        marginBlock: 16,
        background: 'var(--surface-default)',
      }}
    >
      {vars.map((v) => (
        <div key={v.name} style={{ textAlign: 'left' }}>
          <div
            style={{
              height: 160,
              borderRadius: 16,
              background: 'var(--surface-default)',
              boxShadow: `var(${v.name})`,
              marginBottom: 12,
            }}
          />
          <div
            style={{
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
              fontSize: 14,
              color: DOC_HEADER_FG,
            }}
          >
            {labelFor(v.name)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BlurGrid({ vars }: { vars: Var[] }) {
  const BG_IMAGE =
    'https://media.istockphoto.com/id/1368460738/tr/vekt%C3%B6r/isometric-user-interface-ui-ux-design-elements-blueprint-background.jpg?s=612x612&w=0&k=20&c=9MZ_lC0eDSmqIZQubw74NOHNGBHW5wqrM6WCXrtGVk8=';

  const labelFor = (name: string) => {
    const tail = name.replace(/^--blur-/, '');
    return tail.charAt(0).toUpperCase() + tail.slice(1);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 24,
        marginBlock: 16,
      }}
    >
      {vars.map((v) => {
        const isFilter = /default/.test(v.name);
        const tileSize = 180;
        const overlaySize = 120;
        return (
          <div
            key={v.name}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: tileSize,
                height: tileSize,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundImage: `url("${BG_IMAGE}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: `1px solid ${DOC_BORDER}`,
              }}
            >
              {isFilter ? (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: overlaySize,
                    height: overlaySize,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundImage: `url("${BG_IMAGE}")`,
                    backgroundSize: `${tileSize}px ${tileSize}px`,
                    backgroundPosition: 'center',
                    filter: `blur(${v.value})`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: overlaySize,
                    height: overlaySize,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 16,
                    background: 'rgba(120, 120, 120, 0.35)',
                    backdropFilter: `blur(${v.value})`,
                    WebkitBackdropFilter: `blur(${v.value})`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  }}
                />
              )}
            </div>
            <div
              style={{
                fontFamily:
                  'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
                fontSize: 14,
                color: DOC_HEADER_FG,
              }}
            >
              {labelFor(v.name)}{' '}
              <span
                style={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  fontSize: 12,
                  opacity: 0.6,
                }}
              >
                ({v.value})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type TextStyle = { selector: string; declarations: Record<string, string> };

const TEXT_STYLE_CATEGORIES = [
  { id: 'heading', label: 'Heading', match: /^\.text-heading-/ },
  { id: 'body', label: 'Body', match: /^\.text-body-/ },
  { id: 'link', label: 'Link', match: /^\.text-link-/ },
  { id: 'text-field', label: 'Text Field', match: /^\.text-text-field-/ },
  { id: 'button', label: 'Button', match: /^\.text-button-/ },
  { id: 'tailwind', label: 'Tailwind', match: /^\.text-tailwind-/ },
] as const;

type CategoryId = (typeof TEXT_STYLE_CATEGORIES)[number]['id'] | 'other';

function categorize(selector: string): CategoryId {
  for (const c of TEXT_STYLE_CATEGORIES) {
    if (c.match.test(selector)) return c.id;
  }
  return 'other';
}

export function TextStylePreview({ classes }: { classes: TextStyle[] }) {
  const grouped = useMemo(() => {
    const map = new Map<CategoryId, TextStyle[]>();
    for (const c of classes) {
      const id = categorize(c.selector);
      const arr = map.get(id) ?? [];
      arr.push(c);
      map.set(id, arr);
    }
    return map;
  }, [classes]);

  const availableCats = useMemo(
    () =>
      [
        ...TEXT_STYLE_CATEGORIES.filter((c) => grouped.has(c.id)).map((c) => ({
          id: c.id as CategoryId,
          label: c.label,
        })),
        ...(grouped.has('other')
          ? [{ id: 'other' as CategoryId, label: 'Other' }]
          : []),
      ],
    [grouped]
  );

  const [active, setActive] = useState<CategoryId | 'all'>('all');
  const visibleCats =
    active === 'all' ? availableCats : availableCats.filter((c) => c.id === active);

  return (
    <div style={{ marginBlock: 16 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 20,
        }}
      >
        <Chip
          label={`All (${classes.length})`}
          active={active === 'all'}
          onClick={() => setActive('all')}
        />
        {availableCats.map((c) => (
          <Chip
            key={c.id}
            label={`${c.label} (${grouped.get(c.id)?.length ?? 0})`}
            active={active === c.id}
            onClick={() => setActive(c.id)}
          />
        ))}
      </div>

      <div style={{ display: 'grid', gap: 32 }}>
        {visibleCats.map((cat) => {
          const items = grouped.get(cat.id) ?? [];
          return (
            <section key={cat.id}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  paddingBottom: 8,
                  marginBottom: 12,
                  borderBottom: `1px solid ${DOC_BORDER}`,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: DOC_HEADER_FG,
                  }}
                >
                  {cat.label}
                </h3>
                <span
                  style={{
                    fontSize: 12,
                    color: DOC_HEADER_FG,
                    opacity: 0.6,
                  }}
                >
                  {items.length} {items.length === 1 ? 'style' : 'styles'}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                {items.map((c) => {
                  const d = c.declarations;
                  const sampleStyle: CSSProperties = {
                    fontFamily: d['font-family'],
                    fontSize: d['font-size'],
                    lineHeight: d['line-height'],
                    fontWeight: d['font-weight'] as CSSProperties['fontWeight'],
                    letterSpacing: d['letter-spacing'],
                    textDecoration: d['text-decoration'],
                    textTransform: d[
                      'text-transform'
                    ] as CSSProperties['textTransform'],
                    margin: 0,
                    color: DOC_HEADER_FG,
                  };
                  return (
                    <div
                      key={c.selector}
                      style={{
                        padding: 16,
                        borderRadius: 8,
                        border: `1px solid ${DOC_BORDER}`,
                        background: DOC_CARD_BG,
                      }}
                    >
                      <div
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: 12,
                          opacity: 0.7,
                          marginBottom: 8,
                          color: DOC_HEADER_FG,
                        }}
                      >
                        {c.selector} — {d['font-size']} / {d['font-weight']} /{' '}
                        {d['line-height']}
                      </div>
                      <div style={sampleStyle}>
                        The quick brown fox jumps over the lazy dog
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? DOC_HEADER_FG : DOC_BORDER}`,
        background: active ? DOC_HEADER_FG : DOC_CARD_BG,
        color: active ? DOC_CARD_BG : DOC_HEADER_FG,
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        lineHeight: 1.2,
      }}
    >
      {label}
    </button>
  );
}

const PALETTE_COLOR_ORDER = [
  'white',
  'snow',
  'black',
  'eclipse',
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'ruby',
  'coral',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'jade',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
];

const PALETTE_NEUTRAL_SINGLES = new Set(['white', 'snow', 'black', 'eclipse']);

const groupHeading: CSSProperties = {
  margin: '32px 0 12px',
  fontSize: 18,
  fontWeight: 600,
  color: DOC_HEADER_FG,
  textTransform: 'capitalize',
};

const sectionHeading: CSSProperties = {
  margin: '24px 0 8px',
  fontSize: 22,
  fontWeight: 700,
  color: DOC_HEADER_FG,
  paddingBottom: 8,
  borderBottom: `1px solid ${DOC_BORDER}`,
};

function paletteGroupKey(name: string): string | null {
  const m = name.match(/^--palette-([a-z]+)/);
  return m && m[1] ? m[1] : null;
}

export function PrimitivesGrouped({ vars }: { vars: Var[] }) {
  const palette = vars.filter((v) => v.name.startsWith('--palette-'));
  const dimensions = vars.filter((v) => v.name.startsWith('--dimensions-'));

  const colorGroups = new Map<string, Var[]>();
  const neutralSingles: Var[] = [];
  for (const v of palette) {
    const key = paletteGroupKey(v.name);
    if (!key) continue;
    if (PALETTE_NEUTRAL_SINGLES.has(key)) {
      neutralSingles.push(v);
      continue;
    }
    const arr = colorGroups.get(key) ?? [];
    arr.push(v);
    colorGroups.set(key, arr);
  }

  const orderedColors = PALETTE_COLOR_ORDER.filter(
    (k) => !PALETTE_NEUTRAL_SINGLES.has(k) && colorGroups.has(k)
  );
  for (const k of colorGroups.keys()) {
    if (!orderedColors.includes(k)) orderedColors.push(k);
  }

  return (
    <div>
      <h2 style={sectionHeading}>Palette</h2>
      {neutralSingles.length > 0 && (
        <section>
          <h3 style={groupHeading}>Base</h3>
          <ColorSwatchGrid vars={neutralSingles} />
        </section>
      )}
      {orderedColors.map((key) => (
        <section key={key}>
          <h3 style={groupHeading}>{key}</h3>
          <ColorSwatchGrid vars={colorGroups.get(key) ?? []} />
        </section>
      ))}

      {dimensions.length > 0 && (
        <>
          <h2 style={sectionHeading}>Dimensions</h2>
          <TokenTable vars={dimensions} preview="none" />
        </>
      )}
    </div>
  );
}

const THEME_GROUP_ORDER = [
  'accent',
  'default',
  'success',
  'warning',
  'danger',
  'border',
  'ring',
  'shadow',
  'separator',
  'overlay',
  'foreground',
  'field',
  'surface',
  'background',
];

function themeGroupKey(name: string): string {
  const stripped = name.replace(/^--/, '');
  const idx = stripped.indexOf('-');
  return idx === -1 ? stripped : stripped.slice(0, idx);
}

export function ThemeGrouped({
  title,
  vars,
  scheme,
}: {
  title: string;
  vars: Var[];
  scheme: 'light' | 'dark';
}) {
  const bg = scheme === 'dark' ? '#0f172a' : '#ffffff';
  const fg = scheme === 'dark' ? '#f8fafc' : '#0f172a';

  const groups = new Map<string, Var[]>();
  for (const v of vars) {
    const key = themeGroupKey(v.name);
    const arr = groups.get(key) ?? [];
    arr.push(v);
    groups.set(key, arr);
  }

  const collectionLevel: Var[] = [];
  const realGroups: Array<[string, Var[]]> = [];
  for (const [key, arr] of groups) {
    if (arr.length === 1 && arr[0]) {
      collectionLevel.push(arr[0]);
    } else {
      realGroups.push([key, arr]);
    }
  }

  realGroups.sort((a, b) => {
    const ai = THEME_GROUP_ORDER.indexOf(a[0]);
    const bi = THEME_GROUP_ORDER.indexOf(b[0]);
    if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div
      style={{
        background: bg,
        color: fg,
        padding: 24,
        borderRadius: 12,
        marginBlock: 16,
        colorScheme: scheme,
      }}
      data-theme={scheme}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {collectionLevel.length > 0 && (
        <section>
          <h4 style={{ ...groupHeading, color: fg }}>Collection level</h4>
          <ColorSwatchGrid vars={collectionLevel} />
        </section>
      )}
      {realGroups.map(([key, arr]) => (
        <section key={key}>
          <h4 style={{ ...groupHeading, color: fg }}>{key}</h4>
          <ColorSwatchGrid vars={arr} />
        </section>
      ))}
    </div>
  );
}

export function ThemeBlock({
  title,
  vars,
  scheme,
}: {
  title: string;
  vars: Var[];
  scheme: 'light' | 'dark';
}) {
  const bg = scheme === 'dark' ? '#0f172a' : '#ffffff';
  const fg = scheme === 'dark' ? '#f8fafc' : '#0f172a';
  return (
    <div
      style={{
        background: bg,
        color: fg,
        padding: 24,
        borderRadius: 12,
        marginBlock: 16,
        colorScheme: scheme,
      }}
      data-theme={scheme}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <ColorSwatchGrid vars={vars} />
    </div>
  );
}
