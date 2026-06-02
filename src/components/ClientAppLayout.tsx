import React, { useState } from 'react';
import QuantumMap from './QuantumMap';
import HugoOrb from './HugoOrb';
import ConfirmationDialog from './ConfirmationDialog';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/utils';
import { MapPin } from 'lucide-react';

interface ClientAppLayoutProps {
  user: any;
  state: any;
  orbState: "IDLE" | "LISTENING" | "THINKING" | "SPEAKING";
  isLiveActive: boolean;
  liveTranscript: string | null;
  handleOrbClick: () => void;
  onRequestLocation: () => void;
  isLocationLoading: boolean;
  providers: any[];
  onHire: (id: string) => void;
  onSelectProvider: (p: any) => void;
  userLocation?: [number, number];
}

export default function ClientAppLayout({
  user, state, orbState, isLiveActive, liveTranscript, handleOrbClick,
  onRequestLocation, isLocationLoading, providers, onHire, onSelectProvider, userLocation
}: ClientAppLayoutProps) {
  const [hireConfirm, setHireConfirm] = useState(false);
  const selectedProvider = providers.find(p => p.id === state.datos?.proveedor_seleccionado);

  const mapCenter = userLocation
    ? { lat: userLocation[0], lng: userLocation[1] }
    : { lat: -27.5945, lng: -48.5477 }; // Florianópolis default

  const confirmHire = () => {
    if (selectedProvider) {
      onHire(selectedProvider.id);
      setHireConfirm(false);
    }
  };

  return (
    <div className="relative h-[100dvh] w-screen bg-black overflow-hidden">
      <ConfirmationDialog
        isOpen={hireConfirm}
        providerName={selectedProvider?.nombre || 'Provedor'}
        cost={selectedProvider?.precio || selectedProvider?.tarifa || 0}
        onConfirm={confirmHire}
        onCancel={() => setHireConfirm(false)}
      />

      {/* Map Layer */}
      <div className="absolute inset-0 z-0">
        <QuantumMap
          center={mapCenter}
          providers={providers}
          activeProviderId={state.datos?.proveedor_seleccionado}
          onHire={() => setHireConfirm(true)}
          onSelectProvider={onSelectProvider}
        />
      </div>

      {/* Location button — positioned to avoid nav bar on the right */}
      <div className="absolute top-6 left-6 z-40">
        <button
          onClick={onRequestLocation}
          disabled={isLocationLoading}
          className={cn(
            "p-3 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full text-white transition-all",
            isLocationLoading ? "animate-pulse border-quantum-cyan" : "hover:bg-quantum-cyan hover:text-black"
          )}
          title="Solicitar ubicación real"
        >
          <MapPin size={20} className={isLocationLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Selected Provider Card */}
      <AnimatePresence>
        {selectedProvider && (
          <motion.div
            key={selectedProvider.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute top-20 left-6 w-72 z-40"
          >
            <div className="p-5 bg-black/70 backdrop-blur-2xl border border-white/10 rounded-3xl text-white">
              <div className="flex items-center gap-3 mb-3">
                {selectedProvider.foto ? (
                  <img src={selectedProvider.foto} alt={selectedProvider.nombre} className="w-12 h-12 rounded-full object-cover border-2 border-quantum-cyan/40" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-quantum-cyan/20 flex items-center justify-center text-quantum-cyan font-bold text-lg border-2 border-quantum-cyan/40">
                    {(selectedProvider.nombre || '?').charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="text-sm font-bold leading-tight">{selectedProvider.nombre}</h2>
                  <p className="text-xs text-quantum-cyan">{selectedProvider.categoria || 'Especialista'}</p>
                </div>
              </div>
              {selectedProvider.bio_memoria && (
                <p className="text-xs text-white/50 mb-3 italic line-clamp-2">"{selectedProvider.bio_memoria}"</p>
              )}
              <button
                onClick={() => setHireConfirm(true)}
                className="w-full py-2 bg-quantum-cyan text-black font-bold rounded-xl text-sm hover:opacity-90 transition-opacity"
              >
                Contratar · R$ {selectedProvider.precio || selectedProvider.tarifa || 0}/h
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hugo Voice Interface */}
      <div className="absolute bottom-10 left-0 right-0 z-30 flex flex-col items-center pointer-events-none">
        <div className="pointer-events-auto">
          <HugoOrb
            state={isLiveActive ? 'LISTENING' : orbState}
            onClick={handleOrbClick}
            className="w-20 h-20"
          />
        </div>

        {/* Message Bubble */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isLiveActive ? liveTranscript : state.hugo_mensaje}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 px-5 py-3 bg-black/70 backdrop-blur-2xl border border-white/10 rounded-2xl max-w-xs text-center shadow-2xl pointer-events-auto"
          >
            <p className="text-sm font-light text-white/90 leading-relaxed">
              {isLiveActive
                ? (liveTranscript || "Te estoy escuchando...")
                : (state.hugo_mensaje || "Olá! Eu sou Hugo, seu Orbe inteligente.")}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-3 px-4 py-1.5 bg-cyan-950/40 border border-cyan-500/20 rounded-full">
          <span className="text-xs text-cyan-400/70 font-bold uppercase tracking-widest">
            {isLiveActive ? "● Escuchando" : "Toca para hablar"}
          </span>
        </div>
      </div>
    </div>
  );
}
