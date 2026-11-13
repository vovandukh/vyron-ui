// Підсвітка синтаксису Klipper cfg: коментарі, секції, ключ: значення, Jinja-блоки, G-code команди.
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function highlightLine(l) {
  if (/^\s*[#;]/.test(l)) return '<i class="c">' + esc(l) + '</i>'
  if (/^\[[^\]]*\]/.test(l)) return '<i class="s">' + esc(l) + '</i>'
  const m = l.match(/^([A-Za-z_][\w .-]*?)(\s*[:=]\s*)(.*)$/)
  if (m) {
    const ci = m[3].search(/\s[#;]/), v = ci < 0 ? m[3] : m[3].slice(0, ci), c = ci < 0 ? '' : m[3].slice(ci)
    return '<i class="k">' + esc(m[1]) + '</i>' + esc(m[2]) + '<i class="v">' + esc(v) + '</i>' + (c ? '<i class="c">' + esc(c) + '</i>' : '')
  }
  return esc(l)
    .replace(/(\{%.*?%\}|\{\{.*?\}\}|\{[^{}]*\})/g, '<i class="j">$1</i>')
    .replace(/^(\s+)([GMT]\d+(?:\.\d+)?|[A-Z][A-Z0-9_]{2,})\b/, '$1<i class="g">$2</i>')
}

export const highlight = text => text.split('\n').map(highlightLine).join('\n') + '\n'
