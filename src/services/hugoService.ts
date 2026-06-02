import { GoogleGenAI, Type, Modality } from "@google/genai";

// Vite exposes env vars via import.meta.env
const API_KEY = import.meta.env.VITE_GOOGLE_GENAI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY || '';
if (!API_KEY) {
  console.warn('VITE_GOOGLE_GENAI_API_KEY no está definido. El orbe de voz no funcionará sin esta clave.');
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

export interface HugoResponse {
  hugo_mensaje: string;
  accion: string;
  ui_action: string;
  datos: {
    proveedores?: { id: string; nombre: string; rating: number; tarifa: number; foto?: string; categoria?: string; latitude?: number; longitude?: number; }[] | null;
    mensaje_estado?: string;
    servicio?: string;
    monto?: number;
    confirmado?: boolean;
    proveedor_seleccionado?: string;
    escrow?: { total_a_pagar: number; estado: string };
  };
  grounding_links?: { title: string; uri: string }[];
}

export const HUGO_SYSTEM_PROMPT = `
Eres Hugo, el Núcleo de Inteligencia del S.O. U.G.O. 
TU REGLA #1: RESPUESTA SIEMPRE EN JSON ESTRUCTURADO. NUNCA respondas con texto plano fuera del JSON.

Estructura obligatoria de respuesta:
{
  "hugo_mensaje": "Texto persuasivo de 1 a 2 frases para voz/chat",
  "accion": "BUSCAR_PROVEEDOR | RESERVAR_ESCROW | SOPORTE | CONVERSAR",
  "ui_action": "IDLE | SHOW_PROVIDERS | NEGOTIATING | ACTIVE_SERVICE | CHECKOUT",
  "datos": {
    "proveedores": [ { "id": "string", "nombre": "string", "rating": number, "tarifa": number } ] | null,
    "mensaje_estado": "string"
  }
}

INSTRUCCIONES DE OPERACIÓN:
1. SI EL USUARIO PIDE UN SERVICIO: 
   - Ejecuta 'BUSCAR_PROVEEDOR'.
   - Filtra proveedores activos de la base de datos local según la categoría.
   - Si hallas proveedores: "ui_action" DEBE SER "SHOW_PROVIDERS". Llena "datos.proveedores".
   - Si NO hallas proveedores: "ui_action" DEBE SER "IDLE". "datos.mensaje_estado" explica situación.

2. SI EL USUARIO PIDE DETALLES O SALUDA:
   - "ui_action" debe ser "IDLE". "accion" debe ser "CONVERSAR".

3. ESTRICTO CONTROL:
   - Tu prioridad es el JSON. SOLO JSON, sin texto previo.
   - Nunca alucines datos de proveedores: Usa solo los que te he proporcionado en el contexto.
`;

function safeParseHugoResponse(text: string): HugoResponse {
  try {
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    // Basic JSON repair for truncated responses
    let finalJson = clean;
    if (!finalJson.endsWith('}')) {
      let repaired = finalJson;
      if (repaired.split('"').length % 2 === 0) repaired += '"';
      const openBraces = (repaired.match(/\{/g) || []).length;
      const closeBraces = (repaired.match(/\}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
      finalJson = repaired;
    }
    return JSON.parse(finalJson) as HugoResponse;
  } catch (e) {
    console.error("Failed to parse Hugo response:", text);
    const mensajeMatch = text.match(/"hugo_mensaje":\s*"([^"]*)"/);
    return {
      hugo_mensaje: mensajeMatch ? mensajeMatch[1] : "Entendido, procesando tu solicitud.",
      accion: "CONVERSAR",
      ui_action: "IDLE",
      datos: {}
    };
  }
}

export const hugoService = {
  // General conversation — uses web search grounding (no responseSchema when using tools)
  async chat(message: string, history: any[] = [], location?: [number, number]) {
    const locationCtx = location ? `Localización actual del usuario: ${location[0]},${location[1]}.` : 'Ubicación: Florianópolis, Brasil.';
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [...history, { role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction: HUGO_SYSTEM_PROMPT + `\n${locationCtx}`,
        maxOutputTokens: 1000,
      }
    });

    const text = response.text || '';
    const result = safeParseHugoResponse(text);

    // Extract grounding links if present
    const chunks = (response.candidates?.[0] as any)?.groundingMetadata?.groundingChunks;
    if (chunks) {
      result.grounding_links = chunks
        .map((chunk: any) => {
          if (chunk.web) return { title: chunk.web.title || 'Enlace', uri: chunk.web.uri };
          return null;
        })
        .filter(Boolean) as { title: string; uri: string }[];
    }

    return result;
  },

  // Live API voice connection
  connectLive(callbacks: any, _location?: [number, number]) {
    return (ai.live as any).connect({
      model: "gemini-2.0-flash-live-preview-04-09",
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
        },
        systemInstruction: "Eres Hugo, el asistente de voz del U.GO OS. Sé breve, técnico y servicial. Responde siempre en el idioma del usuario.",
        outputAudioTranscription: {},
        inputAudioTranscription: {},
      },
    });
  },

  // Image/Video analysis
  async analyzeMedia(fileData: string, mimeType: string, prompt: string) {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: fileData, mimeType } },
          { text: prompt }
        ]
      }]
    });
    return response.text;
  },

  // Text to Speech
  async tts(text: string): Promise<string | undefined> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ role: 'user', parts: [{ text: `Diga com autoridade e calma: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' }
            }
          }
        }
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (err) {
      console.warn("TTS not available, skipping audio:", err);
      return undefined;
    }
  }
};
