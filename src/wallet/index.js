// Entry imported by app/index.html as a module so Vite bundles ethers.
import * as W from "./core.js";
import { mountTx } from "./tx-runner.js";
import { mountUI, openDialog } from "./ui.js";

mountUI();
W.start();

const api = {
  state: W.snapshot,
  subscribe: W.subscribe,
  providers: () => W.snapshot().providers,
  connect: W.connect,
  signIn: W.signIn,
  logout: W.logout,
  switchToMainnet: W.switchToMainnet,
  openDialog,
  refreshSession: W.fetchSession,
  pendingTransactions: W.pendingList,
  recheck: hash => W.watch(hash, 15),
};
window.qairosWallet = Object.freeze(api);
window.QairosWalletLib = Object.freeze({ mountTx, ...api });
window.dispatchEvent(new Event("qairos:wallet-lib"));
