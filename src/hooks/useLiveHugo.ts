import { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";

// Vite exposes env vars via import.meta.env
const API_KEY = import.meta.env.VITE_GOOGLE_GENAI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
if (!API_KEY) {
  console.warn('VITE_GOOGLE_GENAI_API_KEY no está definido. El orbe de voz en vivo no funcionará sin esta clave.');
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

export function useLiveHugo() {
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const retryCountRef = useRef<number>(0);
  const MAX_RETRIES = 3;

  const stopLive = useCallback(() => {
    // Clean up audio processing chain before closing session
    processorRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (_) {}
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
    }
    setIsActive(false);
    retryCountRef.current = 0;
  }, []);

  const startLive = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Micrófono no disponible en este navegador.');
      }

      setTranscript('');
      nextPlayTimeRef.current = 0;
      retryCountRef.current = 0;

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      await audioContextRef.current.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const micSource = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current = micSource;
      // ScriptProcessor is deprecated but still the only broadly supported option
      // for raw PCM capture in browsers without AudioWorklet support
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      micSource.connect(processor);
      // Connect to destination with zero gain to keep the graph alive without feedback
      const silentGain = audioContextRef.current.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(audioContextRef.current.destination);

      const session = await (ai.live as any).connect({
        model: "gemini-2.0-flash-live-preview-04-09",
        callbacks: {
          onopen: () => {
            console.log("Hugo Live: session opened");
            setIsActive(true);
            retryCountRef.current = 0;
          },
          onmessage: async (message: any) => {
            // Handle audio response
            const audioPart = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioPart && audioContextRef.current) {
              const audioData = atob(audioPart);
              const uint8 = new Uint8Array(audioData.length);
              for (let i = 0; i < audioData.length; i++) uint8[i] = audioData.charCodeAt(i);

              const pcmData = new Int16Array(uint8.buffer);
              const floatData = new Float32Array(pcmData.length);
              for (let i = 0; i < pcmData.length; i++) floatData[i] = pcmData[i] / 32768.0;

              const audioBuffer = audioContextRef.current.createBuffer(1, floatData.length, 24000);
              audioBuffer.getChannelData(0).set(floatData);
              const bufSource = audioContextRef.current.createBufferSource();
              bufSource.buffer = audioBuffer;
              bufSource.connect(audioContextRef.current.destination);

              const now = audioContextRef.current.currentTime;
              if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now;
              bufSource.start(nextPlayTimeRef.current);
              nextPlayTimeRef.current += audioBuffer.duration;
            }
            // Handle text transcript
            const textPart = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (textPart) setTranscript(prev => (prev + ' ' + textPart).trim());
          },
          onclose: () => { 
            console.log("Hugo Live: session closed"); 
            stopLive(); 
          },
          onerror: (err: any) => { 
            console.error("Hugo Live error:", err); 
            // Attempt retry before stopping
            if (retryCountRef.current < MAX_RETRIES) {
              retryCountRef.current++;
              console.log(`Reintentando conexión (${retryCountRef.current}/${MAX_RETRIES})...`);
              setTimeout(() => {
                startLive();
              }, 1000);
            } else {
              console.error('Max retries reached, stopping live session');
              stopLive();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
          systemInstruction: `Eres "Hugo", el Orbe inteligente y núcleo central del U.GO OS.
Tu interfaz es una esfera animada y te comunicas por voz.
Responde siempre con tono amable y profesional, de forma conversacional y breve.
Tienes control total sobre la interfaz: cuando el usuario pide un servicio, dile que estás mostrando las opciones en pantalla.`,
        }
      });

      sessionRef.current = session;

      processor.onaudioprocess = (e) => {
        if (!sessionRef.current) return;
        try {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
          }
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
          session.sendRealtimeInput({ audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' } });
        } catch (err) {
          console.error('Failed to send live audio chunk:', err);
          // Don't stop the session on audio send error, just log it
        }
      };

    } catch (error) {
      console.error('Failed to start live session:', error);
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
        console.log(`Reintentando después de error de inicio (${retryCountRef.current}/${MAX_RETRIES})...`);
        setTimeout(() => {
          startLive();
        }, 1000);
      } else {
        stopLive();
      }
    }
  }, [stopLive]);

  return { isActive, transcript, startLive, stopLive };
}
