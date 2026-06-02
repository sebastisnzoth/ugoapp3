import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { Zap, Star, Briefcase, ToggleLeft, ToggleRight } from 'lucide-react';

export default function ProviderDashboard({ providerId }: { providerId: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const profileRef = doc(db, 'profiles', providerId);
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
    });

    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('proveedorId', '==', providerId),
      where('estado_servicio', '==', 'activo')
    );
    const unsubBookings = onSnapshot(bookingsQuery, (snapshot) => {
      setBookings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubProfile(); unsubBookings(); };
  }, [providerId]);

  const toggleAvailability = async () => {
    if (!profile || toggling) return;
    setToggling(true);
    const newVal = !profile.disponible;
    try {
      await updateDoc(doc(db, 'profiles', providerId), { disponible: newVal });
      // Best-effort update to radar collection; skip if doc doesn't exist
      try {
        await updateDoc(doc(db, 'profiles_providers', providerId), { disponible: newVal });
      } catch (_) {}
    } catch (err) {
      console.error("Error updating availability:", err);
    } finally {
      setToggling(false);
    }
  };

  if (!profile) return (
    <div className="p-6 bg-quantum-card rounded-2xl border border-white/10 text-white/50 text-sm">
      Cargando perfil...
    </div>
  );

  return (
    <div className="p-6 bg-quantum-card rounded-2xl border border-white/10 space-y-6 text-white">
      <h2 className="text-xl font-bold text-quantum-cyan">Panel del Proveedor</h2>

      <div className="grid grid-cols-2 gap-4">
        {/* Karma */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
            <Star size={12} /> Karma
          </div>
          <p className="text-3xl font-bold text-quantum-cyan">{profile.karma ?? 0}</p>
        </div>

        {/* Availability toggle */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
            <Zap size={12} /> Estado
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {profile.disponible ? (
                <span className="text-green-400">Disponible</span>
              ) : (
                <span className="text-white/40">No disponible</span>
              )}
            </p>
            {/* Proper toggle — not a div inside a button */}
            <button
              onClick={toggleAvailability}
              disabled={toggling}
              aria-label="Cambiar disponibilidad"
              className="text-quantum-cyan disabled:opacity-50 transition-opacity"
            >
              {profile.disponible
                ? <ToggleRight size={32} className="text-green-400" />
                : <ToggleLeft size={32} className="text-white/30" />
              }
            </button>
          </div>
        </div>
      </div>

      {/* Active bookings */}
      <div>
        <div className="flex items-center gap-2 text-white/70 text-sm font-semibold mb-3">
          <Briefcase size={14} /> Servicios Activos
        </div>
        {bookings.length > 0 ? (
          <ul className="space-y-2">
            {bookings.map((b) => (
              <li key={b.id} className="p-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/80">
                {b.servicio || 'Servicio sin nombre'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-white/30 text-sm">No hay servicios activos en este momento.</p>
        )}
      </div>
    </div>
  );
}
