// =====================================================
// Gemini AI Service — Crop Disease Analysis & Chat
// Uses Google Gemini (free tier)
// =====================================================
import { CROP_KNOWLEDGE, AGRI_DEALERS } from "./agriKnowledge";
import { retrieveKb, formatKbContext } from "./kbRetrieval";
import { GEMINI_API_KEY } from "./geminiKey";
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Language code mapping for the system prompt
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi (हिन्दी)",
  od: "Odia (ଓଡ଼ିଆ)",
  bn: "Bengali (বাংলা)",
  te: "Telugu (తెలుగు)",
  ta: "Tamil (தமிழ்)",
  kn: "Kannada (ಕನ್ನಡ)",
  mr: "Marathi (मराठी)",
};

const SYSTEM_PROMPT = `You are AgriNexus AI — an expert agricultural advisor for Indian farmers.

CORE RULES:
1. When an IMAGE is provided, analyze it carefully for crop disease. Look for leaf spots, discoloration, yellowing, pest damage, fungal growth, bacterial lesions, or any abnormality. Name the likely disease, estimate severity (Low/Medium/High/Critical), and suggest both organic and chemical treatments.
2. When TEXT is provided, answer farming questions about crops, fertilizers, pesticides, weather, irrigation, storage, mandi prices, government schemes, or post-harvest processing.
3. ALWAYS respond ONLY in the language specified. Never mix languages. Never default to English unless English is selected.
4. Use simple, easy-to-understand vocabulary. The farmer may have limited formal education. Avoid technical jargon.
5. Keep replies to 3-5 sentences unless the farmer asks for more detail.
6. For disease diagnosis, always include: (a) disease name, (b) severity, (c) what causes it, (d) organic remedy, (e) chemical remedy if needed.
7. Be encouraging and supportive. Farmers are the backbone of India.`;

interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

/**
 * Send a message (and optional image) to Gemini AI
 */
export async function askGemini(
  message: string,
  language: string = "en",
  imageBase64?: string,
  imageMimeType: string = "image/jpeg"
): Promise<string> {
  const langName = LANGUAGE_NAMES[language] || "English";

  // RAG: ground the answer in the KrishiMitra datasets (best-effort)
  let kbContext = "";
  try {
    kbContext = formatKbContext(await retrieveKb(message));
  } catch {
    kbContext = "";
  }
  const grounding = kbContext
    ? `\n\nGROUNDING CONTEXT (verified facts from the KrishiMitra datasets — use where relevant, ignore if unrelated to the question):\n${kbContext}\n`
    : "";

  const parts: GeminiPart[] = [
    {
      text: `${SYSTEM_PROMPT}\n\nThe farmer is communicating in: ${langName}. Respond ONLY in ${langName}.${grounding}\n\nFarmer's message: ${message}`,
    },
  ];

  // If image provided, add it as inline_data
  if (imageBase64) {
    // Strip data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    parts.push({
      inline_data: {
        mime_type: imageMimeType,
        data: cleanBase64,
      },
    });
  }

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      if (errorData?.error?.code === 429) {
        return getFallbackMessage(language, "rate_limit");
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data: GeminiResponse = await response.json();

    if (data.error) {
      return getFallbackMessage(language, "api_error");
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) {
      return getFallbackMessage(language, "no_response");
    }

    return reply;
  } catch (err) {
    console.error("[AgriNexus Gemini]", err);
    return getFallbackMessage(language, "network_error");
  }
}

/**
 * Save conversation to Supabase
 */
export async function saveConversation(
  supabase: any,
  farmerId: string | null,
  role: "user" | "assistant",
  content: string,
  language: string,
  imageUrl?: string
) {
  if (!supabase || !farmerId) return;

  try {
    await supabase.from("assistant_conversations").insert({
      farmer_id: farmerId,
      role,
      content,
      language,
      image_url: imageUrl || "",
    });
  } catch (err) {
    console.warn("[AgriNexus] Failed to save conversation:", err);
  }
}

/**
 * Load conversation history from Supabase
 */
export async function loadConversationHistory(
  supabase: any,
  farmerId: string,
  limit: number = 50
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  if (!supabase || !farmerId) return [];

  try {
    const { data } = await supabase
      .from("assistant_conversations")
      .select("role, content")
      .eq("farmer_id", farmerId)
      .order("created_at", { ascending: true })
      .limit(limit);

    return data || [];
  } catch {
    return [];
  }
}

// ============================================================
// CROP DISEASE DIAGNOSIS — structured JSON via free Gemini LLM,
// grounded in the local agriculture knowledge base.
// NOTE: we NEVER fabricate a diagnosis. If the AI call fails we
// throw so the UI shows an honest error instead of fake data.
// ============================================================

export interface CropDiagnosis {
  isAgriImage: boolean;
  disease: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  confidence: number;
  symptoms: string[];
  organicTreatments: string[];
  chemicalTreatments: string[];
  cause: string;
  irrigationAdvice: string[];
  soilAdvice: string[];
  recommendedProducts: string[];
  summary: string;
}

function buildDiagnosisPrompt(cropName: string, language: string): string {
  const langName = LANGUAGE_NAMES[language] || "English";
  const kb = CROP_KNOWLEDGE[cropName] || CROP_KNOWLEDGE.Other;
  const diseaseList = kb.diseases.map((d) => d.name).join(", ");
  const irrigation = kb.irrigation.map((i) => `${i.stage}: ${i.frequency} (${i.amount}, ${i.method})`).join(" | ");

  return `You are an expert plant pathologist diagnosing crop diseases for Indian farmers.

CROP: ${kb.name}

GROUNDING DATA (verified agricultural extension data):
- Known diseases for this crop: ${diseaseList}
- Soil requirements: pH ${kb.soil.ph[0]}-${kb.soil.ph[1]}, ${kb.soil.texture}. N:${kb.soil.nitrogen} P:${kb.soil.phosphorus} K:${kb.soil.potassium}
- Irrigation schedule: ${irrigation}
- Fertilizer: ${kb.idealFertilizer}

TASK: FIRST decide whether the image is agricultural.

REJECT (set isAgriImage false) ONLY if the scene is CLEARLY not agriculture: a face or person filling the frame, a hand/fingers close-up, a domestic pet, furniture, a room interior, a food plate, a screenshot, or a solid-color graphic. ALSO REJECT only if the photo is so blurry, dark, or out-of-focus that NO plant/leaf/fruit can be identified at all.

If the image shows ANY plant, leaf, fruit, vegetable, crop, soil, field, farm tool, pesticide/fertilizer bottle, or farming scene — even with a messy background, water droplets, partial coverage, or other objects in the frame — treat it as agricultural (set isAgriImage true) and continue with the diagnosis. Real farm photos often have non-plant objects in the background; just focus on the plant/crop content.

If it is agricultural: continue with the full diagnosis (if the plant is healthy, set disease to 'Healthy Plant'). If rejected: leave analysis fields empty and put a one-line reason in "summary".

Respond ONLY with a JSON object (no markdown fences, no extra text) with EXACTLY these keys:
{
  "isAgriImage": true or false,
  "disease": "disease name or 'Healthy Plant'",
  "severity": "Low" | "Medium" | "High" | "Critical" (use "Low" if healthy),
  "confidence": number 0-100,
  "symptoms": ["visible symptom 1", "symptom 2", "symptom 3"],
  "organicTreatments": ["treatment 1", "treatment 2"],
  "chemicalTreatments": ["treatment with exact dosage"],
  "cause": "pathogen/cause in one sentence",
  "irrigationAdvice": ["actionable irrigation advice for this crop stage"],
  "soilAdvice": ["actionable soil/fertilizer advice"],
  "recommendedProducts": ["specific product farmers can buy, e.g. 'Neem Oil 100ml'", "specific product"],
  "summary": "2-3 sentence friendly explanation of what the farmer should do"
}

Write ALL string values in ${langName}. Keep the JSON structure exactly as shown.`;
}

function extractJSON(text: string): CropDiagnosis | null {
  try {
    // Strip markdown fences if present
    const cleaned = text.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!parsed.disease) return null;
    // Normalize severity — the model sometimes returns "Moderate"
    const rawSeverity = String(parsed.severity || "Medium");
    const normalizedSeverity: CropDiagnosis["severity"] =
      rawSeverity === "Moderate" ? "Medium" :
      ["Low", "Medium", "High", "Critical"].includes(rawSeverity) ? (rawSeverity as CropDiagnosis["severity"]) : "Medium";
    return {
      isAgriImage: parsed.isAgriImage !== false,
      disease: String(parsed.disease),
      severity: normalizedSeverity,
      confidence: Number(parsed.confidence) || 85,
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms.map(String) : [],
      organicTreatments: Array.isArray(parsed.organicTreatments) ? parsed.organicTreatments.map(String) : [],
      chemicalTreatments: Array.isArray(parsed.chemicalTreatments) ? parsed.chemicalTreatments.map(String) : [],
      cause: String(parsed.cause || ""),
      irrigationAdvice: Array.isArray(parsed.irrigationAdvice) ? parsed.irrigationAdvice.map(String) : [],
      soilAdvice: Array.isArray(parsed.soilAdvice) ? parsed.soilAdvice.map(String) : [],
      recommendedProducts: Array.isArray(parsed.recommendedProducts) ? parsed.recommendedProducts.map(String) : [],
      summary: String(parsed.summary || ""),
    };
  } catch {
    return null;
  }
}

/**
 * Downscale + re-compress a camera image so the API accepts it.
 * Phone cameras produce 3-8 MB photos; we cap at ~1280px JPEG q0.8.
 */
async function compressImage(imageDataUrl: string): Promise<{ base64: string; mimeType: string }> {
  // Quick path: already small enough
  const rawSize = imageDataUrl.length * 0.75;
  if (rawSize < 400_000) {
    const m = imageDataUrl.match(/^data:([^;]+);base64,/);
    return { base64: imageDataUrl.replace(/^data:[^;]+;base64,/, ""), mimeType: m ? m[1] : "image/jpeg" };
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1280;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL("image/jpeg", 0.8);
        resolve({ base64: out.replace(/^data:[^;]+;base64,/, ""), mimeType: "image/jpeg" });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Invalid image"));
    img.src = imageDataUrl;
  });
}

export async function diagnoseCropImage(
  cropName: string,
  imageBase64: string,
  language: string = "en"
): Promise<CropDiagnosis> {
  const { base64, mimeType } = await compressImage(imageBase64);
  const prompt = buildDiagnosisPrompt(cropName, language);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * 1500));
      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        // 4xx = bad request (e.g. image rejected) — don't retry
        if (response.status < 500 && response.status !== 429) throw new Error(`Gemini API error: ${response.status}`);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data: GeminiResponse = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) throw new Error("Empty response");

      const parsed = extractJSON(reply);
      if (parsed) return parsed;
      throw new Error("JSON parse failed");
    } catch (err) {
      lastError = err;
      console.warn(`[AgriNexus] Diagnosis attempt ${attempt + 1} failed:`, err);
    }
  }

  // Do NOT fabricate a diagnosis. Surface an honest error to the farmer.
  throw lastError instanceof Error
    ? lastError
    : new Error("AI service is busy. Please try again in a moment.");
}

/**
 * Friendly fallback messages in each language
 */
function getFallbackMessage(language: string, type: string): string {
  const messages: Record<string, Record<string, string>> = {
    en: {
      rate_limit: "I'm getting too many requests right now. Please wait a minute and try again.",
      api_error: "I'm having trouble connecting to my AI service. Please try again in a moment.",
      no_response: "I couldn't generate a response. Please try rephrasing your question.",
      network_error: "Network error — please check your internet connection and try again.",
      no_api_key: "AI service is not configured yet. Please contact the admin.",
    },
    hi: {
      rate_limit: "Abhi bahut zyada requests aa rahi hain. Please 1 minute ruk kar phir se try karein.",
      api_error: "AI service se judne mein dikkat ho rahi hai. Please thodi der mein phir se try karein.",
      no_response: "Jawab generate nahi ho paya. Please apna sawal alag tarike se puchein.",
      network_error: "Internet connection mein problem hai. Please apna net check karein aur phir try karein.",
      no_api_key: "AI service abhi configured nahi hai. Please admin se contact karein.",
    },
    bn: {
      rate_limit: "এখন অনেক বেশি অনুরোধ আসছে। অনুগ্রহ করে 1 মিনিট অপেক্ষা করে আবার চেষ্টা করুন।",
      api_error: "AI সার্ভিসে সংযোগে সমস্যা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।",
      no_response: "উত্তর তৈরি করা যায়নি। অনুগ্রহ করে আপনার প্রশ্ন অন্যভাবে জিজ্ঞাসা করুন।",
      network_error: "ইন্টারনেট সংযোগে সমস্যা আছে। অনুগ্রহ করে আপনার নেট চেক করুন।",
    },
    te: {
      rate_limit: "ఇప్పుడు చాలా ఎక్కువ అభ్యర్థనలు వస్తున్నాయి. దయచేసి 1 నిమిషం ఆగి మళ్ళీ ప్రయత్నించండి.",
      api_error: "AI సేవతో కనెక్ట్ అవ్వడంలో సమస్య ఉంది. దయచేసి కొంచెం తర్వాత మళ్ళీ ప్రయత్నించండి.",
      no_response: "ప్రతిస్పందన రాబట్టలేకపోయింది. దయచేసి మీ ప్రశ్నను వేరే విధంగా అడగండి.",
      network_error: "ఇంటర్నెట్ కనెక్షన్‌లో సమస్య ఉంది. దయచేసి మీ నెట్ చెక్ చేయండి.",
    },
    ta: {
      rate_limit: "இப்போது அதிகமான கோரிக்கைகள் வருகின்றன. தயவுசெய்து 1 நிமிடம் காத்திருந்து மீண்டும் முயற்சிக்கவும்.",
      api_error: "AI சேவையுடன் இணைவதில் சிக்கல் உள்ளது. தயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.",
      no_response: "பதிலை உருவாக்க முடியவில்லை. தயவுசெய்து உங்கள் கேள்வியை வேறு வகையில் கேளுங்கள்.",
      network_error: "இணைய இணைப்பில் சிக்கல் உள்ளது. தயவுசெய்து உங்கள் நெட் சரிபார்க்கவும்.",
    },
    kn: {
      rate_limit: "ಈಗ ತುಂಬಾ ಹೆಚ್ಚು ವಿನಂತಿಗಳು ಬರುತ್ತಿವೆ. ದಯವಿಟ್ಟು 1 ನಿಮಿಷ ಕಾಯಿರಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
      api_error: "AI ಸೇವೆಯೊಂದಿಗೆ ಸಂಪರ್ಕಿಸಲು ತೊಂದರೆಯಾಗುತ್ತಿದೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
      no_response: "ಉತ್ತರವನ್ನು ರಚಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಬೇರೆ ರೀತಿಯಲ್ಲಿ ಕೇಳಿ.",
      network_error: "ಇಂಟರ್ನೆಟ್ ಸಂಪರ್ಕದಲ್ಲಿ ಸಮಸ್ಯೆ ಇದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ನೆಟ್ ಪರಿಶೀಲಿಸಿ.",
    },
    mr: {
      rate_limit: "आता खूप जास्त विनंत्या येत आहेत. कृपया 1 मिनिट थांबा आणि पुन्हा प्रयत्न करा.",
      api_error: "AI सेवेशी जोडण्यात अडचण येत आहे. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.",
      no_response: "उत्तर तयार करता आले नाही. कृपया तुमचा प्रश्न वेगळ्या प्रकारे विचारा.",
      network_error: "इंटरनेट कनेक्शनमध्ये समस्या आहे. कृपया तुमचा नेट तपासा.",
    },
    od: {
      rate_limit: "ଏବେ ଅନେକ ଅନୁରୋଧ ଆସୁଛି। ଦୟାକରି 1 ମିନିଟ୍ ଅପେକ୍ଷା କରି ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
      api_error: "AI ସେବା ସହ ସଂଯୋଗ କରିବାରେ ସମସ୍ୟା ହେଉଛି। ଦୟାକରି କିଛି ସମୟ ପରେ ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ।",
      no_response: "ଉତ୍ତର ସୃଷ୍ଟି କରି ପାରିଲା ନାହିଁ। ଦୟାକରି ଆପଣଙ୍କ ପ୍ରଶ୍ନ ଅନ୍ୟ ଉପାୟରେ ପଚାରନ୍ତୁ।",
      network_error: "ଇଣ୍ଟରନେଟ୍ ସଂଯୋଗରେ ସମସ୍ୟା ଅଛି। ଦୟାକରି ଆପଣଙ୍କ ନେଟ୍ ଯାଞ୍ଚ କରନ୍ତୁ।",
    },
  };

  return (messages[language] as Record<string, string>)?.[type] || messages.en[type] || "Something went wrong. Please try again.";
}
