import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Mail, CheckCircle, Clock, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AccountabilityPair } from '../types';

interface AccountabilityCardProps {
  pairs: AccountabilityPair[];
  onSendInvite: (email: string, shareStreak: boolean, shareMood: boolean) => Promise<void>;
}

export function AccountabilityCard({ pairs, onSendInvite }: AccountabilityCardProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [shareStreak, setShareStreak] = useState(true);
  const [shareMood, setShareMood] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim() || !email.includes('@')) return;
    setLoading(true);
    await onSendInvite(email.trim(), shareStreak, shareMood);
    setLoading(false);
    setSent(true);
    setEmail('');
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
          <Users size={18} className="text-blue-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-sm">{t('accountability.title')}</h3>
          <p className="text-white/40 text-xs">{t('accountability.privacy_note')}</p>
        </div>
      </div>
      {pairs.length > 0 && (
        <div className="space-y-2">
          {pairs.map((pair) => (
            <div key={pair.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
              <div className={`w-2 h-2 rounded-full ${pair.status === 'accepted' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-white/70 text-sm flex-1">{pair.partner_email}</span>
              <span className="text-xs text-white/40">
                {pair.status === 'accepted' ? <CheckCircle size={12} className="text-emerald-400 inline" /> : <Clock size={12} className="text-amber-400 inline" />}
                {' '}{t(`accountability.${pair.status}` as const)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3">
            <Mail size={14} className="text-white/30 shrink-0" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('accountability.email_placeholder')} className="flex-1 bg-transparent text-white text-sm py-2.5 focus:outline-none placeholder:text-white/30" onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
          </div>
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div key="sent" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="px-3 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle size={14} className="text-emerald-400" />
              </motion.div>
            ) : (
              <motion.button key="btn" onClick={handleSend} disabled={loading || !email.includes('@')} className="px-3 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold disabled:opacity-40 hover:bg-blue-500 transition-colors">
                {loading ? '...' : t('accountability.send_invite')}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <div className="flex gap-3">
          {[
            { key: 'share_streak', value: shareStreak, set: setShareStreak },
            { key: 'share_mood', value: shareMood, set: setShareMood },
          ].map(({ key, value, set }) => (
            <button key={key} onClick={() => set(!value)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${value ? 'bg-blue-500/15 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-white/40'}`}>
              <Shield size={11} />
              {t(`accountability.${key}` as const)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
