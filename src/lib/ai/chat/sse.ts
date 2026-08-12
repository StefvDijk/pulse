/** Incremental parser for the `data:` fields used by the chat SSE stream. */
export function createSseDataParser() {
  let buffer = ''

  return {
    feed(chunk: string): string[] {
      buffer += chunk.replaceAll('\r\n', '\n')
      const payloads: string[] = []

      for (;;) {
        const boundary = buffer.indexOf('\n\n')
        if (boundary < 0) break

        const event = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const data = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
        if (data.length > 0) payloads.push(data.join('\n'))
      }

      return payloads
    },
  }
}
