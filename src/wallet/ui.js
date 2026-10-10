// Header login/account control, wallet choice dialog, aria-live status, transaction list.
import * as W from "./core.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const utc = iso => { const t = Date.parse(iso); return isNaN(t) ? "—" : new Date(t).toISOString().slice(0, 16).replace("T", " ") + " UTC"; };

const CSS = `
.wal{position:relative;display:flex;align-items:center;gap:6px}
.wal-btn{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--acc);background:transparent;color:var(--acc);padding:6px 11px;font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;white-space:nowrap;min-height:32px}
.wal-btn:hover{background:var(--acc);color:#0a0a0a}
.wal-btn.on{border-color:var(--line);color:var(--ink)}
.wal-btn.on:hover{background:var(--ink);color:var(--bg)}
.wal-btn.warn{border-color:var(--warn);color:var(--warn)}
.wal-btn .d{width:7px;height:7px;background:var(--acc);flex:none}
.wal-btn.warn .d{background:var(--warn)}
.wal-btn:disabled{opacity:.5;cursor:progress}
.wal-menu{position:absolute;right:0;top:calc(100% + 8px);width:320px;max-width:calc(100vw - 24px);background:var(--panel);border:1px solid var(--line);z-index:50;padding:12px;box-shadow:0 18px 40px -12px rgba(0,0,0,.8)}
.wal-menu .kv{margin-bottom:10px}
.wal-menu h3{margin:12px 0 6px;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--dim);font-weight:600}
.wal-tx{display:grid;gap:4px;max-height:180px;overflow:auto}
.wal-tx div{display:flex;justify-content:space-between;gap:8px;font-size:10.5px;border-bottom:1px solid var(--hair);padding:4px 0}
.wal-st{font-size:10.5px;color:var(--dim);margin-top:8px;min-height:1.6em}
.wal-st.ok{color:var(--acc)} .wal-st.warn{color:var(--warn)} .wal-st.bad{color:var(--crit)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
dialog.wal-dlg{background:var(--panel);color:var(--ink);border:1px solid var(--line);padding:0;width:min(440px,calc(100vw - 24px));max-height:calc(100dvh - 24px)}
dialog.wal-dlg::backdrop{background:rgba(6,6,6,.78);backdrop-filter:blur(3px)}
.wal-dlg header{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid var(--hair)}
.wal-dlg .bd{padding:14px;overflow:auto}
.wal-list{display:grid;gap:6px;margin-top:10px}
.wal-list button{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--bg);border:1px solid var(--hair);padding:11px 12px;cursor:pointer;font-size:12px;min-height:44px}
.wal-list button:hover,.wal-list button:focus-visible{border-color:var(--acc)}
.wal-list img,.wal-list i{width:24px;height:24px;flex:none;display:grid;place-items:center;font-style:normal;border:1px solid var(--hair);font-size:10px;color:var(--acc)}
.wal-list img{border:0}
.wal-list span.sub{margin-left:auto}
.txw{padding:0 12px 12px}
.txw-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.txw-why{margin:8px 0 0}
.txw-review{border:1px solid var(--acc);padding:10px;margin-top:2px}
.txw-review .kv{padding:6px 0 4px}
.txw-ack{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;margin:8px 0 10px;cursor:pointer}
.txw-ack input{accent-color:var(--acc);margin-top:3px}
@media (max-width:860px){.right{gap:6px}}
@media (max-width:560px){
  .right .webbtn{display:none}
  .right #deployChip{padding:6px 7px;font-size:0;gap:0}
  .right #deployChip .d{width:8px;height:8px}
  .wal-btn{padding:6px 9px}
  .wal-menu{position:fixed;left:12px;right:12px;top:auto;width:auto;max-width:none;margin-top:8px}
  .txw-row .btn{flex:1 1 auto;text-align:center;min-height:38px}
}`;

let box, live, menu, dlg, menuOpen = false, lastStatus = "";

export function mountUI() {
  const style = document.createElement("style"); style.textContent = CSS; document.head.appendChild(style);
  const right = document.querySelector(".top .right");
  box = document.createElement("div"); box.className = "wal"; box.id = "walletBox";
  right.insertBefore(box, right.querySelector(".webbtn"));
  live = document.createElement("div"); live.className = "sr"; live.id = "walletLive"; live.setAttribute("role", "status"); live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);
  dlg = document.createElement("dialog"); dlg.className = "wal-dlg"; dlg.setAttribute("aria-labelledby", "walDlgT"); document.body.appendChild(dlg);
  dlg.addEventListener("click", e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", () => { box.querySelector(".wal-btn:not([disabled])")?.focus(); });
  document.addEventListener("click", e => { if (menuOpen && !box.contains(e.target)) toggleMenu(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && menuOpen) { toggleMenu(false); box.querySelector(".wal-btn")?.focus(); } });
  W.subscribe(s => { renderBox(s); if (dlg.open) renderDialog(s); if (s.status && s.status !== lastStatus) { lastStatus = s.status; live.textContent = s.status; } });
  W.onTx(() => { if (menuOpen) renderBox(W.snapshot()); });
}

function renderBox(s) {
  let html;
  if (s.restoring) html = `<button class="wal-btn" disabled>Wallet…</button>`;
  else if (s.signedIn && s.account && s.account.toLowerCase() === s.sessionAddress.toLowerCase()) {
    html = `<button class="wal-btn on ${s.onMainnet ? "" : "warn"}" aria-haspopup="true" aria-expanded="${menuOpen}" aria-controls="walMenu" data-w="menu"><i class="d"></i>${esc(W.short(s.sessionAddress))}${s.onMainnet ? "" : " · wrong network"}</button>`;
  } else if (s.signedIn) {
    html = `<button class="wal-btn warn" aria-haspopup="true" aria-expanded="${menuOpen}" aria-controls="walMenu" data-w="menu"><i class="d"></i>${esc(W.short(s.sessionAddress))} · reconnect</button>`;
  } else if (s.account) {
    html = `<button class="wal-btn" data-w="signin" ${s.busy ? "disabled" : ""}>Sign in ${esc(W.short(s.account))}</button><button class="wal-btn on" data-w="menu" aria-haspopup="true" aria-expanded="${menuOpen}" aria-controls="walMenu" aria-label="Wallet menu">···</button>`;
  } else html = `<button class="wal-btn" data-w="connect" ${s.busy ? "disabled" : ""}>Connect wallet</button>`;
  box.innerHTML = html + (menuOpen ? menuHtml(s) : "");
  box.querySelectorAll("[data-w]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); act(b.dataset.w); }));
}

function menuHtml(s) {
  const txs = W.pendingList();
  const label = { pending: "pending", unknown: "not yet found", confirmed: "confirmed", reverted: "reverted" };
  return `<div class="wal-menu" id="walMenu" role="dialog" aria-label="Wallet account">
    <div class="kv">
      <span>Signed in</span><span>${s.sessionAddress ? esc(s.sessionAddress) : "No"}</span>
      <span>Wallet</span><span>${s.wallet ? esc(s.wallet.name) + (s.account ? " · " + esc(W.short(s.account)) : " · not connected") : "Not connected"}</span>
      <span>Network</span><span class="${s.onMainnet ? "acc" : "warn"}">${s.chainId == null ? "—" : s.onMainnet ? "Ethereum Mainnet" : "Chain " + s.chainId}</span>
      ${s.session.expiresAt ? `<span>Session ends</span><span>${esc(utc(s.session.expiresAt))}</span>` : ""}
    </div>
    <div class="txw-row">
      ${s.account && !s.onMainnet ? `<button class="btn sm pri" data-w="switch">Switch to Mainnet</button>` : ""}
      ${s.signedIn && !s.account ? `<button class="btn sm pri" data-w="connect">Reconnect wallet</button>` : ""}
      ${!s.signedIn && s.account ? `<button class="btn sm pri" data-w="signin">Sign in</button>` : ""}
      <button class="btn sm" data-w="logout">${s.signedIn ? "Log out" : "Disconnect"}</button>
    </div>
    <h3>Your transactions · this browser</h3>
    <div class="wal-tx">${txs.length ? txs.map(t => `<div><a href="https://etherscan.io/tx/${esc(t.hash)}" target="_blank" rel="noopener">${esc(t.title.slice(0, 34))} ↗</a><span class="${t.status === "confirmed" ? "acc" : t.status === "reverted" ? "crit" : "warn"}">${label[t.status] || esc(t.status)}</span></div>`).join("") : `<span class="sub">None sent from Qairos yet.</span>`}</div>
    ${txs.length ? `<div class="txw-row" style="margin-top:8px">${txs.some(t => t.status === "unknown" || t.status === "pending") ? `<button class="btn sm" data-w="recheck">Recheck pending</button>` : ""}<button class="btn sm" data-w="clear">Clear finished</button></div>` : ""}
    <div class="wal-st ${esc(s.statusKind)}">${esc(s.status)}</div>
  </div>`;
}
function toggleMenu(on) { menuOpen = on; renderBox(W.snapshot()); if (on) box.querySelector(".wal-menu button,.wal-menu a")?.focus(); }

async function act(w) {
  if (w === "menu") return toggleMenu(!menuOpen);
  if (w === "connect") { toggleMenu(false); return openDialog(); }
  if (w === "signin") { try { await W.signIn(); } catch (_) { openDialog(); } return; }
  if (w === "switch") return W.switchToMainnet().catch(() => {});
  if (w === "logout") { menuOpen = false; return W.logout(); }
  if (w === "recheck") return W.pendingList().filter(t => t.status === "unknown" || t.status === "pending").forEach(t => W.watch(t.hash, 15));
  if (w === "clear") { W.clearFinished(); renderBox(W.snapshot()); }
}

export function openDialog() {
  const s = W.snapshot();
  if (!s.account && s.providers.length === 1 && !s.busy) { W.connect(s.providers[0].id).then(() => { renderDialog(W.snapshot()); if (!dlg.open) dlg.showModal(); }).catch(() => { renderDialog(W.snapshot()); if (!dlg.open) dlg.showModal(); }); return; }
  renderDialog(s); if (!dlg.open) dlg.showModal();
}

function renderDialog(s) {
  let body;
  if (!s.account) {
    body = s.providers.length
      ? `<p class="sub" style="margin:0">Choose an installed wallet. Qairos asks only for your address; nothing is signed or sent at this step.</p>
         <div class="wal-list" role="list">${s.providers.map(p => `<button role="listitem" data-id="${esc(p.id)}" ${s.busy ? "disabled" : ""}>${p.icon ? `<img src="${esc(p.icon)}" alt="">` : `<i>${esc(p.name.slice(0, 2).toUpperCase())}</i>`}${esc(p.name)}<span class="sub">Connect</span></button>`).join("")}</div>`
      : `<p style="margin:0">No browser wallet detected.</p>
         <ol class="sub" style="padding-left:18px;display:grid;gap:6px">
           <li>Desktop: install a wallet extension (for example MetaMask, Rabby, Coinbase Wallet or Brave Wallet), then reload.</li>
           <li>Phone: open this page inside your wallet app's built-in browser.</li>
           <li>QR / WalletConnect pairing is not available: no external relay is configured for Qairos.</li>
         </ol>
         <p class="sub">Monitoring, key tools and copyable calldata keep working without a wallet.</p>`;
  } else if (!s.signedIn) {
    body = `<div class="kv"><span>Wallet</span><span>${esc(s.wallet?.name || "")}</span><span>Account</span><span>${esc(s.account)}</span><span>Network</span><span class="${s.onMainnet ? "acc" : "warn"}">${s.onMainnet ? "Ethereum Mainnet" : "Chain " + s.chainId}</span></div>
      <p class="sub">Sign in by signing a one-time Qairos text message (personal_sign). It costs no gas, moves no funds and grants no approval. The server verifies it and starts a session cookie.</p>
      <div class="txw-row"><button class="btn pri" data-d="signin" ${s.busy ? "disabled" : ""}>Sign message to sign in</button>${s.onMainnet ? "" : `<button class="btn" data-d="switch">Switch to Mainnet</button>`}<button class="btn" data-d="other">Use another wallet</button></div>`;
  } else {
    body = `<p style="margin:0">Signed in as <b class="acc">${esc(s.sessionAddress)}</b>.</p>
      ${s.onMainnet ? "" : `<p class="warn">Your wallet is not on Ethereum Mainnet.</p><div class="txw-row"><button class="btn pri" data-d="switch">Switch to Mainnet</button></div>`}
      <p class="sub">Every transaction still opens a review on its card and needs your confirmation in the wallet.</p>
      <div class="txw-row"><button class="btn" data-d="close">Close</button></div>`;
  }
  dlg.innerHTML = `<header><span class="lbl" id="walDlgT">${s.signedIn ? "Wallet" : s.account ? "Sign in" : "Connect a wallet"}</span><button class="btn sm" data-d="close" aria-label="Close dialog">Close</button></header>
    <div class="bd">${body}<div class="wal-st ${esc(s.statusKind)}" aria-live="polite">${esc(s.status)}</div></div>`;
  dlg.querySelectorAll("[data-id]").forEach(b => b.addEventListener("click", () => W.connect(b.dataset.id).catch(() => {})));
  dlg.querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", async () => {
    const d = b.dataset.d;
    if (d === "close") dlg.close();
    else if (d === "signin") { try { await W.signIn(); } catch (_) {} }
    else if (d === "switch") W.switchToMainnet().catch(() => {});
    else if (d === "other") { await W.logout(); openDialog(); }
  }));
  const f = dlg.querySelector(".bd button:not([disabled])"); if (f && document.activeElement?.closest("dialog") !== dlg) f.focus();
}
