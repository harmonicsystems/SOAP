// Plain-text note assembly (spec §7): no markdown, no smart quotes, no tabs,
// single blank line between sections — must paste cleanly into any EMR field.

export function scrubPlainText(s) {
  return (s ?? '')
    .replace(/[‘’‛]/g, "'") // curly single quotes → straight
    .replace(/[“”‟]/g, '"') // curly double quotes → straight
    .replace(/ /g, ' ') // non-breaking space → space
    .replace(/\t/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{2,}/g, '\n') // no blank lines inside a section
    .trim()
}

export function assembleNote(client, session) {
  const header = `SOAP NOTE — ${client.code} — ${session.date} — ${session.durationMin} min — ${session.setting}`
  const section = (k) => `${k}: ${scrubPlainText(session.soap?.[k])}`
  return [header, section('S'), section('O'), section('A'), section('P')].join('\n\n')
}
