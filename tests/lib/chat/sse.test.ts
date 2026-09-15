import { describe, expect, it } from 'vitest'
import { createSseDataParser } from '@/lib/ai/chat/sse'

describe('createSseDataParser', () => {
  it('buffers an event split across arbitrary network chunks', () => {
    const parser = createSseDataParser()
    expect(parser.feed('data: "hel')).toEqual([])
    expect(parser.feed('lo"\n')).toEqual([])
    expect(parser.feed('\n')).toEqual(['"hello"'])
  })

  it('returns every complete event and retains the incomplete tail', () => {
    const parser = createSseDataParser()
    expect(parser.feed('data: one\n\ndata: two\n\ndata: thr')).toEqual(['one', 'two'])
    expect(parser.feed('ee\n\n')).toEqual(['three'])
  })

  it('accepts CRLF-delimited SSE', () => {
    const parser = createSseDataParser()
    expect(parser.feed('data: [DONE]\r\n\r\n')).toEqual(['[DONE]'])
  })
})
