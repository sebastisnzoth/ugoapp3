import { useState, useCallback, useRef } from 'react';
import { hugoService, HugoResponse } from '../services/hugoService';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface Provider {
  id: string;
  nombre: string;
  rating: number;
  tarifa: number;
  primeiro_nome?: string;
  sobrenome?: string;
  precio?: number;
  tarifa_personalizada?: number;
  foto?: string;
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  categoria?: string;
  especialidade?: string;
}

interface HugoState extends HugoResponse {
  datos: {
    servicio?: string;
    monto?: number;
    confirmado?: boolean;
    proveedores?: Provider[];
    proveedor_seleccionado?: string;
    monto_acordado?: number;
    estado_boveda?: string;
    servicio_activo?: {
      status: string;
      eta: string;
      codigo_seguridad: string;
    };
    escrow?: {
      total_a_pagar: number;
      estado: string;
    };
  };
}

// Fallback demo providers when AI returns none
const DEMO_PROVIDERS = (lat: number, lng: number) => [
  { id: 'p1', nombre: 'Marco Rossi', rating: 4.9, tarifa: 85, foto: 'https://picsum.photos/seed/marco/100/100', categoria: 'Eletricista', latitude: lat + 0.005, longitude: lng + 0.005 },
  { id: 'p2', nombre: 'Ana Silva',   rating: 4.8, tarifa: 70, foto: 'https://picsum.photos/seed/ana/100/100',   categoria: 'Limpeza',     latitude: lat - 0.005, longitude: lng + 0.005 },
  { id: 'p3', nombre: 'João Reparos',rating: 4.7, tarifa: 95, foto: 'https://picsum.photos/seed/joao/100/100', categoria: 'Encanador',   latitude: lat + 0.005, longitude: lng - 0.005 },
];

export function useHugo() {
  const [state, setState] = useState<HugoState>({
    hugo_mensaje: "Olá! Eu sou Hugo, seu Orbe inteligente. Como posso ajudar hoje?",
    accion: "CONVERSAR",
    ui_action: 'IDLE',
    datos: {}
  });

  const [history, setHistory] = useState<any[]>([]);
  const [orbState, setOrbState] = useState<'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'>('IDLE');
  const [userLocation, setUserLocation] = useState<[number, number]>([-27.5945, -48.5477]);
  const [isLocationLoading, setIsLocationLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const requestLocation = useCallback(() => {
    setIsLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setIsLocationLoading(false);
      },
      (err) => {
        console.warn("Geolocation error:", err);
        setIsLocationLoading(false);
      }
    );
  }, []);

  const stopTTS = useCallback(() => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch (_) {}
      currentSourceRef.current = null;
    }
    setOrbState('IDLE');
  }, []);

  // playTTS is stable — uses refs, doesn't depend on state
  const playTTS = useCallback(async (text: string) => {
    try {
      stopTTS();
      const base64Audio = await hugoService.tts(text);
      if (!base64Audio) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const audioData = atob(base64Audio);
      const uint8 = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) uint8[i] = audioData.charCodeAt(i);

      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContextRef.current.decodeAudioData(uint8.buffer.slice(0));
      } catch (_) {
        // Fallback: treat as raw PCM 16-bit 24kHz
        const pcmData = new Int16Array(uint8.buffer);
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) floatData[i] = pcmData[i] / 32768.0;
        audioBuffer = audioContextRef.current.createBuffer(1, floatData.length, 24000);
        audioBuffer.getChannelData(0).set(floatData);
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      currentSourceRef.current = source;
      setOrbState('SPEAKING');
      source.onended = () => {
        if (currentSourceRef.current === source) {
          setOrbState('IDLE');
          currentSourceRef.current = null;
        }
      };
      source.start();
    } catch (error) {
      console.error("TTS playback error:", error);
      setOrbState('IDLE');
    }
  }, [stopTTS]);

  const processMessage = useCallback(async (text: string, isExternal: boolean = false) => {
    if (!isExternal) setOrbState('THINKING');

    try {
      if (isExternal) {
        setState(prev => ({ ...prev, hugo_mensaje: text }));
        await playTTS(text);
        return;
      }

      const result = await hugoService.chat(text, history, userLocation);

      setHistory(prev => [
        ...prev,
        { role: 'user', parts: [{ text }] },
        { role: 'model', parts: [{ text: result.hugo_mensaje }] }
      ].slice(-10));

      if (!result.datos) result.datos = {};

      // Fallback demo providers if AI returned none for a service request
      if (result.accion === 'BUSCAR_PROVEEDOR' && (!result.datos.proveedores || result.datos.proveedores.length === 0)) {
        result.datos.proveedores = DEMO_PROVIDERS(userLocation[0], userLocation[1]);
        result.ui_action = 'SHOW_PROVIDERS';
      }

      setState(result as HugoState);

      if (result.accion === 'CONFIRMAR_EMERGENCIA') {
        try {
          await addDoc(collection(db, 'bookings'), {
            userId: auth.currentUser?.uid,
            location: { latitude: userLocation[0], longitude: userLocation[1] },
            ...result.datos,
            createdAt: serverTimestamp()
          });
        } catch (err) {
          console.error("Error saving emergency booking:", err);
        }
      }

      await playTTS(result.hugo_mensaje);

    } catch (error) {
      console.error("Hugo Brain error:", error);
      setOrbState('IDLE');
      setState(prev => ({
        ...prev,
        hugo_mensaje: "Tuve un problema de conexión. ¿Puedes intentarlo de nuevo?",
        accion: "SOPORTE",
        ui_action: "IDLE"
      }));
    }
  }, [userLocation, history, playTTS]);

  // analyzeMedia: use proper Promise-based FileReader
  const analyzeMedia = useCallback(async (file: File, prompt: string) => {
    setOrbState('THINKING');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const analysis = await hugoService.analyzeMedia(base64, file.type, prompt);
      const msg = analysis || "Análise concluída.";
      setState(prev => ({ ...prev, hugo_mensaje: msg }));
      await playTTS(msg);
    } catch (error) {
      console.error("Media analysis error:", error);
      setOrbState('IDLE');
    }
  }, [playTTS]);

  const sayWelcome = useCallback(() => {
    playTTS(state.hugo_mensaje);
  }, [state.hugo_mensaje, playTTS]);

  const selectProvider = useCallback((id: string) => {
    setState(prev => ({ ...prev, datos: { ...prev.datos, proveedor_seleccionado: id } }));
  }, []);

  return {
    state,
    orbState,
    setOrbState,
    processMessage,
    analyzeMedia,
    sayWelcome,
    stopTTS,
    userLocation,
    requestLocation,
    isLocationLoading,
    selectProvider
  };
}
