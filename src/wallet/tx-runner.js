// Per-card send/call controller. Every write requires: signed-in session, connected wallet on chain 1,
// wallet account == session account == card's bound account, a fresh simulation + gas estimate,
// explicit user review, and a final preflight. Nothing is ever sent automatically.
import * as W from "./core.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
const ether = w => { w = BigInt(w || 0); const i = w / 10n ** 18n, f = (w % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, ""); return i.toString() + (f ? "." + f : ""); };
const ex = h => `<a href="https://etherscan.io/tx/${esc(h)}" target="_blank" rel="noopener">${esc(h.slice(0, 12) + "…" + h.slice(-8))} ↗</a>`;
const mounted = new Set();

function blocker(spec, s) {
  if (spec.call) {
    if (!s.wallet || !s.account) return { msg: "Connect a wallet to run this read through it on Mainnet.", act: "connect" };
    if (!s.onMainnet) return { msg: "Wallet is on chain " + s.chainId + ". Switch to Ethereum Mainnet.", act: "switch" };
    return null;
  }
  if (!s.signedIn) return { msg: s.account ? "Sign in with " + W.short(s.account) + " to send." : "Connect and sign in with a wallet to send.", act: s.account ? "signin" : "connect" };
  if (!s.account) return { msg: "Signed in as " + W.short(s.sessionAddress) + ". Reconnect that wallet to send.", act: "connect" };
  if (!same(s.account, s.sessionAddress)) return { msg: "Wallet account differs from your signed-in account. Sends are disabled until you sign in again or switch back.", act: null };
  if (!s.onMainnet) return { msg: "Wallet is on chain " + s.chainId + ". Switch to Ethereum Mainnet.", act: "switch" };
  if (spec.bind && !same(spec.bind, s.sessionAddress)) return { msg: "This transaction is bound to " + W.short(spec.bind) + ", but you are signed in as " + W.short(s.sessionAddress) + ". Rebuild it for the signed-in account; a different signer would invalidate it.", act: null };
  return null;
}

export function mountTx(el, spec) {
  const host = el.querySelector(".txrun"); if (!host) return;
  let st = el._txs && el._txs.key === spec.key ? el._txs : null;
  // A changed transaction (args, value, account binding) always starts a fresh review.
  // Any hash already sent stays tracked in the header's transaction list.
  if (!st) st = { key: spec.key, phase: "idle" };
  el._txs = st; el._txSpec = spec; mounted.add(el);
  render(el);
}

function set(el, patch) { Object.assign(el._txs, patch); render(el); }

function render(el) {
  if (!el.isConnected) { mounted.delete(el); return; }
  const spec = el._txSpec, st = el._txs, s = W.snapshot(), host = el.querySelector(".txrun"); if (!host) return;
  const b = blocker(spec, s);
  if (spec.call) {
    const out = st.result != null ? `<div class="out ${st.ok ? "ok" : "bad"}" role="status">${esc(st.result)}</div>` : "";
    host.innerHTML = `<div class="txw"><div class="txw-row"><button class="btn sm pri" data-a="call" ${b || st.phase === "calling" ? "disabled" : ""}>${st.phase === "calling" ? "Calling…" : "Call on Mainnet"}</button>${b ? actBtn(b) : ""}</div>${b ? `<p class="sub txw-why">${esc(b.msg)}</p>` : ""}${out}</div>`;
    wire(el); return;
  }
  const value = BigInt(spec.value || 0);
  const locked = ["sending", "pending", "unknown"].includes(st.phase);
  let body = "";
  if (st.phase === "idle" || st.phase === "rejected" || st.phase === "error") {
    body = `<div class="txw-row"><button class="btn sm pri" data-a="review" ${b ? "disabled" : ""}>Review &amp; send with wallet</button>${b ? actBtn(b) : ""}</div>${b ? `<p class="sub txw-why">${esc(b.msg)}</p>` : ""}`;
    if (st.phase === "rejected") body += `<div class="out bad" role="status">Rejected in the wallet. Nothing was sent.</div>`;
    if (st.phase === "error") body += `<div class="out bad" role="status">${esc(st.msg)}</div>`;
  } else {
    const from = st.from || s.sessionAddress;
    body = `<div class="txw-review" role="group" aria-label="Transaction review">
       <div class="lbl acc">Review before sending</div>
       <p class="sub">These contracts have not been independently audited. Mainnet transactions cannot be undone and cost ETH for gas, even when they revert. Quantum monitoring is not a guarantee that funds are safe.</p>
      <div class="kv">
        <span>Network</span><span>Ethereum Mainnet · chain 1</span>
        <span>Contract</span><span>${esc(spec.contract)}<br><a href="https://etherscan.io/address/${esc(spec.to)}" target="_blank" rel="noopener">${esc(spec.to)}</a></span>
        <span>Function</span><span>${esc(spec.sig)}</span>
        ${(spec.args || []).map((a, i) => `<span>Arg ${i + 1}</span><span>${esc(String(a).length > 140 ? String(a).slice(0, 70) + "…" + String(a).slice(-40) + " (" + ((String(a).length - 2) / 2) + " bytes)" : a)}</span>`).join("")}
        <span>Value</span><span class="${value > 0n ? "warn" : ""}">${esc(ether(value))} ETH<br><span class="sub">${esc(value.toString())} wei</span></span>
        <span>From</span><span>${esc(from || "—")}</span>
        <span>Simulation</span><span>${st.phase === "simulating" ? "Simulating with your wallet…" : st.phase === "simfail" ? `<span class="crit">${esc(st.msg)}</span>` : st.gas ? `<span class="acc">Passed</span> · gas estimate ${st.gas.toLocaleString("en-US")}` : "—"}</span>
      </div>`;
    if (st.phase === "review" || st.phase === "simfail" || st.phase === "simulating") {
      const can = st.phase === "review" && !b;
      body += `<label class="txw-ack"><input type="checkbox" data-a="ack" ${st.ack ? "checked" : ""} ${can ? "" : "disabled"}> I reviewed the contract, function, arguments, value and sending account.</label>
      <div class="txw-row"><button class="btn sm pri" data-a="send" ${can && st.ack ? "" : "disabled"}>Confirm in wallet</button><button class="btn sm" data-a="resim" ${st.phase === "simulating" ? "disabled" : ""}>Re-simulate</button><button class="btn sm" data-a="cancel">Cancel</button></div>
      ${b ? `<p class="sub txw-why">${esc(b.msg)}</p>` : ""}`;
    }
    if (st.phase === "sending") body += `<div class="out" role="status">Rechecking network, account and session, then opening your wallet… Approve or reject there.</div>`;
    if (st.hash) {
      const label = { pending: "Pending · waiting for a receipt", unknown: "Still pending or not found after polling. It may confirm later.", confirmed: "Confirmed · receipt status 1" + (st.block ? " · block " + st.block.toLocaleString("en-US") : ""), reverted: "Reverted on-chain · receipt status 0. Gas was spent; state did not change." }[st.phase] || st.phase;
      const cls = st.phase === "confirmed" ? "ok" : st.phase === "reverted" ? "bad" : "";
      body += `<div class="out ${cls}" role="status">${esc(label)}<br>Tx ${ex(st.hash)}${st.from ? "<br>Sent from " + esc(st.from) : ""}</div>
      <div class="txw-row">${st.phase === "unknown" ? `<button class="btn sm" data-a="recheck">Recheck receipt</button>` : ""}${["confirmed", "reverted"].includes(st.phase) ? `<button class="btn sm" data-a="cancel">Done</button>` : ""}</div>`;
    }
    body += `</div>`;
  }
  host.innerHTML = `<div class="txw${locked ? " busy" : ""}">${body}</div>`;
  wire(el);
}
function actBtn(b) {
  if (b.act === "connect") return `<button class="btn sm" data-a="connect">Connect wallet</button>`;
  if (b.act === "signin") return `<button class="btn sm" data-a="signin">Sign in</button>`;
  if (b.act === "switch") return `<button class="btn sm" data-a="switch">Switch to Mainnet</button>`;
  return "";
}

function wire(el) {
  el.querySelectorAll(".txrun [data-a]").forEach(n => {
    const a = n.dataset.a;
    if (a === "ack") n.addEventListener("change", () => set(el, { ack: n.checked }));
    else n.addEventListener("click", () => action(el, a));
  });
}

async function action(el, a) {
  const spec = el._txSpec, st = el._txs, s = W.snapshot();
  if (a === "connect") return window.qairosWallet.openDialog();
  if (a === "signin") return W.signIn().catch(() => {});
  if (a === "switch") return W.switchToMainnet().catch(() => {});
  if (a === "cancel") return set(el, { phase: "idle", ack: false, gas: null, msg: "", hash: null, from: null });
  if (a === "call") {
    set(el, { phase: "calling", result: null }); const cst = el._txs;
    try { const raw = await W.ethCall({ to: spec.to, data: spec.data }); if (el._txs !== cst || el._txSpec !== spec) return; let txt = raw; try { if (spec.fragment) txt = W.decodeResult(spec.fragment, raw); } catch (_) {} set(el, { phase: "idle", ok: true, result: txt + (txt !== raw ? "\nraw " + raw : "") + "\nread " + new Date().toISOString().slice(0, 19) + "Z UTC" }); }
    catch (e) { if (el._txs === cst && el._txSpec === spec) set(el, { phase: "idle", ok: false, result: W.describe(e) }); }
    return;
  }
  if (a === "review" || a === "resim") {
    if (blocker(spec, s)) return render(el);
    const from = s.sessionAddress;
    set(el, { phase: "simulating", from, ack: false, gas: null, msg: "" });
    try {
      const gas = await W.simulate({ from, to: spec.to, data: spec.data, value: spec.value });
      if (el._txs !== st || el._txSpec !== spec) return;
      set(el, { phase: "review", gas });
    } catch (e) { if (el._txs === st) set(el, { phase: "simfail", msg: W.describe(e) + " · Not sendable as built." }); }
    return;
  }
  if (a === "send") {
    if (st.phase !== "review" || !st.ack || !st.gas || el._sending) return;
    const now = W.snapshot();
    if (blocker(spec, now) || !same(now.sessionAddress, st.from)) return set(el, { phase: "error", msg: "Account or network changed since review. Review again. Nothing was sent." });
    el._sending = true; set(el, { phase: "sending" });
    try {
      const hash = await W.sendTx({ from: st.from, to: spec.to, data: spec.data, value: spec.value, gas: st.gas, meta: { title: spec.title } });
      W.watch(hash); // tracked globally with its original sender even if this card was rebuilt
      if (el._txs === st && el._txSpec === spec) set(el, { phase: "pending", hash });
      else if (el._txs && el._txs.phase === "idle") set(el, { phase: "error", msg: "A transaction from the previous version of this card was sent: " + hash + ". Track it in the wallet menu; this rebuilt card has not been sent." });
    } catch (e) { if (el._txs === st && el._txSpec === spec) set(el, W.isRejection(e) ? { phase: "rejected" } : { phase: "error", msg: W.describe(e) }); }
    finally { el._sending = false; }
    return;
  }
  if (a === "recheck" && st.hash) { set(el, { phase: "pending" }); W.watch(st.hash, 15); }
}

W.onTx(p => {
  if (!p) return;
  mounted.forEach(el => { const st = el._txs; if (st && st.hash === p.hash && st.phase !== p.status) set(el, { phase: p.status, block: p.block }); });
});
W.subscribe(s => {
  mounted.forEach(el => {
    const st = el._txs; if (!st) return;
    // An account switch during review cancels it; in-flight hashes keep their original sender.
    if (["review", "simulating", "simfail"].includes(st.phase) && st.from && !same(st.from, s.sessionAddress)) Object.assign(st, { phase: "error", msg: "Signed-in account changed during review. Review cancelled; nothing was sent.", ack: false });
    if (el._txs.phase !== "sending" && el._txs.phase !== "calling") render(el);
  });
});
