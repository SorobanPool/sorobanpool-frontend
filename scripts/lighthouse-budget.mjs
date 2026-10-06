// Usage: node scripts/lighthouse-budget.mjs <baseUrl> <path:maxJsKb>...   e.g. / :170 /onboarding:400
// Fails when a page's script transfer size (mobile emulation, gzip as served) exceeds its budget. The brief asks for <= 170 KB
// on public pages. Performance score and LCP are printed but not gated: they swing with the machine, bytes do not.
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const [base = 'http://localhost:3000', ...rest] = process.argv.slice(2);
const budgets = (rest.length ? rest : ['/:170']).map((a) => { const i = a.lastIndexOf(':'); return { path: a.slice(0, i), maxKb: Number(a.slice(i + 1)) }; });

const chrome = await launch({ chromePath: process.env.CHROME_PATH, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
let failed = false;
try {
  for (const { path: p, maxKb } of budgets) {
    const r = await lighthouse(base + p, { port: chrome.port, output: 'json', onlyCategories: ['performance'], logLevel: 'error' });
    const lhr = r.lhr;
    const score = lhr.categories.performance.score ?? 0;
    const scripts = lhr.audits['network-requests'].details.items.filter((i) => i.resourceType === 'Script');
    const jsKb = scripts.reduce((n, i) => n + (i.transferSize ?? 0), 0) / 1024;
    const lcp = lhr.audits['largest-contentful-paint'].numericValue / 1000;
    const ok = jsKb <= maxKb;
    failed ||= !ok;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${p}  js ${jsKb.toFixed(0)} KB (budget ${maxKb})  perf ${score.toFixed(2)}  LCP ${lcp.toFixed(1)}s`);
  }
} finally {
  await chrome.kill();
}
process.exit(failed ? 1 : 0);
