import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { base64Image, mimeType, targetCategory } = await req.json();
    
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    // 針對使用者指定的分類，給予高度針對性且嚴謹的 AI 萃取指引
    const prompt = `你是一個頂尖的 AI 智能文字萃取與結構化專家。
    使用者上傳了一張圖片，並指定該圖片的分類為: "${targetCategory}"。
    請根據此分類進行高精度的資訊萃取，並嚴格回傳合法的 JSON 格式。找不到的欄位請填空字串 "" 或 null，絕不虛構資料。

    【各分類萃取標準】：
    1. 若 targetCategory 為 "receipt" (收據/發票):
       - title (字串): 依商家與用途生成標題，例如「某某店鋪消費收據」
       - merchant (字串): 確實的商家、店鋪或公司名稱
       - date (字串): 格式必須為 YYYY-MM-DD (若無年份請推測或留空)
       - total_amount (數字): 總消費金額數字
       - items (陣列): 抓取明細品項，每項包含 item_name 與 price
    
    2. 若 targetCategory 為 "whiteboard" (待辦清單):
       - title (字串): 該清單的主題或標題
       - tasks (字串陣列): 將圖中所有待辦事項、勾選項或條列項目逐行完整萃取出來

    3. 若 targetCategory 為 "product" (商品):
       - title (字串): 商品標題
       - brand (字串): 品牌名稱
       - product_name (字串): 商品名稱或型號
       - price (數字): 標示價格
       - features (字串陣列): 商品特色或規格說明

    4. 若 targetCategory 為 "handwritten_note" (筆記) 或 "other" (其他):
       - title (字串): 為此張圖片下一個精準的標題
       - summary (字串): 核心內容的一句話摘要
       - full_text (字串): **最重要**：請將圖中所有看得到的文字、段落、傳單資訊，完整且不遺漏地轉成文字排版打下來

    請確保回傳的 JSON 完整包含上述對應欄位。`;

    const imageParts = [{ inlineData: { data: base64Image, mimeType } }];
    const result = model.generateContent([prompt, ...imageParts]);
    const response = await result;
    const text = response.response.text();
    
    const parsedData = JSON.parse(text);
    return NextResponse.json(parsedData);

  } catch (error) {
    console.error("AI 解析發生例外狀況:", error);
    
    return NextResponse.json({
      title: "",
      summary: "",
      full_text: "",
      merchant: "",
      date: "",
      total_amount: "",
      items: [],
      brand: "",
      product_name: "",
      price: "",
      features: [],
      tasks: []
    });
  }
}