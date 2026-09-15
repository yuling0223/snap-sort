"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [data, setData] = useState(null);

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
      setData(result);
    } catch (error) {
      alert("解析發生錯誤");
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
        insertData = { date: data.date, merchant: data.merchant, total_amount: Number(data.total_amount), items: data.items };
      } else if (data.category === "whiteboard") {
        tableName = "whiteboard_tasks";
        insertData = { title: data.title, tasks: data.tasks };
      } else if (data.category === "handwritten_note") {
        tableName = "handwritten_notes";
        insertData = { title: data.title, summary: data.summary, full_text: data.full_text };
      } else if (data.category === "product") {
        tableName = "product_wishlist";
        insertData = { brand: data.brand, product_name: data.product_name, price: Number(data.price), features: data.features };
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

  // 處理收據明細修改
  const updateReceiptItem = (index, field, value) => {
    const newItems = [...data.items];
    newItems[index][field] = field === "price" ? Number(value) : value;
    setData({ ...data, items: newItems });
  };

  return (
    <main className="max-w-md mx-auto p-6 font-sans">
      <h1 className="text-2xl font-bold mb-6">Prism 筆記萃取器</h1>
      
      <input 
        type="file" accept="image/*" capture="environment"
        onChange={handleImageUpload} 
        className="mb-4 block w-full border border-gray-300 p-2 rounded"
      />

      {loading && <p className="text-blue-500 animate-pulse mb-4">AI 正在努力辨識中...</p>}
      {preview && <img src={preview} alt="預覽" className="w-full h-48 object-cover rounded mb-6 shadow-sm" />}

      {data && (
        <div className="bg-gray-50 p-4 rounded-lg shadow border border-gray-200">
          <h2 className="text-lg font-semibold mb-4 border-b pb-2">
            類別：{data.category}
          </h2>

          {/* 收據表單 */}
          {data.category === "receipt" && (
            <div className="space-y-3">
              <input type="text" placeholder="商家名稱" value={data.merchant || ""} onChange={e => setData({...data, merchant: e.target.value})} className="w-full p-2 border rounded" />
              <input type="date" value={data.date || ""} onChange={e => setData({...data, date: e.target.value})} className="w-full p-2 border rounded" />
              <input type="number" placeholder="總金額" value={data.total_amount || ""} onChange={e => setData({...data, total_amount: e.target.value})} className="w-full p-2 border rounded" />
              
              <h3 className="text-sm font-semibold mt-4">明細核對</h3>
              {data.items?.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <input type="text" value={item.item_name} onChange={e => updateReceiptItem(idx, "item_name", e.target.value)} className="w-2/3 p-2 border rounded text-sm" />
                  <input type="number" value={item.price} onChange={e => updateReceiptItem(idx, "price", e.target.value)} className="w-1/3 p-2 border rounded text-sm" />
                </div>
              ))}
            </div>
          )}

          {/* 白板任務表單 */}
          {data.category === "whiteboard" && (
            <div className="space-y-3">
              <input type="text" placeholder="標題" value={data.title || ""} onChange={e => setData({...data, title: e.target.value})} className="w-full p-2 border rounded" />
              <textarea placeholder="待辦事項 (換行分隔)" value={(data.tasks || []).join("\n")} onChange={e => setData({...data, tasks: e.target.value.split("\n")})} className="w-full p-2 border rounded h-32" />
            </div>
          )}

          {/* 手寫筆記表單 */}
          {data.category === "handwritten_note" && (
            <div className="space-y-3">
              <input type="text" placeholder="標題" value={data.title || ""} onChange={e => setData({...data, title: e.target.value})} className="w-full p-2 border rounded" />
              <textarea placeholder="摘要" value={data.summary || ""} onChange={e => setData({...data, summary: e.target.value})} className="w-full p-2 border rounded h-20" />
              <textarea placeholder="完整文字" value={data.full_text || ""} onChange={e => setData({...data, full_text: e.target.value})} className="w-full p-2 border rounded h-40" />
            </div>
          )}

          {/* 商品紀錄表單 */}
          {data.category === "product" && (
            <div className="space-y-3">
              <input type="text" placeholder="品牌" value={data.brand || ""} onChange={e => setData({...data, brand: e.target.value})} className="w-full p-2 border rounded" />
              <input type="text" placeholder="商品名稱" value={data.product_name || ""} onChange={e => setData({...data, product_name: e.target.value})} className="w-full p-2 border rounded" />
              <input type="number" placeholder="價格" value={data.price || ""} onChange={e => setData({...data, price: e.target.value})} className="w-full p-2 border rounded" />
              <textarea placeholder="特色 (換行分隔)" value={(data.features || []).join("\n")} onChange={e => setData({...data, features: e.target.value.split("\n")})} className="w-full p-2 border rounded h-24" />
            </div>
          )}

          <button onClick={handleSave} className="mt-6 w-full bg-black text-white py-2 rounded-lg hover:bg-gray-800 transition">
            確認無誤並儲存
          </button>
        </div>
      )}
    </main>
  );
}