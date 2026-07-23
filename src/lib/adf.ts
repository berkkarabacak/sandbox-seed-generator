// ADF (Atlassian Document Format) helpers.

export interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
}

function para(text: string): AdfNode {
  return { type: "paragraph", content: text ? [{ type: "text", text }] : [] };
}

export function toAdfDoc(text: string): { type: "doc"; version: 1; content: AdfNode[] } {
  const lines = text.split("\n");
  const content: AdfNode[] = [];
  let bullets: AdfNode[] = [];

  const flushBullets = () => {
    if (bullets.length) {
      content.push({ type: "bulletList", content: bullets });
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\*\*/g, "").replace(/`/g, "");
    if (line.startsWith("- ")) {
      bullets.push({ type: "listItem", content: [para(line.slice(2))] });
    } else {
      flushBullets();
      content.push(para(line));
    }
  }
  flushBullets();
  return { type: "doc", version: 1, content };
}
