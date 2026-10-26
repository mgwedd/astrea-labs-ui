import { expect, test } from '@playwright/test';

const rpc = (id: number, method: string, params: object = {}) => ({ jsonrpc: '2.0', id, method, params });
const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' };

test.describe('/mcp', () => {
  test('a 2025 client can initialize, list and call tools', async ({ request }) => {
    const init = await request.post('/mcp', {
      headers,
      data: rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } }),
    });
    expect(init.status()).toBe(200);
    expect((await init.json()).result.serverInfo.name).toBe('astrea-labs');

    const list = await request.post('/mcp', { headers, data: rpc(2, 'tools/list') });
    const names = (await list.json()).result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(expect.arrayContaining(['list_projects', 'get_project', 'list_posts', 'get_page']));

    const call = await request.post('/mcp', { headers, data: rpc(3, 'tools/call', { name: 'get_project', arguments: { slug: 'aletheia' } }) });
    const md = (await (await request.get('/projects/aletheia.md')).text()).trim();
    expect((await call.json()).result.content[0].text.trim()).toBe(md);
  });

  test('protected resource metadata is JSON when auth is set, 404 otherwise', async ({ request }) => {
    const res = await request.get('/.well-known/oauth-protected-resource/mcp');
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) expect((await res.json()).resource).toBe('https://astrealabs.com/mcp');
  });

  test('robots.txt links llms.txt', async ({ request }) => {
    const text = await (await request.get('/robots.txt')).text();
    expect(text).toContain('Sitemap: https://astrealabs.com/sitemap.xml');
    expect(text).toContain('https://astrealabs.com/llms.txt');
  });
});
