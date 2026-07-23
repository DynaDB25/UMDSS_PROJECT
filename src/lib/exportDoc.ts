// Turn the assistant's lightly-marked-up text into real PDF / Word downloads.
// A single parser produces a block model that both renderers consume, so the
// two formats stay in sync.

import { jsPDF } from 'jspdf'

type Run = { text: string; bold: boolean }
type BlockType = 'h1' | 'h2' | 'li' | 'p'
type Block = { type: BlockType; runs: Run[] }

/** Split a line into bold / plain runs on **markers**. */
function parseInline(text: string): Run[] {
  const runs: Run[] = []
  for (const part of text.split(/(\*\*[^*]+\*\*)/g)) {
    if (part === '') continue
    if (/^\*\*[^*]+\*\*$/.test(part)) runs.push({ text: part.slice(2, -2), bold: true })
    else runs.push({ text: part, bold: false })
  }
  return runs.length ? runs : [{ text, bold: false }]
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd()
    if (line.trim() === '') continue
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      blocks.push({ type: h[1].length <= 1 ? 'h1' : 'h2', runs: parseInline(h[2]) })
      continue
    }
    const li = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
    if (li) {
      blocks.push({ type: 'li', runs: parseInline(li[1]) })
      continue
    }
    blocks.push({ type: 'p', runs: parseInline(line) })
  }
  return blocks
}

/** A short, filesystem-safe title derived from the first heading or the text. */
export function deriveTitle(text: string, fallback = 'ScholarCircle Document'): string {
  const firstHeading = text.split('\n').map((l) => l.match(/^#{1,6}\s+(.*)$/)).find(Boolean)
  const raw = (firstHeading?.[1] || text.split('\n').find((l) => l.trim()) || fallback)
    .replace(/\*\*/g, '')
    .trim()
  return raw.length > 70 ? raw.slice(0, 70).trim() : raw
}

function safeFileName(title: string): string {
  return (title.replace(/[^\w\d\-. ]+/g, '').replace(/\s+/g, '_').slice(0, 60) || 'document')
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── PDF ───────────────────────────────────────────────

export function downloadPdf(title: string, text: string) {
  const blocks = parseBlocks(text)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 56
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const rightEdge = pageW - margin
  let y = margin

  const ensureSpace = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage()
      y = margin
    }
  }

  // Word-by-word layout so **bold** can appear mid-line and text wraps cleanly.
  const writeRuns = (runs: Run[], size: number, lineH: number, indent = 0, bullet = false) => {
    doc.setFontSize(size)
    const x0 = margin + indent
    ensureSpace(lineH)
    if (bullet) {
      doc.setFont('times', 'normal')
      doc.text('•', margin + indent - 12, y)
    }
    let cursorX = x0
    const words: Run[] = []
    for (const r of runs) {
      for (const tok of r.text.split(/(\s+)/)) {
        if (tok !== '') words.push({ text: tok, bold: r.bold })
      }
    }
    for (const w of words) {
      doc.setFont('times', w.bold ? 'bold' : 'normal')
      const ww = doc.getTextWidth(w.text)
      if (cursorX + ww > rightEdge && cursorX > x0) {
        y += lineH
        cursorX = x0
        ensureSpace(lineH)
      }
      if (w.text.trim() === '' && cursorX === x0) continue // no leading space after wrap
      doc.text(w.text, cursorX, y)
      cursorX += ww
    }
    y += lineH
  }

  // Title
  writeRuns([{ text: title, bold: true }], 18, 24)
  y += 6

  for (const b of blocks) {
    if (b.type === 'h1') {
      y += 8
      writeRuns(b.runs, 15, 20)
    } else if (b.type === 'h2') {
      y += 6
      writeRuns(b.runs, 13, 18)
    } else if (b.type === 'li') {
      writeRuns(b.runs, 11.5, 16, 18, true)
    } else {
      writeRuns(b.runs, 11.5, 16)
      y += 5
    }
  }

  doc.save(`${safeFileName(title)}.pdf`)
}

// ── Word (.doc) ───────────────────────────────────────
// A Word-flavoured HTML document. Word, Google Docs and LibreOffice all open
// this natively with headings, bold and bullets intact, and no dependency that
// breaks the CRA build.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function runsToHtml(runs: Run[]): string {
  return runs.map((r) => (r.bold ? `<strong>${esc(r.text)}</strong>` : esc(r.text))).join('')
}

export function downloadDocx(title: string, text: string) {
  const blocks = parseBlocks(text)
  let body = `<h1>${esc(title)}</h1>`
  let inList = false
  for (const b of blocks) {
    if (b.type === 'li') {
      if (!inList) {
        body += '<ul>'
        inList = true
      }
      body += `<li>${runsToHtml(b.runs)}</li>`
      continue
    }
    if (inList) {
      body += '</ul>'
      inList = false
    }
    if (b.type === 'h1') body += `<h2>${runsToHtml(b.runs)}</h2>`
    else if (b.type === 'h2') body += `<h3>${runsToHtml(b.runs)}</h3>`
    else body += `<p>${runsToHtml(b.runs)}</p>`
  }
  if (inList) body += '</ul>'

  const html =
    '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    `<head><meta charset="utf-8"><title>${esc(title)}</title></head>` +
    '<body style="font-family:Georgia,\'Times New Roman\',serif;font-size:12pt;line-height:1.5;">' +
    `${body}</body></html>`

  // The BOM makes Word read it as UTF-8 so GH₵ and accents survive.
  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  triggerDownload(blob, `${safeFileName(title)}.doc`)
}
