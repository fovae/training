import type { ComponentChildren, VNode } from 'preact';

/**
 * Минимальный и безопасный рендер Markdown для юридических текстов: строит узлы Preact
 * (никакого innerHTML). Поддержка: # ## ###, абзацы, списки «- », **жирный**, [текст](url),
 * <https://…>, перенос строки «два пробела в конце». Ссылки — только mailto: и https:;
 * внешние открываются в новой вкладке с rel="noopener noreferrer". Остальное — обычный текст.
 */

export interface Heading {
  id: string;
  text: string;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');

function link(href: string, children: ComponentChildren, key: number): VNode | string {
  if (/^mailto:[^\s"<>]+$/i.test(href))
    return (
      <a key={key} href={href}>
        {children}
      </a>
    );
  if (/^https:\/\/[^\s"<>]+$/i.test(href))
    return (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  return typeof children === 'string' ? children : href;
}

/** Строчная разметка: **жирный**, [текст](url), <https://…> */
function inline(text: string): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|<(https:\/\/[^>\s]+)>/g;
  let last = 0;
  let k = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] != null) out.push(<strong key={k++}>{inline(m[1])}</strong>);
    else if (m[2] != null) out.push(link(m[3]!, inline(m[2]), k++));
    else if (m[4] != null) out.push(link(m[4], m[4], k++));
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Абзац: «два пробела в конце строки» — перенос строки */
function para(lines: string[]): ComponentChildren[] {
  const out: ComponentChildren[] = [];
  lines.forEach((l, i) => {
    out.push(...inline(l.replace(/ {2,}$/, '')));
    if (i < lines.length - 1) out.push(/ {2,}$/.test(l) ? <br key={'br' + i} /> : ' ');
  });
  return out;
}

export function renderMarkdown(src: string): { nodes: VNode[]; headings: Heading[]; title: string } {
  const nodes: VNode[] = [];
  const headings: Heading[] = [];
  let title = '';
  const blocks = src
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/);
  blocks.forEach((block, bi) => {
    const lines = block.split('\n');
    const h = /^(#{1,3})\s+(.*)$/.exec(lines[0]!);
    if (h && lines.length === 1) {
      const level = h[1]!.length;
      const text = h[2]!.trim();
      if (level === 1) {
        title = text;
        return;
      }
      const id = 'doc-' + slug(text);
      if (level === 2) {
        headings.push({ id, text });
        nodes.push(
          <h2 key={bi} id={id} tabIndex={-1}>
            {inline(text)}
          </h2>,
        );
      } else nodes.push(<h3 key={bi}>{inline(text)}</h3>);
      return;
    }
    if (lines.every((l) => /^- /.test(l))) {
      nodes.push(
        <ul key={bi}>
          {lines.map((l, i) => (
            <li key={i}>{inline(l.slice(2))}</li>
          ))}
        </ul>,
      );
      return;
    }
    nodes.push(<p key={bi}>{para(lines)}</p>);
  });
  return { nodes, headings, title };
}
