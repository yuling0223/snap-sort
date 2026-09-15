"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const CATEGORY_LINKS = [
  { slug: "all", label: "📄 全部紀錄" },
  { slug: "receipt", label: "🧾 收據 / 發票" },
  { slug: "whiteboard", label: "📝 待辦清單" },
  { slug: "product", label: "🛍️ 商品願望清單" },
  { slug: "handwritten_note", label: "📓 筆記" },
  { slug: "other", label: "📁 其他" },
];

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [searchingProduct, setSearchingProduct] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("receipt");
  const [data, setData] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 圖片自動壓縮引擎 (解決 413 錯誤與 AI 崩潰問題)
  const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.8);
        resolve(compressedBase64);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setData(null);

    const compressedBase64 = await compressImage(file);
    setPreview(compressedBase64);
  };

  // 商品欄位是否有空格需要上網補齊
  const isProductIncomplete = (result) => {
    const emptyFeatures = !Array.isArray(result.features) || result.features.length === 0;
    return !result.brand || !result.product_name || result.price === "" || result.price === null || emptyFeatures;
  };

  // 呼叫線上搜尋 API，只填補目前是空的欄位，不覆蓋 AI 已從圖片辨識出的內容
  const fillProductInfoFromWeb = async (result) => {
    try {
      const response = await fetch("/api/search-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.title,
          brand: result.brand,
          product_name: result.product_name,
        }),
      });
      const webInfo = await response.json();

      return {
        ...result,
        brand: result.brand || webInfo.brand || "",
        product_name: result.product_name || webInfo.product_name || "",
        price: (result.price === "" || result.price === null) ? (webInfo.price ?? "") : result.price,
        features: (Array.isArray(result.features) && result.features.length > 0) ? result.features : (webInfo.features || []),
      };
    } catch (error) {
      console.error("線上搜尋商品資訊失敗:", error);
      // 搜尋失敗就維持原本的空格，不擋住使用者
      return result;
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !preview) {
      alert("請先選擇照片！");
      return;
    }

    setLoading(true);
    setData(null);

    try {
      const base64Data = preview.split(",")[1];
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64Image: base64Data,
          mimeType: "image/jpeg",
          targetCategory: selectedCategory,
        }),
      });
      const result = await response.json();

      let finalData = {
        category: selectedCategory,
        title: result.title || "",
        summary: result.summary || "",
        full_text: result.full_text || "",
        merchant: result.merchant || "",
        date: result.date || "",
        total_amount: result.total_amount ?? "",
        items: result.items || [],
        brand: result.brand || "",
        product_name: result.product_name || "",
        price: result.price ?? "",
        features: result.features || [],
        tasks: result.tasks || [],
      };

      setLoading(false);

      // 若為商品分類且有欄位是空的，上網搜尋補齊
      if (selectedCategory === "product" && isProductIncomplete(finalData)) {
        setSearchingProduct(true);
        finalData = await fillProductInfoFromWeb(finalData);
        setSearchingProduct(false);
      }

      setData(finalData);
    } catch (error) {
      console.error("前端解析錯誤:", error);
      alert("解析發生錯誤，請手動填寫欄位");
      setData({
        category: selectedCategory,
        title: "",
        summary: "",
        full_text: "",
        items: [],
        features: [],
        tasks: [],
      });
    } finally {
      setLoading(false);
      setSearchingProduct(false);
    }
  };

  // 將 base64 圖片轉為可上傳的 Blob
  const base64ToBlob = (base64, mime) => {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
  };

  // 上傳圖片到 Supabase Storage，回傳公開網址
  const uploadImage = async (category) => {
    if (!preview) return "";
    const base64Data = preview.split(",")[1];
    const blob = base64ToBlob(base64Data, "image/jpeg");
    const fileName = `${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("snapsort-images")
      .upload(fileName, blob, { contentType: "image/jpeg" });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("snapsort-images").getPublicUrl(fileName);
    return urlData?.publicUrl || "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const imageUrl = await uploadImage(data.category);

      let tableName = "";
      let insertData = { image_url: imageUrl };

      if (data.category === "receipt") {
        tableName = "receipts";
        insertData = {
          ...insertData,
          title: data.title,
          date: data.date,
          merchant: data.merchant,
          total_amount: Number(data.total_amount) || 0,
          items: data.items,
        };
      } else if (data.category === "whiteboard") {
        tableName = "whiteboard_tasks";
        insertData = {
          ...insertData,
          title: data.title,
          tasks: data.tasks,
        };
      } else if (data.category === "handwritten_note" || data.category === "other") {
        tableName = "handwritten_notes";
        insertData = {
          ...insertData,
          category: data.category,
          title: data.title,
          summary: data.summary,
          full_text: data.full_text,
        };
      } else if (data.category === "product") {
        tableName = "product_wishlist";
        insertData = {
          ...insertData,
          brand: data.brand,
          product_name: data.product_name,
          price: Number(data.price) || 0,
          features: data.features,
        };
      }

      const { error } = await supabase.from(tableName).insert([insertData]);
      if (error) throw error;

      alert("儲存成功！");
      setData(null);
      setPreview(null);
      setSelectedFile(null);
    } catch (error) {
      alert("儲存失敗：" + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans relative flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="開啟專案資料夾"
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-lg leading-none transition"
        >
          ☰
        </button>
        <h1 className="text-lg font-bold text-gray-900">SnapSort 📸</h1>
        <div className="w-9"></div>
      </header>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          ></div>

          <div className="relative w-72 bg-white h-full shadow-2xl z-10 flex flex-col p-5 transform transition-transform duration-300">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
              <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">☰ 專案資料夾</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500 font-bold px-2"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <div className="font-semibold text-gray-500 uppercase text-xs tracking-wider">我的分類</div>
              <ul className="space-y-1">
                {CATEGORY_LINKS.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/folder/${item.slug}`}
                      onClick={() => setSidebarOpen(false)}
                      className="block p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-3">
          <label className="block text-sm font-semibold text-gray-800">1. 選擇或拍攝照片</label>
          <input
            type="file" accept="image/*"
            onChange={handleImageSelect}
            className="block w-full border border-gray-300 p-2.5 rounded-xl bg-gray-50 text-black text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer"
          />
        </div>

        {preview && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <img src={preview} alt="預覽" className="w-full h-auto object-contain rounded-xl border bg-black/5 max-h-80 mx-auto" />

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1">2. 選擇這份資料的類別</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl bg-white text-black font-medium focus:ring-2 focus:ring-black focus:outline-none"
              >
                <option value="receipt">收據 / 發票</option>
                <option value="whiteboard">待辦清單</option>
                <option value="product">商品</option>
                <option value="handwritten_note">筆記</option>
                <option value="other">其他</option>
              </select>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl hover:bg-blue-700 transition font-semibold shadow-md flex items-center justify-center disabled:opacity-50"
            >
              {loading ? "✨ AI 深度分析中..." : "✨ 開始 AI 分析"}
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-blue-600 font-medium mt-2">圖片已壓縮，AI 正在超速辨識中...</p>
          </div>
        )}

        {searchingProduct && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent"></div>
            <p className="text-purple-600 font-medium mt-2">部分欄位辨識不到，正在上網搜尋商品資訊...</p>
          </div>
        )}

        {data && !loading && !searchingProduct && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 border-b pb-2">3. 確認與編輯萃取結果</h2>

            {data.category !== "product" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">標題</label>
                <input
                  type="text"
                  placeholder="請輸入標題..."
                  value={data.title || ""}
                  onChange={e => setData({...data, title: e.target.value})}
                  className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            )}

            {data.category === "receipt" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">商家名稱</label>
                  <input type="text" placeholder="例：全聯福利中心" value={data.merchant || ""} onChange={e => setData({...data, merchant: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">日期</label>
                  <input type="date" value={data.date || ""} onChange={e => setData({...data, date: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">總金額</label>
                  <input type="number" placeholder="0" value={data.total_amount ?? ""} onChange={e => setData({...data, total_amount: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            )}

            {data.category === "whiteboard" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">待辦事項 (每行一項)</label>
                <textarea placeholder="輸入待辦項目..." value={(data.tasks || []).join("\n")} onChange={e => setData({...data, tasks: e.target.value.split("\n")})} className="w-full p-3 border border-gray-300 rounded-xl h-32 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
            )}

            {(data.category === "handwritten_note" || data.category === "other") && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">摘要</label>
                  <input type="text" placeholder="簡單摘要..." value={data.summary || ""} onChange={e => setData({...data, summary: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">完整內容</label>
                  <textarea placeholder="完整文字內容..." value={data.full_text || ""} onChange={e => setData({...data, full_text: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl h-40 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            )}

            {data.category === "product" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">品牌</label>
                  <input type="text" placeholder="品牌名稱" value={data.brand || ""} onChange={e => setData({...data, brand: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">商品名稱</label>
                  <input type="text" placeholder="商品名稱" value={data.product_name || ""} onChange={e => setData({...data, product_name: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">價格</label>
                  <input type="number" placeholder="0" value={data.price ?? ""} onChange={e => setData({...data, price: e.target.value})} className="w-full p-3 border border-gray-300 rounded-xl text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">特色 (每行一項)</label>
                  <textarea placeholder="輸入商品特色..." value={(data.features || []).join("\n")} onChange={e => setData({...data, features: e.target.value.split("\n")})} className="w-full p-3 border border-gray-300 rounded-xl h-28 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black" />
                </div>
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 w-full bg-black text-white py-3.5 rounded-xl hover:bg-gray-800 transition font-semibold shadow-md disabled:opacity-50"
            >
              {saving ? "儲存中..." : "確認無誤並儲存至資料庫"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}