import './style.css';

const app = document.querySelector<HTMLDivElement>('#not-found-app');
if (!app) throw new Error('404 root is missing');

app.innerHTML = `<header class="site-header"><a class="brand" href="/" aria-label="Delivery Receipt home"><svg viewBox="0 0 44 32" aria-hidden="true"><rect x="1.5" y="2" width="41" height="28"/><circle cx="14" cy="15" r="5"/><circle cx="30" cy="15" r="5"/><path d="M12 25h20"/></svg><span>Delivery<br>Receipt</span></a><nav aria-label="Primary"><a href="/demo">Demo</a><a href="/#make">Create</a><a href="/#records">Records</a><a href="/privacy/">Privacy</a></nav><span class="network-status">Page not found</span></header><main id="main" class="ack-main"><section class="bad-link"><span class="section-kicker">Page not found</span><h1>This page is not available</h1><p>Use the home page to create a receipt or open the sample.</p><a class="button button-primary" href="/">Open Delivery Receipt</a></section></main><footer><p>Record deliveries and client responses on this device.</p><nav aria-label="Legal"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a></nav><p class="generated-note">Built by Param Factory · v1.1.0 · Original generated receipt artwork</p></footer>`;

queueMicrotask(() => {
  const heading = app.querySelector<HTMLElement>('h1');
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
});
