'use client';
import { createContext, useContext, useState } from 'react';
import { CheckCircle2, X, Copy, Check } from 'lucide-react';
type Notice = { message: string; code?: string };
const FeedbackContext = createContext<(notice: Notice) => void>(() => {});
export function useClubFeedback() { return useContext(FeedbackContext); }
export function ClubFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copied, setCopied] = useState(false);
  return <FeedbackContext.Provider value={value => { setNotice(value); setCopied(false); }}>
    {children}
    {notice && <aside className="club-toast" role="status" aria-live="polite">
      <div className="flex items-start gap-3"><CheckCircle2 size={20} className="shrink-0 text-[#49774d]"/><div className="flex-1"><strong className="text-sm">Saved to your club workspace</strong><p className="subtext mt-2">{notice.message}</p></div><button aria-label="Dismiss confirmation" className="icon-button !p-0" onClick={() => setNotice(null)}><X size={17}/></button></div>
      {notice.code && <div className="mt-4 rounded-xl bg-[#e3ebdf] p-4"><p className="subtext">Your ticket code · keep it for the door</p><strong className="ticket-code">{notice.code}</strong><button className="button secondary small mt-3" onClick={async () => { try { await navigator.clipboard.writeText(notice.code!); setCopied(true); } catch { setCopied(false); } }}>{copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? 'Code copied' : 'Copy ticket code'}</button></div>}
    </aside>}
  </FeedbackContext.Provider>;
}
