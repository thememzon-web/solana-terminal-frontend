import { useEffect, useState } from "react";

const API_BASE = "https://solana-terminal-backend-s0v8.onrender.com";

export default function App() {
  const [pairs, setPairs] = useState([]);
  const [status, setStatus] = useState("Loading...");

  async function loadData() {
    try {
      const health = await fetch(API_BASE + "/api/health").then(r => r.json());
      setStatus(health.degraded ? "Degraded" : "Live");

      const data = await fetch(API_BASE + "/api/new-pairs?limit=30").then(r => r.json());
      setPairs(data.pairs || []);
    } catch {
      setStatus("Error");
    }
  }

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 15000); // ogni 15 secondi
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ background: "#0b0b0f", minHeight: "100vh", color: "white", padding: 20 }}>
      <h1>Solana Memecoin Terminal</h1>
      <p>Status: <b>{status}</b></p>

      <table style={{ width: "100%", marginTop: 20, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #222", textAlign: "left" }}>
            <th style={{ padding: 8 }}>Token</th>
            <th style={{ padding: 8 }}>Price</th>
            <th style={{ padding: 8 }}>Liquidity</th>
            <th style={{ padding: 8 }}>Link</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map(p => (
            <tr key={p.pairAddress} style={{ borderBottom: "1px solid #161616" }}>
              <td style={{ padding: 8 }}>
                <b>{p.baseToken?.symbol}</b>{" "}
                <span style={{ color: "#777" }}>{p.baseToken?.name}</span>
              </td>
              <td style={{ padding: 8 }}>${p.priceUsd ?? "-"}</td>
              <td style={{ padding: 8 }}>
                ${Math.round(p.liquidityUsd || 0).toLocaleString()}
              </td>
              <td style={{ padding: 8 }}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#6aa7ff" }}
                >
                  Dexscreener
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
