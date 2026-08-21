import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Briefcase } from 'lucide-react';
import { cn } from '../lib/utils';

interface RoleSelectionProps {
  userId: string;
  onRoleSelected: () => void;
}

const ROLES = [
  { id: 'cliente', label: 'Cliente', description: 'Busca y contrata servicios', icon: User },
  { id: 'proveedor', label: 'Proveedor', description: 'Ofrece tus servicios', icon: Briefcase },
] as const;

type Role = typeof ROLES[number]['id'];

export default function RoleSelection({ userId, onRoleSelected }: RoleSelectionProps) {
  const [role, setRole] = useState<Role>('cliente');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage('');

    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ tipo: role })
        .eq('id', userId);

      if (error) throw error;

      if (role === 'proveedor') {
        const { error: providerError } = await supabase
          .from('perfiles_proveedor')
          .upsert({ usuario_id: userId }, { onConflict: 'usuario_id' });
        if (providerError) throw providerError;
      }

      onRoleSelected();
    } catch (error) {
      console.error('Error updating role:', error);
      setErrorMessage('No se pudo guardar el rol. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-quantum-card border border-white/10 rounded-3xl p-8 w-full max-w-sm text-white space-y-6">
        <div className="text-center">
          <div className="text-quantum-cyan text-4xl font-bold mb-1">Ω</div>
          <h2 className="text-xl font-bold">Selecciona tu Rol</h2>
          <p className="text-white/40 text-sm mt-1">Los roles administrativos se asignan desde UGO Admin</p>
        </div>

        <div className="space-y-3">
          {ROLES.map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setRole(id)}
              className={cn(
                'w-full p-4 rounded-2xl border text-left flex items-center gap-4 transition-all duration-200',
                role === id
                  ? 'border-quantum-cyan bg-quantum-cyan/10 shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              )}
            >
              <div className={cn(
                'p-2 rounded-xl',
                role === id ? 'bg-quantum-cyan/20 text-quantum-cyan' : 'bg-white/10 text-white/40'
              )}>
                <Icon size={20} />
              </div>
              <div>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-white/40">{description}</p>
              </div>
              {role === id && <div className="ml-auto w-2 h-2 rounded-full bg-quantum-cyan" />}
            </button>
          ))}
        </div>

        {errorMessage && <p className="text-red-400 text-xs text-center">{errorMessage}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-quantum-cyan text-black font-bold rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Continuar →'}
        </button>
      </div>
    </div>
  );
}
