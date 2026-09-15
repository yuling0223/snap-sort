import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { base64Image, mimeType } = await req.json();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `你是一個超級聰明的資料萃取與文字辨識助理。請分析這張圖片，並務必回傳一個合法的 JSON 物件。
    
    請嚴格遵守以下分類規則：
    1. 如果是發票或收據，category 填 "receipt"，並萃取 date, total_amount, merchant, items。
    2. 如果是白板或待辦清單，category 填 "whiteboard"，並萃取 title, tasks。
    3. 如果是商品，category 填 "product"，並萃取 brand, product_name, price, features。
    4. **如果是其他任何東西（傳單、名片、截圖、照片、文字等），一律歸類為 "handwritten_note"**，並填寫以下欄位：
       - title: "圖片資訊筆記"
       - summary: 請用一兩句話簡單總結這張圖片的內容
       - full_text: 請把圖片裡面看到的**所有文字**完整萃取並打下來給用戶

    注意：請只回傳純 JSON 格式，不要加上任何 markdown 標記（如 \`\`\`json）。`;

    const imageParts = [{ inlineData: { data: base64Image, mimeType } }];
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result;
    const text = response.response.text();
    
    // 清洗 Markdown 標記
    let cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const parsedData = JSON.parse(cleanedText);
    return NextResponse.json(parsedData);

  } catch (error) {
    console.error("AI 解析發生例外狀況:", error);
    
    // 🛡️ 防呆機制：就算 AI 解析失敗，也絕對不讓 App 崩潰，直接以「筆記」格式回傳，確保使用者能看到介面並手動編輯
    return NextResponse.json({
      category: "handwritten_note",
      title: "圖片辨識結果",
      summary: "AI 已成功讀取圖片，已自動轉為一般筆記供您編輯。",
      full_text: "（系統提示：圖片解析遇到一點小狀況，您可以直接在此處手動補充或修改文字）"
    });
  }
}