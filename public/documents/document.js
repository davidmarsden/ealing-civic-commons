const target = document.querySelector('[data-document-src]');

const escapeHtml = value => String(value ?? '').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));

function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>');
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}/.test(line) && line.includes('|');
}

function cells(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      if (i < lines.length) i += 1;
      out.push(`<pre><code${language ? ` data-language="${escapeHtml(language)}"` : ''}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      out.push('<hr>');
      i += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith('> ')) quote.push(lines[i++].slice(2));
      out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`);
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headers = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push('<div class="table-wrap"><table><thead><tr>' + headers.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^[-*]\s+/, ''));
      out.push('<ul>' + items.map(item => `<li>${inline(item)}</li>`).join('') + '</ul>');
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) items.push(lines[i++].replace(/^\d+\.\s+/, ''));
      out.push('<ol>' + items.map(item => `<li>${inline(item)}</li>`).join('') + '</ol>');
      continue;
    }

    const paragraph = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s+/.test(lines[i]) && !lines[i].startsWith('```') && !lines[i].startsWith('> ') && !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i]) && !/^---+$/.test(lines[i].trim()) && !(lines[i].includes('|') && i + 1 < lines.length && isTableDivider(lines[i + 1]))) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }

  return out.join('\n');
}

async function loadDocument() {
  if (!target) return;
  const source = target.dataset.documentSrc;
  try {
    const response = await fetch(source, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    target.innerHTML = markdownToHtml(await response.text());
  } catch (error) {
    target.innerHTML = `<p class="document-error">The document could not be loaded. Please try again shortly.</p>`;
    console.error('Document load failed', error);
  }
}

loadDocument();
