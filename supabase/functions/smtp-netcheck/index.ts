// TEMPORARY diagnostic (to be deleted): checks network/DNS/TLS reachability of fixed
// mail servers from the server runtime. No credentials, no sign-in, nothing sent.
const TARGETS = [
  { host: "smtp.gmail.com", port: 465, tls: true },
  { host: "smtp.office365.com", port: 587, tls: false },
  { host: "smtp.gmail.com", port: 587, tls: false },
];
const dec = new TextDecoder();

async function check(t: { host: string; port: number; tls: boolean }) {
  let stage = "dns_connect";
  let conn: Deno.Conn | null = null;
  try {
    const work = (async () => {
      conn = t.tls ? await Deno.connectTls({ hostname: t.host, port: t.port }) : await Deno.connect({ hostname: t.host, port: t.port });
      stage = "greeting";
      const b = new Uint8Array(512); const n = await conn.read(b);
      const greet = n ? dec.decode(b.subarray(0, n)).trim().slice(0, 120) : "(closed)";
      await conn.write(new TextEncoder().encode("QUIT\r\n")).catch(() => 0);
      return { ...t, ok: greet.startsWith("220"), stage: "done", greet };
    })();
    return await Promise.race([work, new Promise((r) => setTimeout(() => r({ ...t, ok: false, stage, exception: "timeout 10s" }), 10000))]);
  } catch (e) {
    return { ...t, ok: false, stage, exception: `${(e as Error).name}: ${(e as Error).message}`.slice(0, 300) };
  } finally { try { (conn as Deno.Conn | null)?.close(); } catch { /* */ } }
}

Deno.serve(async () => {
  const results = [];
  for (const t of TARGETS) results.push(await check(t));
  return new Response(JSON.stringify(results, null, 2), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
});
