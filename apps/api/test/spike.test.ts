import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app';
const body = JSON.stringify({
  kind: 'dish',
  imageBase64: 'A'.repeat(300_000),
  mimeType: 'image/jpeg',
  context: { place: 'home', storage: 'unknown', hoursSinceCooked: null },
});
const post = (app: ReturnType<typeof createApp>) =>
  app.request('/api/_spike/echo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
describe('spike route', () => {
  it('is off by default', async () => {
    expect(
      (
        await post(
          createApp({ allowedOrigin: 'http://x', maxBodyBytes: 2_000_000, enableSpike: false }),
        )
      ).status,
    ).toBe(404);
  });
  it('echoes the payload size when enabled', async () => {
    const res = await post(
      createApp({ allowedOrigin: 'http://x', maxBodyBytes: 2_000_000, enableSpike: true }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).base64Chars).toBe(300_000);
  });
});
