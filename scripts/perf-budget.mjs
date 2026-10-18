import { setTimeout as sleep } from "node:timers/promises";

const APP = process.env.PERF_URL || "http://localhost:3939";
const CDP = process.env.CDP_URL || "http://localhost:9222";
const EMAIL = process.env.PERF_EMAIL;
const PASSWORD = process.env.PERF_PASSWORD;

const CPU_THROTTLE = 4;
const SETTLE_MS = 12000;

const BUDGET = {
  styleLayoutMs: 2000,
  taskMs: 3000,
  domNodes: 1200,
  fcpMs: 2500,
};

const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36";

const OBSERVER_SNIPPET = `window.__perf = { fcp: null, lcp: null };
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) if (e.name === "first-contentful-paint") window.__perf.fcp = e.startTime;
}).observe({ type: "paint", buffered: true });
new PerformanceObserver((l) => {
  const es = l.getEntries();
  if (es.length) window.__perf.lcp = es[es.length - 1].startTime;
}).observe({ type: "largest-contentful-paint", buffered: true });
true;`;

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error("ws connect failed: " + url));
  });
}

let idc = 0;
function makeClient(ws) {
  const pending = new Map();
  const waiters = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }
    if (msg.method && waiters.has(msg.method)) {
      const fn = waiters.get(msg.method);
      waiters.delete(msg.method);
      fn();
    }
  };
  return {
    send(method, params = {}) {
      const id = ++idc;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    once(method, ms = 20000) {
      return Promise.race([new Promise((r) => waiters.set(method, r)), sleep(ms)]);
    },
    async evalValue(expression) {
      const r = await this.send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (r.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    },
  };
}

async function preflight() {
  let appOk = false;
  try {
    appOk = (await fetch(APP + "/", { redirect: "manual" })).status < 500;
  } catch {
    appOk = false;
  }
  if (!appOk) {
    console.error(
      "FAIL: app not reachable at " + APP + " — pehle chalao: npm run build && npm run start"
    );
    process.exit(2);
  }
  let cdpOk = false;
  try {
    const r = await fetch(CDP + "/json/version");
    cdpOk = r.ok;
  } catch {
    cdpOk = false;
  }
  if (!cdpOk) {
    console.error(
      "FAIL: Chrome debug port not reachable at " +
        CDP +
        " — launch: chrome --headless=new --remote-debugging-port=9222 --disable-storage-reset --user-data-dir=<profile> about:blank"
    );
    process.exit(2);
  }
  if (!EMAIL || !PASSWORD) {
    console.error("FAIL: PERF_EMAIL / PERF_PASSWORD env set karo (staff login credentials)");
    process.exit(2);
  }
}

async function login(c) {
  const nav = c.once("Page.loadEventFired");
  await c.send("Page.navigate", { url: APP + "/login" });
  await nav;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const state = await c.evalValue(
      "JSON.stringify({path:location.pathname,hasPw:!!document.querySelector('input[type=password]')})"
    );
    const s = JSON.parse(state);
    if (s.path !== "/login") return s.path;
    if (s.hasPw) break;
  }
  const filled = await c.evalValue(`(() => {
    const set=(el,val)=>{const d=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;d.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
    const em=[...document.querySelectorAll('input')].find(i=>i.type==='email'||/email/i.test((i.name||'')+(i.id||'')+(i.placeholder||'')));
    const pw=[...document.querySelectorAll('input')].find(i=>i.type==='password');
    if(!em||!pw) return 'missing inputs';
    set(em, ${JSON.stringify(EMAIL)}); set(pw, ${JSON.stringify(PASSWORD)});
    return 'filled';
  })()`);
  if (filled !== "filled") throw new Error("login inputs not found: " + filled);
  await c.evalValue(`(() => {
    const b=[...document.querySelectorAll('form button')].find(x=>x.type==='submit') || [...document.querySelectorAll('button')].find(x=>/login to dashboard/i.test(x.textContent||''));
    if(!b) throw new Error('submit button not found');
    b.click(); return true;
  })()`);
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const path = await c.evalValue("location.pathname");
    if (path && path !== "/login") return path;
  }
  throw new Error("login did not navigate away from /login (30s)");
}

async function measure(c) {
  await c.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });
  await c.send("Emulation.setUserAgentOverride", { userAgent: MOBILE_UA });
  await c.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true,
  });
  await c.send("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVER_SNIPPET });
  const nav = c.once("Page.loadEventFired");
  await c.send("Page.navigate", { url: APP + "/jobs" });
  await nav;
  await sleep(SETTLE_MS);
  const perf = JSON.parse(
    await c.evalValue("JSON.stringify(window.__perf || {fcp:null,lcp:null})")
  );
  const domNodes = await c.evalValue("document.getElementsByTagName('*').length");
  const { metrics } = await c.send("Performance.getMetrics");
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  const ms = (v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : null);
  return {
    styleLayoutMs: ms(((m.RecalcStyleDuration || 0) + (m.LayoutDuration || 0)) * 1000),
    recalcMs: ms((m.RecalcStyleDuration || 0) * 1000),
    layoutMs: ms((m.LayoutDuration || 0) * 1000),
    taskMs: ms((m.TaskDuration || 0) * 1000),
    scriptMs: ms((m.ScriptDuration || 0) * 1000),
    domNodes: Math.round(domNodes || 0),
    fcpMs: perf.fcp != null ? Math.round(perf.fcp) : null,
    lcpMs: perf.lcp != null ? Math.round(perf.lcp) : null,
  };
}

function report(r) {
  console.log("");
  console.log("perf-budget — /jobs mobile @ CPU " + CPU_THROTTLE + "x (" + APP + ")");
  console.log("-".repeat(58));
  const row = (name, val, unit, budget, ok) =>
    console.log(
      (name + " ").padEnd(26, ".") +
        " " +
        String(val == null ? "n/a" : val).padStart(8) +
        " " +
        unit.padEnd(4) +
        "  budget <" +
        String(budget).padStart(5) +
        "  " +
        (ok ? "PASS" : "FAIL")
    );
  const okSL = r.styleLayoutMs < BUDGET.styleLayoutMs;
  const okTask = r.taskMs < BUDGET.taskMs;
  const okDom = r.domNodes < BUDGET.domNodes;
  const okFcp = r.fcpMs != null && r.fcpMs < BUDGET.fcpMs;
  row("Style&Layout", r.styleLayoutMs, "ms", BUDGET.styleLayoutMs, okSL);
  row("  RecalcStyle", r.recalcMs, "ms", "-", true);
  row("  Layout", r.layoutMs, "ms", "-", true);
  row("TaskDuration", r.taskMs, "ms", BUDGET.taskMs, okTask);
  row("ScriptDuration", r.scriptMs, "ms", "-", true);
  row("DOM nodes", r.domNodes, "", BUDGET.domNodes, okDom);
  row("FCP", r.fcpMs, "ms", BUDGET.fcpMs, okFcp);
  console.log(
    "LCP (informational) ".padEnd(26, ".") +
      " " +
      String(r.lcpMs ?? "n/a").padStart(8) +
      " ms   boot-latency bound — budget me nahi"
  );
  console.log("-".repeat(58));
  const fails = [okSL, okTask, okDom, okFcp].filter((x) => !x).length;
  console.log(fails === 0 ? "RESULT: ALL PASS" : "RESULT: " + fails + " BUDGET BREACH");
  return fails === 0;
}

async function main() {
  await preflight();
  const t = await (await fetch(CDP + "/json/new?about:blank", { method: "PUT" })).json();
  const ws = await connect(t.webSocketDebuggerUrl);
  const c = makeClient(ws);
  try {
    await c.send("Page.enable");
    await c.send("Runtime.enable");
    await c.send("Performance.enable");
    const landed = await login(c);
    console.log("login ok ->", landed);
    const r = await measure(c);
    const ok = report(r);
    process.exitCode = ok ? 0 : 1;
  } finally {
    ws.close();
    await fetch(CDP + "/json/close/" + t.id).catch(() => {});
  }
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
