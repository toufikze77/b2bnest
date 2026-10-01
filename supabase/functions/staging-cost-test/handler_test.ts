import { assertEquals } from 'jsr:@std/assert@1';
import { createHandler, gbp, WORST_BATCH_MICROS, BATCH_CEILING_GBP, Store } from './handler.ts';

const good = { schemaVersion: 1, kind: 'workspace', name: 'Salon', description: 'Run the salon',
  boards: [{ name: 'Bookings', description: 'Bookings', views: ['table'], groups: [{ name: 'Week', tasks: [{ title: 'Confirm', status: 'todo', priority: 'low', dayOffset: 1 }] }] }] };

function memStore(): Store & { row: any } {
  const s: any = { row: null };
  s.claim = async (r: any) => { if (s.row) return 'taken'; s.row = { ...r, results: [] }; return 'ok'; };
  s.saveResults = async (res: any) => { s.row.results = res; return true; };
  s.read = async () => s.row;
  return s;
}

async function setup(mode: 'ok' | '500' | 'slow' = 'ok') {
  let calls = 0;
  const srv = Deno.serve({ port: 0, onListen() {} }, async () => {
    calls++;
    if (mode === 'slow') await new Promise((r) => setTimeout(r, 300));
    if (mode === '500') return Response.json({ error: { code: 'x' } }, { status: 500 });
    return Response.json({ choices: [{ message: { content: JSON.stringify(good) }, finish_reason: 'stop' }], usage: { prompt_tokens: 500, completion_tokens: 600 } });
  });
  const store = memStore();
  const h = createHandler({ corsHeaders: {}, openaiKey: 'k', openaiUrl: `http://127.0.0.1:${srv.addr.port}/`, timeoutMs: 100, store,
    getUserId: async (x) => x === 'Bearer SA' ? 'sa' : x === 'Bearer U' ? 'u' : null, isSuperAdmin: async (u) => u === 'sa' });
  const call = (auth: string, body: unknown) => h(new Request('http://x/', { method: 'POST', headers: { authorization: auth }, body: JSON.stringify(body) }));
  return { srv, store, call, calls: () => calls };
}

Deno.test('ceiling: worst case under £0.05', () => { assertEquals(gbp(WORST_BATCH_MICROS) <= BATCH_CEILING_GBP, true); });

Deno.test('auth, prompt injection refused, single run, repeat refused', async () => {
  const t = await setup();
  assertEquals((await t.call('', { mode: 'run' })).status, 401);
  assertEquals((await t.call('Bearer U', { mode: 'run' })).status, 403);
  assertEquals((await t.call('Bearer SA', { mode: 'run', prompt: 'x' })).status, 400);
  assertEquals((await t.call('Bearer SA', { mode: 'run', model: 'gpt-4o' })).status, 400);
  const r = await t.call('Bearer SA', { mode: 'run' });
  const b = await r.json();
  assertEquals([r.status, b.results.length, b.totals.valid, t.calls()], [200, 4, 4, 4]);
  assertEquals((await t.call('Bearer SA', { mode: 'run' })).status, 409);
  assertEquals(t.calls(), 4);
  await t.srv.shutdown();
});

Deno.test('concurrent runs: only one gets the allowance', async () => {
  const t = await setup();
  const rs = await Promise.all([1, 2, 3].map(() => t.call('Bearer SA', { mode: 'run' })));
  assertEquals(rs.map((r) => r.status).sort(), [200, 409, 409]);
  for (const r of rs) await r.body?.cancel();
  assertEquals(t.calls(), 4);
  await t.srv.shutdown();
});

Deno.test('failures and timeouts count, no retries', async () => {
  for (const m of ['500', 'slow'] as const) {
    const t = await setup(m);
    const b = await (await t.call('Bearer SA', { mode: 'run' })).json();
    assertEquals(t.calls(), 4);
    assertEquals(b.results.every((r: any) => r.outcome === (m === '500' ? 'provider_error' : 'timeout')), true);
    assertEquals((await t.call('Bearer SA', { mode: 'run' })).status, 409);
    await t.srv.shutdown();
  }
});
