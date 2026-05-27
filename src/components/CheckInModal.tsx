import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Zap, Heart, AlertCircle } from 'lucide-react';

export interface CheckInData {
  mood: number;
  hadUrge: boolean;
  urgeIntensity: number;
  triggerLabel: string;
  note?: string;
}

interface CheckInModalProps {
  trackName: string;
  dayNumber: number;
  onSubmit: (data: CheckInData) => void;
  onCancel: () => void;
}

const TRIGGER_KEYS = ['stress','boredom','social','loneliness','fatigue','anger','sadness','habit'] as const;

export function CheckInModal({ trackName, dayNumber, onSubmit, onCancel }: CheckInModalProps) {
  const { t } = useTranslation();
  const [mood, setMood] = useState(5);
  const [hadUrge, setHadUrge] = useState(false);
  const [urgeIntensity, setUrgeIntensity] = useState(3);
  const [triggerLabel, setTriggerLabel] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'mood' | 'urge' | 'trigger' | 'note'>('mood');

  const moodEmoji = (m: number) => {
    if (m <= 2) return '😣';
    if (m <= 4) return '😕';
    if (m <= 6) return '😐';
    if (m <= 8) return '🙂';
    return '😄';
  };

  const moodColor = (m: number) => {
    if (m <= 2) return 'text-rose-400';
    if (m <= 4) return 'text-orange-400';
    if (m <= 6) return 'text-yellow-400';
    if (m <= 8) return 'text-emerald-400';
    return 'text-cyan-400';
  };

  const handleSubmit = () => {
    onSubmit({ mood, hadUrge, urgeIntensity: hadUrge ? urgeIntensity : 0, triggerLabel, note: note.trim() || undefined });
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onCancel()}>
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', damping: 24, stiffness: 260 }} className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 pb-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-widest">{trackName}</p>
              <h2 className="text-white font-semibold text-lg">{t('checkin.title', { day: dayNumber })}</h2>
            </div>
            <button onClick={onCancel} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"><X size={16} className="text-white/70" /></button>
          </div>

          {step === 'mood' && (
            <motion.div key="mood" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-3"><Heart size={16} className="text-rose-400" /><span className="text-white/70 text-sm">{t('checkin.mood_label')}</span></div>
              <div className="text-center"><span className={`text-5xl font-black ${moodColor(mood)}`}>{mood}</span><span className="text-4xl ml-3">{moodEmoji(mood)}</span></div>
              <input type="range" min={1} max={10} value={mood} onChange={(e) => setMood(Number(e.target.value))} className="w-full accent-blue-500" />
              <div className="flex justify-between text-xs text-white/30"><span>{t('checkin.mood_low')}</span><span>{t('checkin.mood_high')}</span></div>
              <button onClick={() => setStep('urge')} className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors">{t('common.next')}</button>
            </motion.div>
          )}

          {step === 'urge' && (
            <motion.div key="urge" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-3"><Zap size={16} className="text-amber-400" /><span className="text-white/70 text-sm">{t('checkin.urge_question')}</span></div>
              <div className="flex gap-3">
                {[false, true].map((val) => (
                  <button key={String(val)} onClick={() => setHadUrge(val)} className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all border ${hadUrge === val ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'}`}>{val ? t('common.yes') : t('common.no')}</button>
                ))}
              </div>
              {hadUrge && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                  <p className="text-white/60 text-xs">{t('checkin.urge_intensity_label')}</p>
                  <div className="text-center"><span className="text-3xl font-black text-amber-400">{urgeIntensity}</span><span className="text-white/40 text-sm ml-1">/10</span></div>
                  <input type="range" min={0} max={10} value={urgeIntensity} onChange={(e) => setUrgeIntensity(Number(e.target.value))} className="w-full accent-amber-500" />
                </motion.div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setStep('mood')} className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors">{t('common.back')}</button>
                <button onClick={() => setStep(hadUrge ? 'trigger' : 'note')} className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors">{t('common.next')}</button>
              </div>
            </motion.div>
          )}

          {step === 'trigger' && (
            <motion.div key="trigger" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="flex items-center gap-2 mb-3"><AlertCircle size={16} className="text-purple-400" /><span className="text-white/70 text-sm">{t('checkin.trigger_label')}</span></div>
              <div className="grid grid-cols-2 gap-2">
                {TRIGGER_KEYS.map((key) => (
                  <button key={key} onClick={() => setTriggerLabel(triggerLabel === key ? '' : key)} className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all border ${triggerLabel === key ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'}`}>{t(`checkin.triggers.${key}`)}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep('urge')} className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors">{t('common.back')}</button>
                <button onClick={() => setStep('note')} className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors">{t('common.next')}</button>
              </div>
            </motion.div>
          )}

          {step === 'note' && (
            <motion.div key="note" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <p className="text-white/70 text-sm">{t('checkin.note_label')}</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('checkin.note_placeholder')} rows={3} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-blue-500 placeholder:text-white/30" />
              <div className="flex gap-2">
                <button onClick={() => setStep(hadUrge ? 'trigger' : 'urge')} className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-colors">{t('common.back')}</button>
                <button onClick={handleSubmit} className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors">{t('checkin.submit')}</button>
              </div>
            </motion.div>
          )}

          <div className="flex justify-center gap-1.5 mt-5">
            {(['mood', 'urge', 'trigger', 'note'] as const).map((s) => (<div key={s} className={`h-1 rounded-full transition-all ${s === step ? 'w-6 bg-blue-500' : 'w-1.5 bg-white/20'}`} />))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export { CheckInModal as CheckInRichModal };
