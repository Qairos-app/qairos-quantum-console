export function startMainnetMonitor({ getAddresses, officialAddresses, onSnapshot }) {
  const $ = id => document.getElementById(id);
  let busy = false, lastSuccess = 0;
  function unavailable(message) {
    $("liveNetwork").textContent = "Unavailable";
    $("liveNetwork").className = "warn";
    $("liveInfo").textContent = message;
    $("dLvl").innerHTML = "—<small> / 05</small>";
    $("dLvlNote").textContent = "No current Mainnet reading";
    $("dIntact").textContent = "—";
    $("liveMarketRows").textContent = "Live pools unavailable. Paper positions above are not on-chain trades.";
    onSnapshot(null);
  }
  async function refresh() {
    if (busy) return;
    busy = true;
    $("refreshMainnet").disabled = true;
    try {
      const response = await fetch(new URL("./api/mainnet/status", new URL("../", location.href)), {
        headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error("Unavailable");
      const s = await response.json();
      const age = Date.now() - Date.parse(s.observedAtUtc);
      if (s.chainId !== 1 || !(s.threatLevel >= 0 && s.threatLevel <= 5) || !Array.isArray(s.rungs) || !Array.isArray(s.markets) || !(age >= -60_000 && age < 90_000)) {
        throw new Error("Invalid or stale status");
      }
      lastSuccess = Date.now();
      $("liveNetwork").textContent = `Live · level ${s.threatLevel}/5 · ${s.vaultBreakerTripped ? "breaker tripped" : "breaker open"}`;
      $("liveNetwork").className = s.threatLevel > 0 ? "warn" : "acc";
      const custom = Object.entries(officialAddresses).some(([name, address]) => getAddresses()[name]?.toLowerCase() !== address.toLowerCase());
      $("liveInfo").textContent = `Official Ethereum Mainnet deployment · block ${s.blockNumber.toLocaleString("en-US")} · read ${s.observedAtUtc} · ${s.rungCount} rungs · ${s.marketCount} markets · ${s.contracts.length}/6 contracts deployed. ${custom ? "Custom transaction addresses are NOT monitored; this status is for the official deployment." : "Read-only refresh every 30 seconds."}`;
      $("dLvl").innerHTML = String(s.threatLevel).padStart(2, "0") + "<small> / 05</small>";
      $("dLvlNote").textContent = "Live Mainnet · " + (s.threatLevel === 0 ? "No armed break reported" : "Armed break reported");
      const armed = s.rungs.filter(r => r.armed);
      $("dIntact").innerHTML = armed.filter(r => !r.broken).length + `<small> / ${armed.length}</small>`;
      $("liveMarketRows").replaceChildren(...s.markets.map(m => {
        const row = document.createElement("p");
        const eth = v => (Number(BigInt(v)) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 });
        row.textContent = `Market ${m.id} · ${m.bits}-bit · YES ${eth(m.yesPoolWei)} ETH / NO ${eth(m.noPoolWei)} ETH · ${m.settled ? (m.yesWon ? "settled YES" : "settled NO") : "open until " + new Date(m.deadline * 1000).toISOString()}`;
        return row;
      }));
      onSnapshot(s);
      // Preserve the existing solver table; use a separate live status list.
      let list = $("liveRungRows");
      if (!list) {
        list = document.createElement("p"); list.id = "liveRungRows"; list.className = "sub";
        document.getElementById("rungTable").parentElement.append(list);
      }
      list.textContent = "Live Mainnet: " + s.rungs.map(r => `${r.bits}-bit ${r.broken ? "BROKEN" : "intact"} (${(Number(BigInt(r.bountyWei))/1e18).toLocaleString("en-US", {maximumFractionDigits:6})} ETH bounty)`).join(" · ");
    } catch {
      unavailable("Mainnet data is unavailable or stale. Do not treat this as level zero. Last successful refresh: " + (lastSuccess ? new Date(lastSuccess).toISOString() : "none") + ".");
      if ($("liveRungRows")) $("liveRungRows").textContent = "Live rung state unavailable.";
    } finally { busy = false; $("refreshMainnet").disabled = false; }
  }
  $("refreshMainnet").addEventListener("click", refresh);
  setInterval(() => { if (!document.hidden) refresh(); }, 30_000);
  setInterval(() => {
    if (lastSuccess && Date.now() - lastSuccess > 90_000) unavailable("Mainnet status is stale. Refresh before making decisions.");
  }, 15_000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  refresh();
}
