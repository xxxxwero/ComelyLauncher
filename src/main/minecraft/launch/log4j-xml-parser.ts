const EVENT_START = /<log4j:Event\b[^>]*>/;
const EVENT_END = '</log4j:Event>';

function attribute(tag: string, name: string): string {
  return new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
}

function cdata(block: string, element: string): string | null {
  const match = new RegExp(`<log4j:${element}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></log4j:${element}>`).exec(block);
  return match ? match[1] : null;
}

function formatTime(timestamp: string): string {
  const date = new Date(Number(timestamp));
  return Number.isFinite(date.getTime()) ? date.toTimeString().slice(0, 8) : '--:--:--';
}

export class Log4jXmlParser {
  private buffer: string[] | null = null;

  accept(line: string): string[] {
    if (this.buffer === null) {
      if (!EVENT_START.test(line)) return [line];
      this.buffer = [line];
    } else {
      this.buffer.push(line);
    }
    if (!line.includes(EVENT_END)) return [];
    const block = this.buffer.join('\n');
    this.buffer = null;
    return this.format(block);
  }

  private format(block: string): string[] {
    const tag = EVENT_START.exec(block)?.[0] ?? '';
    const prefix = `[${formatTime(attribute(tag, 'timestamp'))}] [${attribute(tag, 'thread')}/${attribute(tag, 'level')}]: `;
    const message = cdata(block, 'Message') ?? '';
    const throwable = cdata(block, 'Throwable');
    const lines = `${message}${throwable ? `\n${throwable}` : ''}`.split(/\r?\n/).filter((entry) => entry.length > 0);
    return lines.map((entry, index) => (index === 0 ? prefix + entry : entry));
  }
}
