// Qairos wallet core: injected EIP-1193 providers (EIP-6963 + legacy window.ethereum),
// explicit connect, personal_sign session, Mainnet transaction engine.
// No private keys, no secrets, no auth token storage (session cookie is HttpOnly on the server).
import { Interface, getAddress, hexlify, toUtf8Bytes } from "ethers";

const MAINNET = 1;
const LAST_KEY = "qairos.wallet.last"; // wallet id only, not a credential
const PENDING_KEY = "qairos.wallet.pendingTx"; // tx hashes only
const api = p => new URL("../api/wallet" + p, location.href).href;

export const ERRORS_ABI = [
  "error QuantumBreakerTripped(uint8 level, uint8 threshold)", "error Reentrancy()", "error Insufficient()",
  "error NoRecoveryCommit()", "error RecoveryTooEarly()", "error ArkMismatch()", "error NotPreMoment()",
  "error TransferFailed()", "error MomentPassed()", "error NotCurator()", "error BadRung()", "error AlreadyBroken()",
  "error NoCommit()", "error RevealTooEarly()", "error WrongKey()", "error PayoutFailed()", "error BadTerm()",
  "error WrongPremium(uint256 expected)", "error NoCapacity()", "error NotHolder()", "error NotCovered()",
  "error StillActive()", "error PolicyClosed()", "error Locked()", "error NotCreator()", "error Closed()",
  "error NotSettleable()", "error NotSettled()", "error NothingToClaim()", "error NotCanary()",
  "error CanaryAlreadySet()", "error NotDeployer()",
];
const errIface = new Interface(ERRORS_ABI);

const state = {
  providers: [], active: null, account: null, chainId: null,
  session: { address: null, csrfToken: null, expiresAt: null },
  restoring: true, busy: false, status: "", statusKind: "",
};
const subs = new Set();
const lower = a => (a ? String(a).toLowerCase() : "");
const same = (a, b) => !!a && !!b && lower(a) === lower(b);

export function snapshot() {
  const s = state.session;
  const mismatched = !!s.address && !!state.account && !same(s.address, state.account);
  const expired = s.expiresAt && Date.parse(s.expiresAt) <= Date.now();
  const signedIn = !!s.address && !expired;
  return {
    providers: state.providers.map(({ id, name, icon }) => ({ id, name, icon })),
    wallet: state.active ? { id: state.active.id, name: state.active.name } : null,
    account: state.account, chainId: state.chainId, onMainnet: state.chainId === MAINNET,
    session: { ...s }, signedIn, sessionAddress: signedIn ? s.address : null,
    ready: signedIn && !!state.account && same(state.account, s.address) && state.chainId === MAINNET,
    mismatched, revokeFailed: !!state.revokeFailed, restoring: state.restoring, busy: state.busy, status: state.status, statusKind: state.statusKind,
  };
}
function emit() {
  const snap = snapshot();
  subs.forEach(f => { try { f(snap); } catch (_) {} });
  window.dispatchEvent(new CustomEvent("qairos:wallet-state", { detail: snap }));
}
export function subscribe(fn) { subs.add(fn); fn(snapshot()); return () => subs.delete(fn); }
function status(msg, kind = "") { state.status = msg; state.statusKind = kind; emit(); }
function announceIdentity() {
  window.dispatchEvent(new CustomEvent("qairos:wallet", { detail: { address: snapshot().sessionAddress } }));
}

/* ---------- discovery ---------- */
const safeIcon = i => (typeof i === "string" && /^data:image\/(png|svg\+xml|webp|jpeg|gif)[;,]/i.test(i) ? i : "");
function legacyName(p) {
  if (p.isRabby) return "Rabby"; if (p.isCoinbaseWallet) return "Coinbase Wallet"; if (p.isBraveWallet) return "Brave Wallet";
  if (p.isTrust || p.isTrustWallet) return "Trust Wallet"; if (p.isOkxWallet || p.isOKExWallet) return "OKX Wallet";
  if (p.isFrame) return "Frame"; if (p.isMetaMask) return "MetaMask"; return "Browser wallet";
}
function addProvider(info, provider, legacy) {
  if (!provider || typeof provider.request !== "function") return;
  if (state.providers.some(p => p.provider === provider)) return;
  const name = String(info.name || "Injected wallet").slice(0, 40);
  if (legacy && state.providers.some(p => p.name === name)) return;
  let id = String(info.rdns || info.uuid || "injected." + name.toLowerCase().replace(/\W+/g, "-"));
  while (state.providers.some(p => p.id === id)) id += "+";
  state.providers.push({ id, name, icon: safeIcon(info.icon), provider });
  emit();
}
function discoverLegacy() {
  const eth = window.ethereum;
  if (!eth) return;
  const list = Array.isArray(eth.providers) && eth.providers.length ? eth.providers : [eth];
  list.forEach(p => addProvider({ name: legacyName(p) }, p, true));
}
window.addEventListener("eip6963:announceProvider", e => {
  const d = e.detail; if (d && d.info && d.provider) addProvider(d.info, d.provider, false);
});

/* ---------- provider binding ---------- */
const req = (method, params) => {
  if (!state.active) throw Object.assign(new Error("No wallet connected"), { code: "NO_WALLET" });
  return state.active.provider.request(params ? { method, params } : { method });
};
const handlers = {
  accountsChanged: async accounts => {
    const next = accounts && accounts[0] ? getAddress(accounts[0]) : null;
    const prev = state.account; state.account = next;
    if (!next) { status("Wallet disconnected the site. Reconnect to send.", "warn"); return; }
    if (prev && !same(prev, next)) {
      if (state.session.address && !same(state.session.address, next)) { await endMismatchedSession("Wallet account changed to " + short(next) + "."); return; }
      status("Wallet account changed to " + short(next) + ".", "warn");
    } else emit();
  },
  chainChanged: c => { state.chainId = parseInt(c, 16); status(state.chainId === MAINNET ? "Wallet on Ethereum Mainnet." : "Wallet is on chain " + state.chainId + ". Switch to Ethereum Mainnet to send.", state.chainId === MAINNET ? "ok" : "warn"); },
  disconnect: () => { state.account = null; state.chainId = null; status("Wallet disconnected.", "warn"); },
};
function bind(p) {
  if (state.active && state.active.provider.removeListener) for (const [k, f] of Object.entries(handlers)) state.active.provider.removeListener(k, f);
  state.active = p;
  if (p && p.provider.on) for (const [k, f] of Object.entries(handlers)) p.provider.on(k, f);
}
export const short = (a, n = 4) => (a && a.length > 2 * n + 4 ? a.slice(0, n + 2) + "…" + a.slice(-n) : a || "");

/* ---------- session ---------- */
async function json(url, init = {}) {
  const r = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) }, ...init, signal: AbortSignal.timeout(15000) });
  let body = null; try { body = r.status === 204 ? null : await r.json(); } catch (_) {}
  if (!r.ok) throw Object.assign(new Error((body && (body.error || body.message)) || "Request failed (" + r.status + ")"), { status: r.status });
  return body;
}
export async function fetchSession() {
  const s = await json(api("/session"));
  state.session = { address: s && s.address ? getAddress(s.address) : null, csrfToken: (s && s.csrfToken) || null, expiresAt: (s && s.expiresAt) || null };
  return state.session;
}
/** Revokes the server session. On failure the session (and its CSRF token) is kept so the user can retry;
 *  identity is never reported as anonymous while the cookie may still be valid. Returns true on success. */
async function logoutServer() {
  const token = state.session.csrfToken;
  if (!state.session.address) return true;
  try {
    await json(api("/session"), { method: "DELETE", headers: token ? { "X-CSRF-Token": token } : {} });
    state.session = { address: null, csrfToken: null, expiresAt: null }; state.revokeFailed = false;
    return true;
  } catch (e) {
    state.revokeFailed = true;
    return false;
  }
}
function mismatch(msg) {
  // Sends are already disabled by snapshot().ready; tell the app to clear user-scoped previews now.
  window.dispatchEvent(new CustomEvent("qairos:wallet-mismatch", { detail: { session: state.session.address, account: state.account } }));
  status(msg, "warn");
}
async function endMismatchedSession(prefix) {
  mismatch(prefix + " Sends disabled; signing out of " + short(state.session.address) + "…");
  if (await logoutServer()) { status(prefix + " Signed out; sign in again with " + short(state.account) + ".", "warn"); announceIdentity(); }
  else status(prefix + " Sign-out FAILED: the previous session may still be active on the server. Use Log out to retry.", "bad");
}

export async function connect(id) {
  const p = state.providers.find(x => x.id === id) || (state.providers.length === 1 ? state.providers[0] : null);
  if (!p) throw new Error("Choose an installed wallet.");
  state.busy = true; state.account = null; state.chainId = null; bind(null);
  status("Waiting for " + p.name + " to approve the connection…");
  try {
    bind(p);
    const accounts = await req("eth_requestAccounts");
    if (!accounts || !accounts[0]) throw new Error("The wallet returned no account.");
    state.account = getAddress(accounts[0]);
    state.chainId = parseInt(await req("eth_chainId"), 16);
    try { localStorage.setItem(LAST_KEY, p.id); } catch (_) {}
    if (state.session.address && !same(state.session.address, state.account)) await endMismatchedSession("Connected account differs from the signed-in account.");
    status("Connected " + short(state.account) + " with " + p.name + (state.chainId === MAINNET ? "." : ". Wrong network: switch to Ethereum Mainnet."), state.chainId === MAINNET ? "ok" : "warn");
    return state.account;
  } catch (e) {
    state.account = null; state.chainId = null; bind(null);
    status(describe(e), "bad"); throw e;
  } finally { state.busy = false; emit(); }
}

export async function signIn() {
  if (!state.account) throw new Error("Connect a wallet first.");
  const account = state.account;
  state.busy = true; status("Requesting a sign-in message for " + short(account) + "…");
  try {
    const { message } = await json(api("/nonce"), { method: "POST", body: JSON.stringify({ address: account }) });
    if (typeof message !== "string" || !message) throw new Error("Server did not return a sign-in message.");
    status("Check your wallet: sign the Qairos message. It costs no gas and sends no transaction.");
    const signature = await req("personal_sign", [hexlify(toUtf8Bytes(message)), account]);
    if (!same(account, state.account)) throw new Error("Wallet account changed while signing. Sign in again.");
    const v = await json(api("/verify"), { method: "POST", body: JSON.stringify({ signature }) });
    if (!v || !same(v.address, account)) {
      state.session = { address: v && v.address ? getAddress(v.address) : null, csrfToken: (v && v.csrfToken) || null, expiresAt: (v && v.expiresAt) || null };
      const ok = await logoutServer();
      throw new Error("Server verified a different account. " + (ok ? "Not signed in." : "Sign-out of that session FAILED; use Log out to retry."));
    }
    if (!same(account, state.account)) { state.session = { address: getAddress(v.address), csrfToken: v.csrfToken || null, expiresAt: v.expiresAt || null }; await endMismatchedSession("Wallet account changed during sign-in."); return null; }
    state.session = { address: getAddress(v.address), csrfToken: v.csrfToken || null, expiresAt: v.expiresAt || null };
    status("Signed in as " + short(account) + ".", "ok");
    announceIdentity();
    return state.session.address;
  } catch (e) { status(describe(e), "bad"); throw e; }
  finally { state.busy = false; emit(); }
}

export async function logout() {
  state.busy = true; emit();
  if (!(await logoutServer())) { state.busy = false; status("Sign-out FAILED: the server session may still be active. Check your connection and retry Log out.", "bad"); return false; }
  bind(null); state.account = null; state.chainId = null;
  try { localStorage.removeItem(LAST_KEY); } catch (_) {}
  state.busy = false; status("Signed out. Wallet connection forgotten on this site.", "ok");
  announceIdentity();
  return true;
}

export async function switchToMainnet() {
  try { await req("wallet_switchEthereumChain", [{ chainId: "0x1" }]); state.chainId = parseInt(await req("eth_chainId"), 16); status(state.chainId === MAINNET ? "Switched to Ethereum Mainnet." : "Wallet did not switch networks.", state.chainId === MAINNET ? "ok" : "warn"); }
  catch (e) { status(describe(e), "bad"); throw e; }
}

/** Reconnect after reload: reads the server session and asks the last wallet for accounts silently (eth_accounts). Never requests a signature. */
async function restore() {
  try { await fetchSession(); } catch (_) { state.session = { address: null, csrfToken: null, expiresAt: null }; }
  await new Promise(r => setTimeout(r, 450));
  discoverLegacy();
  let last = null; try { last = localStorage.getItem(LAST_KEY); } catch (_) {}
  const p = last && state.providers.find(x => x.id === last);
  if (p) {
    try {
      bind(p);
      const accounts = await req("eth_accounts");
      if (accounts && accounts[0]) {
        state.account = getAddress(accounts[0]);
        state.chainId = parseInt(await req("eth_chainId"), 16);
      } else bind(null);
    } catch (_) { bind(null); }
  }
  if (state.session.address && state.account && !same(state.session.address, state.account)) {
    state.restoring = false; await endMismatchedSession("Wallet account differs from the previous session."); return;
  }
  if (state.session.address) state.status = state.account ? "Session restored for " + short(state.session.address) + "." : "Signed in as " + short(state.session.address) + ". Reconnect your wallet to send transactions.";
  state.restoring = false; emit();
}

/* ---------- errors ---------- */
function revertData(e) {
  for (let x = e, i = 0; x && i < 6; i++) {
    const d = x.data;
    if (typeof d === "string" && /^0x[0-9a-f]{8,}$/i.test(d)) return d;
    if (d && typeof d === "object" && typeof d.data === "string" && /^0x[0-9a-f]{8,}$/i.test(d.data)) return d.data;
    x = x.error || x.cause || (d && typeof d === "object" ? d : null);
  }
  return null;
}
export function decodeRevert(e) {
  const d = revertData(e);
  if (!d) return null;
  try { const p = errIface.parseError(d); if (p) return p.name + (p.args.length ? "(" + p.args.map(String).join(", ") + ")" : ""); } catch (_) {}
  try {
    if (d.startsWith("0x08c379a0")) return "Error: " + Interface.from(["function Error(string)"]).decodeFunctionData("Error", d)[0];
    if (d.startsWith("0x4e487b71")) return "Panic(0x" + BigInt(Interface.from(["function Panic(uint256)"]).decodeFunctionData("Panic", d)[0]).toString(16) + ")";
  } catch (_) {}
  return "custom error " + d.slice(0, 10);
}
export const isRejection = e => !!e && (e.code === 4001 || e.code === "ACTION_REJECTED" || (e.error && e.error.code === 4001) || /user (rejected|denied)/i.test(String(e.message || "")));
export function describe(e) {
  if (!e) return "Unknown error";
  if (isRejection(e)) return "Request rejected in the wallet.";
  if (e.code === -32002) return "The wallet already has a pending request. Open it to continue.";
  if (e.code === 4902) return "The wallet does not know this network.";
  const r = decodeRevert(e); if (r) return "Reverted: " + r;
  return String(e.shortMessage || e.message || e).slice(0, 220);
}

/* ---------- transactions ---------- */
const toHex = v => "0x" + BigInt(v || 0).toString(16);
async function liveChain() { const c = parseInt(await req("eth_chainId"), 16); state.chainId = c; return c; }

export async function ethCall({ to, data }) {
  if (!state.active) throw new Error("Connect a wallet to read from Mainnet through it.");
  if ((await liveChain()) !== MAINNET) throw new Error("Wallet is not on Ethereum Mainnet.");
  return req("eth_call", [{ to, data }, "latest"]);
}
export function decodeResult(fragment, data) {
  const iface = new Interface([fragment]); const fn = iface.fragments[0];
  const out = iface.decodeFunctionResult(fn.name, data);
  const fmt = v => (typeof v === "bigint" ? v.toString() : Array.isArray(v) ? "[" + Array.from(v).map(fmt).join(", ") + "]" : String(v));
  return fn.outputs.map((o, i) => (o.name ? o.name + " = " : "") + fmt(out[i])).join("\n") || "(no return value)";
}

/** Simulates (eth_call) and estimates gas with the connected wallet, from the authenticated account. */
export async function simulate({ from, to, data, value }) {
  const tx = { from, to, data, value: toHex(value) };
  await req("eth_call", [tx, "latest"]);
  return BigInt(await req("eth_estimateGas", [tx]));
}
/** Final gate immediately before eth_sendTransaction. */
export async function preflight(from) {
  if (!state.active) throw new Error("No wallet connected.");
  if ((await liveChain()) !== MAINNET) throw new Error("Wallet is not on Ethereum Mainnet. Nothing was sent.");
  const accounts = await req("eth_accounts");
  if (!accounts || !same(accounts[0], from)) throw new Error("The wallet's active account is not " + short(from) + ". Nothing was sent.");
  const s = await fetchSession(); emit();
  if (!s.address || !same(s.address, from)) throw new Error("Your signed-in session is not " + short(from) + ". Sign in again. Nothing was sent.");
  if (s.expiresAt && Date.parse(s.expiresAt) <= Date.now()) throw new Error("Session expired. Sign in again. Nothing was sent.");
  await recheckWallet(from);
}
async function recheckWallet(from) {
  if ((await liveChain()) !== MAINNET) throw new Error("Wallet left Ethereum Mainnet. Nothing was sent.");
  const a = await req("eth_accounts");
  if (!a || !same(a[0], from) || !same(state.account, from)) throw new Error("Wallet account changed. Nothing was sent.");
}
const inflightKeys = new Set();
export async function sendTx({ from, to, data, value, gas, meta }) {
  const key = lower(from) + lower(to) + lower(data) + BigInt(value || 0).toString();
  if (inflightKeys.has(key)) throw new Error("An identical transaction is already awaiting your wallet.");
  inflightKeys.add(key);
  try {
    await preflight(from);
    // Fresh simulation + estimate right before sending; the reviewed estimate may be stale.
    let fresh;
    try { fresh = await simulate({ from, to, data, value }); }
    catch (e) { throw Object.assign(new Error("Fresh simulation failed: " + describe(e) + " Nothing was sent."), { code: "SIM_FAILED" }); }
    await recheckWallet(from);
    const g = fresh; // always the fresh estimate, never the reviewed one
    const hash = await req("eth_sendTransaction", [{ from, to, data, value: toHex(value), gas: toHex((g * 12n) / 10n + 1000n) }]);
    if (!/^0x[0-9a-f]{64}$/i.test(String(hash))) throw new Error("Wallet returned no transaction hash.");
    addPending({ hash, from, to, title: (meta && meta.title) || "Transaction", ts: Date.now(), status: "pending" });
    return hash;
  } finally { inflightKeys.delete(key); }
}

/* pending registry: persisted hashes, bounded polling, explicit recheck */
let pending = []; try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]").filter(p => /^0x[0-9a-f]{64}$/i.test(p.hash)).slice(0, 20); } catch (_) { pending = []; }
const savePending = () => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending.slice(0, 20))); } catch (_) {} };
function addPending(p) { pending = [p, ...pending.filter(x => x.hash !== p.hash)].slice(0, 20); savePending(); emitTx(p); }
export const pendingList = () => pending.slice();
const txSubs = new Set();
export function onTx(fn) { txSubs.add(fn); return () => txSubs.delete(fn); }
function emitTx(p) { txSubs.forEach(f => { try { f(p); } catch (_) {} }); }
function setTxStatus(hash, status, extra = {}) {
  const p = pending.find(x => x.hash === hash); if (!p) return;
  Object.assign(p, { status }, extra); savePending(); emitTx(p);
  if (status === "confirmed") window.dispatchEvent(new CustomEvent("qairos:tx-confirmed", { detail: { hash, title: p.title } }));
}
export function clearFinished() { pending = pending.filter(p => p.status === "pending" || p.status === "unknown"); savePending(); emitTx(null); }
const watching = new Set();
/** Polls up to ~3 minutes. A hash with no receipt stays "unknown" (still possibly pending) until rechecked. */
export async function watch(hash, attempts = 45) {
  if (watching.has(hash)) return; watching.add(hash);
  try {
    setTxStatus(hash, "pending");
    for (let i = 0; i < attempts; i++) {
      let rc = null;
      try { if (state.active && (await liveChain()) === MAINNET) rc = await req("eth_getTransactionReceipt", [hash]); } catch (_) {}
      if (rc && rc.blockNumber) {
        if (rc.status === "0x1" || rc.status === 1) setTxStatus(hash, "confirmed", { block: parseInt(rc.blockNumber, 16) });
        else setTxStatus(hash, "reverted", { block: parseInt(rc.blockNumber, 16) });
        return;
      }
      await new Promise(r => setTimeout(r, 4000));
    }
    setTxStatus(hash, "unknown");
  } finally { watching.delete(hash); }
}
export const txStatus = hash => (pending.find(p => p.hash === hash) || {}).status || null;

export function start() {
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  restore().then(() => pending.filter(p => p.status === "pending").forEach(p => watch(p.hash, 15)));
}
