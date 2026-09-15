"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [data, setData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setData(null);
    const base64String = await toBase64(file);
    setPreview(base64String);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Image: base64String.split(",")[1],
          mimeType: file.type
        })
      });
      const result = await response.json();
      
      setData({
        category: result.category || "handwritten_note",
        title: result.title || "",
        summary: result.summary || "",
        full_text: result.full_text || "",
        merchant: result.merchant || "",
        date: result.date || "",
        total_amount: result.total_amount || "",
        items: result.items || [],
        brand: result.brand || "",
        product_name: result.product_name || "",
        price: result.price || "",
        features: result.features || [],
        tasks: result.tasks || []
      });
    } catch (error) {
      alert("解析發生錯誤，請手動填寫");
      setData({
        category: "handwritten_note",
        title: "",
        summary: "",
        full_text: "",
        items: [],
        features: [],
        tasks: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      let tableName = "";
      let insertData = {};

      if (data.category === "receipt") {
        tableName = "receipts";
        insertData = { date: data.date, merchant: data.merchant, total_amount: Number(data.total_amount) || 0, items: data.items };
      } else if (data.category === "whiteboard") {
        tableName = "whiteboard_tasks";
        insertData = { title: data.title, tasks: data.tasks };
      } else if (data.category === "handwritten_note" || data.category === "other") {
        tableName = "handwritten_notes";
        insertData = { title: data.title, summary: data.summary, full_text: data.full_text };
      } else if (data.category === "product") {
        tableName = "product_wishlist";
        insertData = { brand: data.brand, product_name: data.product_name, price: Number(data.price) || 0, features: data.features };
      }

      const { error } = await supabase.from(tableName).insert([insertData]);
      if (error) throw error;
      
      alert("儲存成功！");
      setData(null);
      setPreview(null);
    } catch (error) {
      alert("儲存失敗：" + error.message);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans">
      {/* 左列資料夾選單（依照新排序） */}
      <aside className={`${sidebarOpen ? "w-64" : "w-16"} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {sidebarOpen && <span className="font-bold text-lg text-gray-800">📂 專案資料夾</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-gray-100 text-gray-600">
            {sidebarOpen ? "◀" : "▶"}
          </button>
        </div>
        {sidebarOpen && (
          <div className="p-4 space-y-3 text-sm text-gray-600">
            <div className="font-semibold text-gray-700">我的分類</div>
            <ul className="space-y-2 pl-2">
              <li className="cursor-pointer hover:text-black">📄 全部紀錄</li>
              <li className="cursor-pointer hover:text-black">🧾 收據 / 發票</li>
              <li className="cursor-pointer hover:text-black">📝 待辦清單</li>
              <li className="cursor-pointer hover:text-black">🛍️ 商品願望清單</li>
              <li className="cursor-pointer hover:text-black">📓 筆記</li>
              <li className="cursor-pointer hover:text-black">📁 其他</li>
            </ul>
          </div>
        )}
      </aside>

      {/* 主畫面 */}
      <main className="flex-1 max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-900">SnapSort 筆記萃取器 📸</h1>
        
        <input 
          type="file" accept="image/*"
          onChange={handleImageUpload} 
          className="mb-4 block w-full border border-gray-300 p-2 rounded bg-white text-black text-sm"
        />

        {loading && <p className="text-blue-500 animate-pulse mb-4">AI 正在努力辨識中...</p>}
        {preview && <img src={preview} alt="預覽" className="w-full h-auto object-contain rounded mb-6 shadow-sm border bg-black/5" />}

        {data && (
          <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200 space-y-4">
            
            {/* 分類下拉選單（依照你指定的順序排列） */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">資料分類</label>
              <select 
                value={data.category} 
                onChange={(e) => setData({ ...data, category: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg bg-white text-black font-medium focus:ring-2 focus:ring-black focus:outline-none"
              >
                <option value="receipt">收據 / 發票</option>
                <option value="whiteboard">待辦清單</option>
                <option value="product">商品</option>
                <option value="handwritten_note">筆記</option>
                <option value="other">其他</option>
              </select>
            </div>

            {/* 標題欄位 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">標題</label>
              <input 
                type="text" 
                placeholder="請輸入標題..." 
                value={data.title || ""} 
                onChange={e => setData({...data, title: e.target.value})} 
                className="w-full p-2.5 border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" 
              />
            </div>

            {/* 收據表單 */}
            {data.category === "receipt" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">商家名稱</label>
                  <input type="text" placeholder="例：全聯福利中心" value={data.merchant || ""} onChange={e => setData({...data, merchant: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">日期</label>
                  <input type="date" value={data.date || ""} onChange={e => setData({...data, date: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">總金額</label>
                  <input type="number" placeholder="0" value={data.total_amount || ""} onChange={e => setData({...data, total_amount: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            )}

            {/* 待辦清單表單 */}
            {data.category === "whiteboard" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">待辦事項 (每行一項)</label>
                <textarea placeholder="輸入待辦項目..." value={(data.tasks || []).join("\n")} onChange={e => setData({...data, tasks: e.target.value.split("\n")})} className="w-full p-2.5 border border-gray-300 rounded-lg h-32 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
            )}

            {/* 筆記與其他表單 */}
            {(data.category === "handwritten_note" || data.category === "other") && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">摘要</label>
                  <input type="text" placeholder="簡單摘要..." value={data.summary || ""} onChange={e => setData({...data, summary: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">完整內容</label>
                  <textarea placeholder="完整文字內容..." value={data.full_text || ""} onChange={e => setData({...data, full_text: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg h-40 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            )}

            {/* 商品表單 */}
            {data.category === "product" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">品牌</label>
                  <input type="text" placeholder="品牌名稱" value={data.brand || ""} onChange={e => setData({...data, brand: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">商品名稱</label>
                  <input type="text" placeholder="商品名稱" value={data.product_name || ""} onChange={e => setData({...data, product_name: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">價格</label>
                  <input type="number" placeholder="0" value={data.price || ""} onChange={e => setData({...data, price: e.target.value})} className="w-full p-2.5 border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            )}

            <button onClick={handleSave} className="mt-4 w-full bg-black text-white py-3 rounded-xl hover:bg-gray-800 transition font-medium shadow">
              確認無誤並儲存
            </button>
          </div>
        )}
      </main>
    </div>
  );
}