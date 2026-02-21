import { useState, useEffect, useRef } from "react";

const CATEGORIES = ["เครื่องเขียน", "กระดาษ/แฟ้ม", "อุปกรณ์คอมพิวเตอร์", "อุปกรณ์สำนักงาน", "อื่นๆ"];

const UNIT_OPTIONS = ["ชิ้น", "อัน", "กล่อง", "แพ็ค", "ม้วน", "รีม", "โหล", "ชุด"];

const LOW_STOCK_THRESHOLD = 5;

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Badge({ children, color }) {
  const colors = {
    green: { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" },
    yellow: { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
    red: { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
    blue: { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
    gray: { bg: "#f3f4f6", text: "#374151", border: "#d1d5db" },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("stock"); // stock | log | add
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("ทั้งหมด");
  const [txModal, setTxModal] = useState(null); // { itemId, type: 'in'|'out' }
  const [txQty, setTxQty] = useState("");
  const [txNote, setTxNote] = useState("");
  const [txBy, setTxBy] = useState("");
  const [addForm, setAddForm] = useState({ name: "", category: CATEGORIES[0], unit: UNIT_OPTIONS[0], minStock: "5", initQty: "0" });
  const [toast, setToast] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const saveTimeout = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        window.storage.get("inv_items", true).catch(() => null),
        window.storage.get("inv_tx", true).catch(() => null),
      ]);
      if (r1) setItems(JSON.parse(r1.value));
      if (r2) setTransactions(JSON.parse(r2.value));
    } catch (e) {}
    setLoading(false);
  };

  const saveData = async (newItems, newTx) => {
    setSaving(true);
    try {
      await Promise.all([
        window.storage.set("inv_items", JSON.stringify(newItems), true),
        window.storage.set("inv_tx", JSON.stringify(newTx), true),
      ]);
    } catch (e) {}
    setSaving(false);
  };

  useEffect(() => { loadData(); }, []);

  const persistSave = (newItems, newTx) => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => saveData(newItems, newTx), 500);
  };

  const handleAddItem = () => {
    if (!addForm.name.trim()) return showToast("กรุณาระบุชื่ออุปกรณ์", "error");
    const now = new Date().toISOString();
    const newItem = {
      id: Date.now().toString(),
      name: addForm.name.trim(),
      category: addForm.category,
      unit: addForm.unit,
      qty: parseInt(addForm.initQty) || 0,
      minStock: parseInt(addForm.minStock) || 5,
      createdAt: now,
    };
    const newItems = [...items, newItem];
    let newTx = transactions;
    if (newItem.qty > 0) {
      newTx = [{ id: Date.now().toString(), itemId: newItem.id, type: "in", qty: newItem.qty, note: "สต็อกเริ่มต้น", by: "ระบบ", date: now }, ...transactions];
    }
    setItems(newItems);
    setTransactions(newTx);
    persistSave(newItems, newTx);
    setAddForm({ name: "", category: CATEGORIES[0], unit: UNIT_OPTIONS[0], minStock: "5", initQty: "0" });
    showToast(`เพิ่ม "${newItem.name}" สำเร็จ`);
    setTab("stock");
  };

  const handleTx = () => {
    if (!txQty || parseInt(txQty) <= 0) return showToast("กรุณาระบุจำนวนที่ถูกต้อง", "error");
    const qty = parseInt(txQty);
    const item = items.find(i => i.id === txModal.itemId);
    if (txModal.type === "out" && qty > item.qty) return showToast("จำนวนมากกว่าสต็อกที่มี", "error");
    const now = new Date().toISOString();
    const newTx = { id: Date.now().toString(), itemId: txModal.itemId, type: txModal.type, qty, note: txNote, by: txBy || "ไม่ระบุ", date: now };
    const newItems = items.map(i => i.id === txModal.itemId ? { ...i, qty: txModal.type === "in" ? i.qty + qty : i.qty - qty } : i);
    const newTxList = [newTx, ...transactions];
    setItems(newItems);
    setTransactions(newTxList);
    persistSave(newItems, newTxList);
    showToast(`${txModal.type === "in" ? "รับเข้า" : "เบิกจ่าย"} "${item.name}" จำนวน ${qty} ${item.unit} สำเร็จ`);
    setTxModal(null); setTxQty(""); setTxNote(""); setTxBy("");
  };

  const handleDeleteItem = (id) => {
    const newItems = items.filter(i => i.id !== id);
    const newTx = transactions.filter(t => t.itemId !== id);
    setItems(newItems); setTransactions(newTx);
    persistSave(newItems, newTx);
    showToast("ลบรายการสำเร็จ");
  };

  const handleUpdateItem = () => {
    const newItems = items.map(i => i.id === editItem.id ? editItem : i);
    setItems(newItems);
    persistSave(newItems, transactions);
    setEditItem(null);
    showToast("แก้ไขรายการสำเร็จ");
  };

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "ทั้งหมด" || i.category === filterCat;
    return matchSearch && matchCat;
  });

  const lowCount = items.filter(i => i.qty <= i.minStock).length;
  const totalItems = items.length;
  const totalIn = transactions.filter(t => t.type === "in").reduce((s, t) => s + t.qty, 0);
  const totalOut = transactions.filter(t => t.type === "out").reduce((s, t) => s + t.qty, 0);

  const getStockStatus = (item) => {
    if (item.qty === 0) return { label: "หมด", color: "red" };
    if (item.qty <= item.minStock) return { label: "ใกล้หมด", color: "yellow" };
    return { label: "ปกติ", color: "green" };
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "'Noto Sans Thai', sans-serif", fontSize: 18 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, border: "4px solid #334155", borderTop: "4px solid #38bdf8", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
        กำลังโหลดข้อมูล...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "'Noto Sans Thai', 'Sarabun', sans-serif", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #1e293b; } ::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }
        input, select, textarea { outline: none; }
        button { cursor: pointer; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(-10px); } to { opacity:1; transform:translateX(0); } }
        .row-hover:hover { background: #1e293b !important; transition: background 0.15s; }
        .btn-hover:hover { filter: brightness(1.1); transform: translateY(-1px); transition: all 0.15s; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; }
        .tab { padding: 8px 20px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; transition: all 0.2s; }
        .tab-active { background: #38bdf8; color: #0f172a; }
        .tab-inactive { background: transparent; color: #94a3b8; }
        .tab-inactive:hover { color: #e2e8f0; background: #1e293b; }
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", borderBottom: "1px solid #334155", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, background: "linear-gradient(135deg, #38bdf8, #818cf8)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📦</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>ระบบจัดการสต็อกอุปกรณ์</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Office Inventory · บันทึกถาวร · แชร์หลายคนได้</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {saving && <span style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, background: "#f59e0b", borderRadius: "50%", display: "inline-block", animation: "spin 1s linear infinite" }} />บันทึก...</span>}
          {lowCount > 0 && <Badge color="red">⚠ ใกล้หมด {lowCount} รายการ</Badge>}
          <button onClick={() => setTab("add")} className="btn-hover" style={{ background: "linear-gradient(135deg, #38bdf8, #818cf8)", color: "#0f172a", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 14, fontWeight: 700 }}>+ เพิ่มรายการ</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: "20px 24px 0", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "รายการทั้งหมด", value: totalItems, icon: "📋", color: "#38bdf8" },
          { label: "ใกล้หมด/หมด", value: lowCount, icon: "⚠️", color: "#f59e0b" },
          { label: "รับเข้าทั้งหมด", value: totalIn.toLocaleString(), icon: "📥", color: "#34d399" },
          { label: "เบิกจ่ายทั้งหมด", value: totalOut.toLocaleString(), icon: "📤", color: "#f472b6" },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: "14px 18px", animation: `fadeIn 0.3s ease ${i * 0.05}s both` }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ padding: "16px 24px 0", display: "flex", gap: 8 }}>
        {[["stock", "📦 สต็อกอุปกรณ์"], ["log", "📜 ประวัติการเคลื่อนไหว"], ["add", "➕ เพิ่มรายการใหม่"]].map(([key, label]) => (
          <button key={key} className={`tab ${tab === key ? "tab-active" : "tab-inactive"}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "16px 24px" }}>

        {/* STOCK TAB */}
        {tab === "stock" && (
          <div style={{ animation: "fadeIn 0.25s ease" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาชื่ออุปกรณ์..." style={{ flex: 1, background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }} />
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }}>
                <option value="ทั้งหมด">ทุกหมวดหมู่</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: "center", color: "#475569" }}>
                <div style={{ fontSize: 48 }}>📭</div>
                <div style={{ marginTop: 8 }}>{search || filterCat !== "ทั้งหมด" ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีรายการ กดเพิ่มรายการใหม่"}</div>
              </div>
            ) : (
              <div className="card" style={{ overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
                      {["ชื่ออุปกรณ์", "หมวดหมู่", "คงเหลือ", "จุดสั่งซื้อ", "สถานะ", "จัดการ"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => {
                      const status = getStockStatus(item);
                      const itemTx = transactions.filter(t => t.itemId === item.id);
                      return (
                        <tr key={item.id} className="row-hover" style={{ borderBottom: "1px solid #1e293b", animation: `slideIn 0.2s ease ${idx * 0.03}s both` }}>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ fontWeight: 600, color: "#f1f5f9" }}>{item.name}</div>
                            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                              {itemTx.length > 0 ? `ล่าสุด: ${formatDate(itemTx[0].date)}` : "ยังไม่มีการเคลื่อนไหว"}
                            </div>
                          </td>
                          <td style={{ padding: "14px 16px" }}><Badge color="blue">{item.category}</Badge></td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ fontSize: 22, fontWeight: 700, color: item.qty === 0 ? "#ef4444" : item.qty <= item.minStock ? "#f59e0b" : "#34d399" }}>{item.qty}</span>
                            <span style={{ fontSize: 13, color: "#64748b", marginLeft: 4 }}>{item.unit}</span>
                          </td>
                          <td style={{ padding: "14px 16px", color: "#94a3b8" }}>{item.minStock} {item.unit}</td>
                          <td style={{ padding: "14px 16px" }}><Badge color={status.color}>{status.label}</Badge></td>
                          <td style={{ padding: "14px 16px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => { setTxModal({ itemId: item.id, type: "in" }); }} className="btn-hover" style={{ background: "#064e3b", color: "#34d399", border: "1px solid #065f46", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>📥 รับเข้า</button>
                              <button onClick={() => { setTxModal({ itemId: item.id, type: "out" }); }} className="btn-hover" style={{ background: "#4c0519", color: "#f472b6", border: "1px solid #881337", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>📤 เบิกจ่าย</button>
                              <button onClick={() => setEditItem({ ...item })} className="btn-hover" style={{ background: "#1e3a5f", color: "#38bdf8", border: "1px solid #1e40af", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>✏️</button>
                              <button onClick={() => { if (confirm(`ลบ "${item.name}" ?`)) handleDeleteItem(item.id); }} className="btn-hover" style={{ background: "#1c1917", color: "#94a3b8", border: "1px solid #292524", borderRadius: 6, padding: "5px 10px", fontSize: 12 }}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* LOG TAB */}
        {tab === "log" && (
          <div style={{ animation: "fadeIn 0.25s ease" }}>
            {transactions.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: "center", color: "#475569" }}>
                <div style={{ fontSize: 48 }}>📋</div>
                <div style={{ marginTop: 8 }}>ยังไม่มีประวัติการเคลื่อนไหว</div>
              </div>
            ) : (
              <div className="card" style={{ overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#0f172a", borderBottom: "1px solid #334155" }}>
                      {["วันที่/เวลา", "รายการ", "ประเภท", "จำนวน", "โดย", "หมายเหตุ"].map(h => (
                        <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 200).map((tx, idx) => {
                      const item = items.find(i => i.id === tx.itemId);
                      return (
                        <tr key={tx.id} className="row-hover" style={{ borderBottom: "1px solid #1e293b", animation: `slideIn 0.2s ease ${idx * 0.02}s both` }}>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#94a3b8" }}>{formatDate(tx.date)}</td>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: "#f1f5f9" }}>{item ? item.name : <span style={{ color: "#475569" }}>ลบแล้ว</span>}</td>
                          <td style={{ padding: "12px 16px" }}>
                            <Badge color={tx.type === "in" ? "green" : "red"}>{tx.type === "in" ? "📥 รับเข้า" : "📤 เบิกจ่าย"}</Badge>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ fontWeight: 700, color: tx.type === "in" ? "#34d399" : "#f472b6", fontSize: 16 }}>
                              {tx.type === "in" ? "+" : "-"}{tx.qty}
                            </span>
                            <span style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>{item?.unit || ""}</span>
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#94a3b8" }}>{tx.by}</td>
                          <td style={{ padding: "12px 16px", fontSize: 13, color: "#64748b" }}>{tx.note || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ADD TAB */}
        {tab === "add" && (
          <div style={{ animation: "fadeIn 0.25s ease", maxWidth: 600 }}>
            <div className="card" style={{ padding: 28 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 24 }}>➕ เพิ่มรายการอุปกรณ์ใหม่</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>ชื่ออุปกรณ์ *</label>
                  <input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="เช่น ปากกาลูกลื่น, กระดาษ A4..." style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>หมวดหมู่</label>
                    <select value={addForm.category} onChange={e => setAddForm({ ...addForm, category: e.target.value })} style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>หน่วยนับ</label>
                    <select value={addForm.unit} onChange={e => setAddForm({ ...addForm, unit: e.target.value })} style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }}>
                      {UNIT_OPTIONS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>จำนวนเริ่มต้น</label>
                    <input type="number" min="0" value={addForm.initQty} onChange={e => setAddForm({ ...addForm, initQty: e.target.value })} style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>จุดแจ้งเตือน (ขั้นต่ำ)</label>
                    <input type="number" min="0" value={addForm.minStock} onChange={e => setAddForm({ ...addForm, minStock: e.target.value })} style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }} />
                  </div>
                </div>
                <button onClick={handleAddItem} className="btn-hover" style={{ background: "linear-gradient(135deg, #38bdf8, #818cf8)", color: "#0f172a", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 15, fontWeight: 700, marginTop: 8 }}>
                  ✅ เพิ่มรายการ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      {txModal && (() => {
        const item = items.find(i => i.id === txModal.itemId);
        if (!item) return null;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" }}>
            <div className="card" style={{ padding: 28, width: 400, animation: "fadeIn 0.2s ease" }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", marginBottom: 20 }}>
                {txModal.type === "in" ? "📥 รับสินค้าเข้า" : "📤 เบิกจ่ายสินค้า"}: {item.name}
              </div>
              <div style={{ background: "#0f172a", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14, color: "#94a3b8" }}>
                สต็อกปัจจุบัน: <span style={{ color: "#38bdf8", fontWeight: 700 }}>{item.qty} {item.unit}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>จำนวน ({item.unit}) *</label>
                  <input type="number" min="1" value={txQty} onChange={e => setTxQty(e.target.value)} autoFocus style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>ผู้ดำเนินการ</label>
                  <input value={txBy} onChange={e => setTxBy(e.target.value)} placeholder="ชื่อผู้รับ/จ่าย..." style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>หมายเหตุ</label>
                  <input value={txNote} onChange={e => setTxNote(e.target.value)} placeholder="เช่น สั่งซื้อจาก..., เบิกสำหรับ..." style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }} />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button onClick={() => { setTxModal(null); setTxQty(""); setTxNote(""); setTxBy(""); }} style={{ flex: 1, background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600 }}>ยกเลิก</button>
                  <button onClick={handleTx} className="btn-hover" style={{ flex: 2, background: txModal.type === "in" ? "linear-gradient(135deg, #059669, #34d399)" : "linear-gradient(135deg, #db2777, #f472b6)", color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700 }}>
                    {txModal.type === "in" ? "✅ บันทึกรับเข้า" : "✅ บันทึกเบิกจ่าย"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Modal */}
      {editItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)" }}>
          <div className="card" style={{ padding: 28, width: 400, animation: "fadeIn 0.2s ease" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", marginBottom: 20 }}>✏️ แก้ไขรายการ</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[["name", "ชื่ออุปกรณ์", "text"], ["minStock", "จุดแจ้งเตือน (ขั้นต่ำ)", "number"]].map(([key, label, type]) => (
                <div key={key}>
                  <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
                  <input type={type} value={editItem[key]} onChange={e => setEditItem({ ...editItem, [key]: type === "number" ? parseInt(e.target.value) || 0 : e.target.value })} style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>หมวดหมู่</label>
                <select value={editItem.category} onChange={e => setEditItem({ ...editItem, category: e.target.value })} style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, display: "block", marginBottom: 6 }}>หน่วยนับ</label>
                <select value={editItem.unit} onChange={e => setEditItem({ ...editItem, unit: e.target.value })} style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontSize: 14 }}>
                  {UNIT_OPTIONS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => setEditItem(null)} style={{ flex: 1, background: "#1e293b", color: "#94a3b8", border: "1px solid #334155", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600 }}>ยกเลิก</button>
                <button onClick={handleUpdateItem} className="btn-hover" style={{ flex: 2, background: "linear-gradient(135deg, #38bdf8, #818cf8)", color: "#0f172a", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 700 }}>✅ บันทึกการแก้ไข</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: toast.type === "error" ? "#7f1d1d" : "#064e3b", border: `1px solid ${toast.type === "error" ? "#b91c1c" : "#065f46"}`, color: toast.type === "error" ? "#fca5a5" : "#6ee7b7", padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600, zIndex: 200, animation: "fadeIn 0.2s ease", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          {toast.type === "error" ? "❌" : "✅"} {toast.msg}
        </div>
      )}
    </div>
  );
}