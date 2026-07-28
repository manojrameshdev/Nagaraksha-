'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/api';

interface VoiceInputProps {
  onTranscript: (_transcriptText: string) => void;
  className?: string;
  buttonText?: string;
  size?: 'sm' | 'default' | 'lg';
}

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResultList {
  [index: number]: {
    [index: number]: SpeechRecognitionResultItem;
  };
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onresult: (_event: SpeechRecognitionEvent) => void;
  onerror: (_event: unknown) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

export function VoiceInput({
  onTranscript,
  className = '',
  buttonText = 'Voice In',
  size = 'sm',
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Web Speech API Fallback Initialization
  const startWebSpeechFallback = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognitionConstructor =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      toast.error('Browser speech recognition not supported. Please type your message.');
      return;
    }

    try {
      const recognition = new (
        SpeechRecognitionConstructor as new () => SpeechRecognitionInstance
      )();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'hi-IN'; // Default to Hindi/Indian English auto-detect

      recognition.onstart = () => {
        setIsRecording(true);
        toast.info('Listening in your local language… speak now!');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const rawResults = event.results as unknown as { transcript: string }[][];
        const transcript = rawResults[0]?.[0]?.transcript || '';
        onTranscript(transcript);
      };

      recognition.onerror = (_err: unknown) => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (_err: unknown) {
      toast.error('Could not start speech recognition.');
      setIsRecording(false);
    }
  }, [onTranscript]);

  const startRecording = async () => {
    setDetectedLang(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      startWebSpeechFallback();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 500) {
          toast.error('Audio clip too short. Please speak again.');
          return;
        }

        setIsProcessing(true);
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'voice_input.webm');

          const res = await fetch(apiUrl('/api/transcribe'), {
            method: 'POST',
            body: formData,
          });

          const data = await res.json();

          if (data.text) {
            onTranscript(data.text);
            if (data.language) {
              setDetectedLang(data.language);
            }
            toast.success(
              `Voice transcribed via Groq Whisper (${data.language || 'multilingual'})!`,
            );
          } else {
            // If backend key not configured, fallback to Web Speech
            toast.info('Groq API fallback to local browser voice recognition...');
            startWebSpeechFallback();
          }
        } catch (_err: unknown) {
          startWebSpeechFallback();
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Microphone active. Voice your details in any language!');
    } catch (_err: unknown) {
      startWebSpeechFallback();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {isRecording ? (
        <Button
          type="button"
          onClick={stopRecording}
          variant="destructive"
          size={size}
          className="h-9 gap-2 bg-[#FF4D4D] text-white hover:bg-[#d63838] animate-pulse rounded-xl font-bold shadow-lg"
        >
          <MicOff className="h-4 w-4" />
          Stop &amp; Transcribe
        </Button>
      ) : (
        <Button
          type="button"
          onClick={startRecording}
          disabled={isProcessing}
          variant="outline"
          size={size}
          className="h-9 gap-2 border-[rgba(43,182,115,0.4)] text-[#7fd6ad] hover:bg-[rgba(43,182,115,0.15)] bg-[rgba(8,20,15,0.6)] rounded-xl font-medium"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#2BB673]" />
          ) : (
            <Mic className="h-4 w-4 text-[#2BB673]" />
          )}
          {isProcessing ? 'Transcribing…' : buttonText}
        </Button>
      )}

      {detectedLang && (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#7fd6ad] bg-[rgba(43,182,115,0.1)] px-2 py-0.5 rounded-full border border-[rgba(43,182,115,0.2)]">
          <Globe className="h-2.5 w-2.5" /> {detectedLang.toUpperCase()}
        </span>
      )}
    </div>
  );
}
