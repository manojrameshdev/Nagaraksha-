'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bot, Languages, Loader2, Mic, Send, Square, Volume2 } from 'lucide-react';
import { listIncidents, sendChat, transcribeAudio, type ChatMessage } from '@/lib/nagraksha';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const LANGUAGES = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'te', label: 'Telugu (తెలుగు)' },
  { code: 'ml', label: 'Malayalam (മലയാളം)' },
  { code: 'bn', label: 'Bengali (বাংলা)' },
  { code: 'mr', label: 'Marathi (मराठी)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)' },
];

const SUGGESTIONS = [
  'Is a tourniquet safe after a bite?',
  'What should I do right after a snakebite?',
  'Where is the ambulance?',
  'Should I suck the venom out?',
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function GrokChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [language, setLanguage] = useState('auto');
  const [voiceOn, setVoiceOn] = useState(false);
  const [incidentId, setIncidentId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Track the latest incident so the assistant can answer "where is the ambulance?".
  useEffect(() => {
    let cancelled = false;
    listIncidents(1)
      .then(({ incidents }) => {
        if (!cancelled && incidents.length > 0) setIncidentId(incidents[0].id);
      })
      .catch(() => {
        /* backend offline — chat still works without live status */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function speak(text: string, lang: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const code = lang === 'auto' ? 'en-IN' : lang;
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang.toLowerCase().startsWith(code.split('-')[0].toLowerCase())) ?? null;
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? (lang === 'auto' ? 'en-IN' : lang);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  async function handleSend(text: string) {
    const question = text.trim();
    if (!question || loading || transcribing) return;
    const next = [...messages, { role: 'user' as const, content: question }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError(null);
    setEmergency(false);
    const resolvedLang = language === 'auto' ? undefined : language;
    try {
      const res = await sendChat(next, {
        incidentId: incidentId ?? undefined,
        language: resolvedLang,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }]);
      setEmergency(res.emergency);
      if (voiceOn) speak(res.reply, res.language || resolvedLang || 'en');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat failed — try again.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice input is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        await handleTranscribe(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setError(null);
    } catch {
      setError('Microphone access was denied.');
    }
  }

  async function handleTranscribe(blob: Blob) {
    setTranscribing(true);
    setError(null);
    try {
      const b64 = await blobToBase64(blob);
      const res = await transcribeAudio(b64, language === 'auto' ? undefined : language);
      if (res.text) {
        setInput(res.text);
        if (res.language && res.language !== 'auto' && language === 'auto') {
          setLanguage(res.language);
        }
      } else {
        setError(res.error ?? 'Could not hear you — please try again.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transcription failed — try again.');
    } finally {
      setTranscribing(false);
    }
  }

  const resolvedLang = language === 'auto' ? 'en' : language;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold">NagRaksha Mitra</h2>
            <p className="text-xs text-muted-foreground">AI assistant · powered by Grok (xAI)</p>
          </div>
        </div>
        {incidentId && (
          <span className="rounded-full border border-primary/25 bg-secondary px-3 py-1 text-[10px] font-bold tracking-[0.1em] text-primary">
            LIVE DISPATCH · {incidentId}
          </span>
        )}
      </div>

      <div
        className="mt-4 flex max-h-72 min-h-40 flex-col gap-3 overflow-y-auto rounded-lg bg-muted/40 p-4"
        aria-live="polite"
      >
        {messages.length === 0 && !error && (
          <div className="my-auto text-center">
            <p className="text-sm font-medium">
              Ask about snakes, myths, first aid — or where the ambulance is.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-6',
              m.role === 'user'
                ? 'self-end bg-primary text-primary-foreground'
                : 'self-start border border-border bg-card',
            )}
          >
            {m.content}
            {m.role === 'assistant' && (
              <button
                type="button"
                onClick={() => speak(m.content, resolvedLang)}
                aria-label="Play this reply aloud"
                className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
              >
                <Volume2 className="size-3" aria-hidden="true" />
                Listen
              </button>
            )}
          </div>
        ))}
        {(loading || transcribing) && (
          <div className="flex items-center gap-2 self-start rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {transcribing ? 'Listening…' : 'Thinking…'}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {emergency && (
        <div className="mt-3 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>This looks like an emergency. Trigger SOS now and get to a hospital — do not wait.</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-muted-foreground">
          <Languages className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent text-sm font-semibold text-foreground outline-none"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => setVoiceOn((v) => !v)}
          aria-pressed={voiceOn}
          className={cn('min-h-9', voiceOn && 'border-primary/60 text-primary')}
        >
          <Volume2 className="size-4" aria-hidden="true" />
          {voiceOn ? 'Voice on' : 'Voice off'}
        </Button>
        <Button
          type="button"
          variant={recording ? 'destructive' : 'outline'}
          onClick={toggleRecording}
          disabled={transcribing}
          aria-label={recording ? 'Stop recording' : 'Speak your question'}
          className="min-h-9"
        >
          {recording ? (
            <>
              <Square className="size-4" aria-hidden="true" />
              Stop
            </>
          ) : (
            <>
              <Mic className="size-4" aria-hidden="true" />
              Speak
            </>
          )}
        </Button>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
      >
        <label className="sr-only" htmlFor="grok-chat-input">
          Ask NagRaksha Mitra
        </label>
        <input
          id="grok-chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about snake safety, myths, first aid…"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-ring"
        />
        <Button
          type="submit"
          disabled={loading || transcribing || !input.trim()}
          className="min-h-11"
          aria-label="Send message"
        >
          <Send aria-hidden="true" />
          Send
        </Button>
      </form>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        AI guidance only — never a substitute for a doctor. If someone is bitten, trigger SOS and go
        to the nearest hospital immediately.
      </p>
    </section>
  );
}
