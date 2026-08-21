import { useState, useEffect, useRef } from 'react';
import { useHugo } from './hooks/useHugo';
import { useLiveHugo } from './hooks/useLiveHugo';
import ServiceHistory from './components/ServiceHistory';
import UserProfile from './components/UserProfile';
import WalletView from './components/WalletView';
import CalendarView from './components/CalendarView';
import ChatWindow from './components/ChatWindow';
import DashboardNavigation from './components/DashboardNavigation';
import ProviderDashboard from './components/ProviderDashboard';
import AdminPanel from './components/AdminPanel';
import RoleSelection from './components/RoleSelection';
import ClientAppLayout from './components/ClientAppLayout';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import 'leaflet/dist/leaflet.css';
import { defaultViewForRole, getUserRole, signInWithGoogle } from './lib/auth';
import { supabase } from './lib/supabase';

type AppUser = {
  uid: string;
  id: string;
  displayName: string | null;
  email: string | null;
};

function toAppUser(user: { id: string; email?: string | null; user_metadata?: Record<string, any> }): AppUser {
  const metadata = user.user_metadata ?? {};
  return {
    uid: user.id,
    id: user.id,
    displayName: metadata.full_name ?? metadata.name ?? metadata.nombre ?? null,
    email: user.email ?? null,
  };
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [activeView, setActiveView] = useState('map');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeChatTarget, setActiveChatTarget] = useState<string | null>(null);
  const [loginError, setLoginError] = useState('');

  const { state, orbState, processMessage, analyzeMedia, sayWelcome, stopTTS, userLocation, requestLocation, isLocationLoading, selectProvider } = useHugo();
  const { isActive: isLiveActive, startLive, stopLive, transcript: liveTranscript } = useLiveHugo();

  const processMessageRef = useRef(processMessage);
  useEffect(() => { processMessageRef.current = processMessage; }, [processMessage]);

  const lastHugoMessageRef = useRef('');

  useEffect(() => {
    if (state.ui_action === 'SHOW_PROVIDERS' && state.datos?.proveedores && state.datos.proveedores.length > 0) {
      setActiveView('map');
    }
  }, [state.ui_action, state.datos?.proveedores]);

  // Supabase is the canonical authentication and role source.
  useEffect(() => {
    let mounted = true;

    const applyUser = async (authUser: any | null) => {
      if (!mounted) return;

      if (!authUser) {
        setUser(null);
        setActiveView('map');
        setShowRoleSelection(false);
        setIsAuthReady(true);
        return;
      }

      const appUser = toAppUser(authUser);
      setUser(appUser);

      const role = await getUserRole(authUser.id);
      if (!mounted) return;

      // The DB trigger normally creates usuarios immediately. This fallback only
      // appears if a legacy/migrated account has no product profile yet.
      setShowRoleSelection(role === null);
      setActiveView(defaultViewForRole(role));
      setIsAuthReady(true);
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Error restoring Supabase session:', error);
        if (mounted) setIsAuthReady(true);
        return;
      }
      void applyUser(data.session?.user ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void applyUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleOrbClick = () => {
    if (orbState === 'SPEAKING') stopTTS();
    else if (isLiveActive) stopLive();
    else startLive();
  };

  // Legacy Firestore bridge for Hugo communications. Authentication/roles no longer depend on Firebase.
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const commsRef = collection(db, 'comunicaciones');
    const q = query(commsRef, where('uid', '==', user.uid), orderBy('timestamp', 'desc'), limit(1));

    const unsubscribeComms = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const comm = snapshot.docs[0].data();
        if (comm.mensaje && comm.mensaje !== lastHugoMessageRef.current) {
          lastHugoMessageRef.current = comm.mensaje;
          processMessageRef.current(comm.mensaje, true);
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'comunicaciones'));

    return () => unsubscribeComms();
  }, [user, isAuthReady]);

  // Providers are read from the canonical Supabase model.
  useEffect(() => {
    if (!isAuthReady || !user) return;

    let cancelled = false;

    const loadProviders = async () => {
      const { data, error } = await supabase
        .from('perfiles_proveedor')
        .select('usuario_id, bio, tarifa_base, online, disponible, ubicacion, estado_verificacion, usuarios!inner(id,nombre,apellido,karma,activo,tipo)')
        .eq('estado_verificacion', 'verificado')
        .eq('usuarios.activo', true)
        .eq('usuarios.tipo', 'proveedor');

      if (error) {
        console.error('Error loading providers from Supabase:', error);
        return;
      }

      if (!cancelled) {
        setProviders((data ?? []).map((row: any) => {
          const profile = Array.isArray(row.usuarios) ? row.usuarios[0] : row.usuarios;
          const location = row.ubicacion as any;
          const coordinates = location?.coordinates;
          return {
            id: row.usuario_id,
            nombre: [profile?.nombre, profile?.apellido].filter(Boolean).join(' '),
            karma: profile?.karma,
            bio: row.bio,
            tarifa: row.tarifa_base,
            precio: row.tarifa_base,
            online: row.online,
            disponible: row.disponible,
            lat: Array.isArray(coordinates) ? Number(coordinates[1]) : undefined,
            lng: Array.isArray(coordinates) ? Number(coordinates[0]) : undefined,
          };
        }));
      }
    };

    void loadProviders();

    const channel = supabase
      .channel('ugo-provider-directory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'perfiles_proveedor' }, () => {
        void loadProviders();
      })
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [isAuthReady, user]);

  const handleHire = (providerName: string) => {
    processMessage(`Hugo, quiero contratar a ${providerName}.`);
  };

  const handleGoogleSignIn = async () => {
    setLoginError('');
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Supabase Google sign-in error:', err);
      setLoginError('No se pudo iniciar sesión. Intenta de nuevo.');
    }
  };

  const validProviders = providers.filter(p => {
    const lat = Number(p.latitude ?? p.lat);
    const lng = Number(p.longitude ?? p.lng);
    return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
  });

  if (!isAuthReady) return (
    <div className="h-screen w-screen bg-quantum-dark flex flex-col items-center justify-center text-white gap-4">
      <div className="text-quantum-cyan text-4xl font-bold animate-pulse">Ω</div>
      <p className="text-white/40 text-sm">Iniciando U.GO OS...</p>
    </div>
  );

  if (!user) return (
    <div className="h-screen w-screen bg-quantum-dark flex flex-col items-center justify-center text-white gap-6 p-4">
      <div className="text-center space-y-2">
        <div className="text-quantum-cyan text-5xl font-bold">Ω</div>
        <h1 className="text-3xl font-bold tracking-tight">U.GO Quantum OS</h1>
        <p className="text-white/40 text-sm">El sistema operativo de servicios</p>
      </div>
      <button
        onClick={handleGoogleSignIn}
        className="bg-quantum-cyan text-black px-8 py-3 rounded-full font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Entrar con Google
      </button>
      {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
    </div>
  );

  return (
    <div className="relative h-[100dvh] w-screen bg-quantum-dark overflow-hidden quantum-grid">
      <DashboardNavigation activeView={activeView} onViewChange={setActiveView} userId={user.uid} />

      {showRoleSelection && (
        <RoleSelection userId={user.uid} onRoleSelected={async () => {
          setShowRoleSelection(false);
          const role = await getUserRole(user.uid);
          setActiveView(defaultViewForRole(role));
        }} />
      )}

      {activeView === 'map' && user && (
        <ClientAppLayout
          user={user}
          state={state}
          orbState={orbState}
          isLiveActive={isLiveActive}
          liveTranscript={liveTranscript}
          handleOrbClick={handleOrbClick}
          onRequestLocation={requestLocation}
          isLocationLoading={isLocationLoading}
          providers={validProviders}
          onHire={handleHire}
          onSelectProvider={selectProvider}
          userLocation={userLocation}
        />
      )}

      <AnimatePresence>
        {activeView !== 'map' && user && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="absolute top-6 left-6 bottom-6 w-96 z-40"
          >
            {activeView === 'wallet'   && <WalletView userId={user.uid} />}
            {activeView === 'calendar' && <CalendarView userId={user.uid} />}
            {activeView === 'history'  && <ServiceHistory isOpen={true} userId={user.uid} onClose={() => setActiveView('map')} />}
            {activeView === 'profile'  && <UserProfile isOpen={true} userId={user.uid} onClose={() => setActiveView('map')} />}
            {activeView === 'provider' && <ProviderDashboard providerId={user.uid} />}
            {activeView === 'admin'    && <AdminPanel />}
          </motion.div>
        )}
      </AnimatePresence>

      {isChatOpen && activeChatTarget && user && (
        <ChatWindow
          currentUserId={user.uid}
          targetUserId={activeChatTarget}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
}
