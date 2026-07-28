'use client';

import { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  PenTool,
  MessageSquare,
  Copy,
  Sparkles,
  HelpCircle,
  Heart,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export function EmergencyGuide({ lat = 12.8003, lng = 77.5954 }: { lat?: number; lng?: number }) {
  const [activeTab, setActiveTab] = useState<'timer' | 'dos_donts' | 'swelling' | 'mimics' | 'sms'>(
    'timer',
  );

  // Timer State
  const [timerSeconds, setTimerSeconds] = useState(120); // 2-minute initial calm countdown
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [swellingIntervals, setSwellingIntervals] = useState<string[]>([]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const toggleTimer = () => setIsTimerRunning(!isTimerRunning);
  const resetTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(120);
  };

  const recordSwellingMark = () => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setSwellingIntervals((prev) => [...prev, `Marked at ${timeStr}`]);
    toast.success(`Swelling boundary recorded at ${timeStr}. Mark on victim's skin with a pen!`);
  };

  // SMS Payload Generator
  const generateSmsText = () => {
    return `EMERGENCY SNAKEBITE SOS! Location: https://maps.google.com/?q=${lat},${lng} (Lat: ${lat.toFixed(
      4,
    )}, Lng: ${lng.toFixed(
      4,
    )}). Victim immobilized. Please send Anti-Venom hospital transport / rescuer immediately. Sent via NagRaksha PWA.`;
  };

  const copySmsText = () => {
    navigator.clipboard.writeText(generateSmsText());
    toast.success('Offline SOS payload copied to clipboard!');
  };

  const sendWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(generateSmsText())}`;
    window.open(url, '_blank');
  };

  return (
    <div className="rounded-3xl border border-[rgba(234,243,237,0.12)] bg-[rgba(8,20,15,0.7)] p-5 md:p-7 shadow-2xl backdrop-blur-md">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[rgba(234,243,237,0.1)]">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7fd6ad]">
            <Sparkles className="h-4 w-4 text-[#2BB673]" /> Emergency First-Aid &amp; Gap Solution
            Suite
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-mist mt-1">
            Clinical First-Aid Protocol &amp; Disaster Resilience
          </h2>
        </div>
        <Badge className="bg-[rgba(214,158,46,0.15)] text-gold border border-[rgba(214,158,46,0.3)] px-3 py-1 font-mono text-xs">
          ICMR &amp; WHO 2026 Compliant
        </Badge>
      </div>

      {/* Feature Tabs */}
      <div className="flex overflow-x-auto gap-2 py-4 no-scrollbar border-b border-[rgba(234,243,237,0.08)]">
        {[
          { id: 'timer', label: 'Immobilize Timer', icon: Clock },
          { id: 'dos_donts', label: "Do's & Don'ts", icon: ShieldAlert },
          { id: 'swelling', label: 'Swelling Tracker', icon: PenTool },
          { id: 'mimics', label: 'Species Mimic Guide', icon: HelpCircle },
          { id: 'sms', label: 'Offline SMS SOS', icon: MessageSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-[#2BB673] text-[#051710] shadow-lg scale-105'
                  : 'bg-[#11231c] text-[#b8cbc1] hover:bg-[#1c2e26]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="pt-6">
        {/* TAB 1: IMMOBILIZATION TIMER */}
        {activeTab === 'timer' && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-[rgba(16,42,32,0.6)] p-6 border border-[rgba(43,182,115,0.2)] flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-center md:text-left">
                <span className="text-xs uppercase tracking-wider text-[#7fd6ad] font-mono">
                  Crucial Phase: Keep Heart Rate Below 60 BPM
                </span>
                <h3 className="text-2xl font-bold text-mist">Immobilise Limb &amp; Rest Quietly</h3>
                <p className="text-xs text-[#8fa39b] max-w-md">
                  Movement accelerates systemic venom absorption through lymph channels. Lay victim
                  down, immobilise leg/arm with a flat wooden splint or cloth binding.
                </p>
              </div>

              {/* Counter Display */}
              <div className="flex flex-col items-center justify-center p-6 bg-[#051710] rounded-2xl border border-[rgba(234,243,237,0.1)] min-w-[200px]">
                <div className="font-mono text-4xl font-extrabold text-[#2BB673]">
                  {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, '0')}
                </div>
                <span className="text-[10px] uppercase text-muted-foreground mt-1">
                  Calm Down Countdown
                </span>

                <div className="flex items-center gap-2 mt-4">
                  <Button
                    size="sm"
                    onClick={toggleTimer}
                    className="bg-[#2BB673] text-[#051710] hover:bg-[#239961] font-bold text-xs"
                  >
                    {isTimerRunning ? 'Pause' : 'Start Timer'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetTimer}
                    className="border-[rgba(234,243,237,0.15)] text-mist text-xs"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </div>

            {/* Step Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl bg-[#11231c] p-4 border border-[rgba(234,243,237,0.06)] flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[rgba(43,182,115,0.15)] text-[#7fd6ad]">
                  <Heart className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-mist">1. Reassure Victim</h4>
                  <p className="text-xs text-[#8fa39b] mt-1">
                    70% of bites in India are non-venomous or dry bites. Panic causes rapid venom
                    circulation.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-[#11231c] p-4 border border-[rgba(214,158,46,0.15)] text-gold">
                <div className="p-2 rounded-lg bg-[rgba(214,158,46,0.15)] text-gold">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-mist">2. Remove Rings &amp; Watches</h4>
                  <p className="text-xs text-[#8fa39b] mt-1">
                    Swelling starts rapidly. Tight items cause tourniquet-like tissue ischemia if
                    not removed early.
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-[#11231c] p-4 border border-[rgba(234,243,237,0.06)] flex items-start gap-3">
                <div className="p-2 rounded-lg bg-[rgba(229,72,77,0.15)] text-[#FF4D4D]">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-mist">3. Rapid Transport</h4>
                  <p className="text-xs text-[#8fa39b] mt-1">
                    Do not visit traditional healers. Only Polyvalent Anti-Snake Venom (ASV)
                    neutralizes venom.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DO'S AND DON'TS */}
        {activeTab === 'dos_donts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* DO'S */}
            <div className="rounded-2xl bg-[rgba(43,182,115,0.05)] border border-[rgba(43,182,115,0.2)] p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#7fd6ad] font-bold text-sm border-b border-[rgba(43,182,115,0.2)] pb-2">
                <CheckCircle2 className="h-5 w-5 text-[#2BB673]" />
                CLINICAL DO&apos;S (ICMR Recommended)
              </div>
              <ul className="space-y-2.5 text-xs text-[#bcd2c6]">
                <li className="flex items-start gap-2">
                  <span className="text-[#2BB673] font-bold">✓</span>
                  <span>
                    <strong>Keep victim still:</strong> Lay them on their side in recovery position
                    if unconscious.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#2BB673] font-bold">✓</span>
                  <span>
                    <strong>Immobilize limb:</strong> Use a splint or bandage loosely at heart
                    level.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#2BB673] font-bold">✓</span>
                  <span>
                    <strong>Mark swelling boundary:</strong> Draw a pen line around the swollen area
                    every 15 minutes with time stamp.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#2BB673] font-bold">✓</span>
                  <span>
                    <strong>Transport to ASV hospital:</strong> Call ahead or use NagRaksha hospital
                    router to find active ASV stock.
                  </span>
                </li>
              </ul>
            </div>

            {/* DON'TS */}
            <div className="rounded-2xl bg-[rgba(229,72,77,0.05)] border border-[rgba(229,72,77,0.2)] p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#ffb4ab] font-bold text-sm border-b border-[rgba(229,72,77,0.2)] pb-2">
                <XCircle className="h-5 w-5 text-[#FF4D4D]" />
                DANGEROUS MYTHS — NEVER DO THESE
              </div>
              <ul className="space-y-2.5 text-xs text-[#ffdada]">
                <li className="flex items-start gap-2">
                  <span className="text-[#FF4D4D] font-bold">✕</span>
                  <span>
                    <strong>DO NOT apply Tourniquet:</strong> Cuts off blood flow, leading to limb
                    amputation and sudden toxic surge when released.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF4D4D] font-bold">✕</span>
                  <span>
                    <strong>DO NOT Cut or Suck Wound:</strong> Introduces mouth infection and speeds
                    venom absorption into damaged tissue.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF4D4D] font-bold">✕</span>
                  <span>
                    <strong>DO NOT Apply Ice or Herbal Pastes:</strong> Causes severe tissue
                    frostbite/necrosis and delays hospital transport.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#FF4D4D] font-bold">✕</span>
                  <span>
                    <strong>DO NOT Give Aspirin/Alcohol:</strong> Aspirin worsens bleeding from
                    haemotoxic venom; alcohol speeds heart rate.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 3: SWELLING TRACKER */}
        {activeTab === 'swelling' && (
          <div className="rounded-2xl bg-[rgba(16,42,32,0.6)] p-6 border border-[rgba(214,158,46,0.2)] space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-mist">Bite Swelling Pen-Marking Guide</h3>
                <p className="text-xs text-[#8fa39b] mt-1">
                  Doctors evaluate envenomation speed by measuring how fast swelling climbs up the
                  limb.
                </p>
              </div>
              <Button
                onClick={recordSwellingMark}
                className="bg-[#D69E2E] text-[#051710] hover:bg-[#b88523] font-bold text-xs gap-2"
              >
                <PenTool className="h-4 w-4" /> Mark Boundary Now
              </Button>
            </div>

            <div className="rounded-xl bg-[#051710] p-4 border border-[rgba(234,243,237,0.08)]">
              <h4 className="text-xs font-bold text-[#7fd6ad] uppercase">
                Instructions for Responder / Bystander:
              </h4>
              <ol className="list-decimal list-inside text-xs text-[#bcd2c6] mt-2 space-y-1.5">
                <li>Take a permanent marker or ballpoint pen.</li>
                <li>
                  Draw a line directly on the skin at the highest visible edge of swelling/redness.
                </li>
                <li>Write the exact time next to the line (e.g. &quot;10:15 AM&quot;).</li>
                <li>
                  Repeat every 15 minutes. If swelling moves 2+ cm between marks, envenomation is
                  severe!
                </li>
              </ol>
            </div>

            {swellingIntervals.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-mist">Recorded Boundary Log:</span>
                <div className="flex flex-wrap gap-2">
                  {swellingIntervals.map((entry, idx) => (
                    <Badge
                      key={idx}
                      className="bg-[rgba(214,158,46,0.2)] text-gold border border-[rgba(214,158,46,0.4)] px-3 py-1 font-mono text-xs"
                    >
                      Line #{idx + 1}: {entry}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SPECIES MIMIC GUIDE */}
        {activeTab === 'mimics' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-mist">Critical Species Confusion Matrix</h3>
            <p className="text-xs text-[#8fa39b]">
              In rural India, harmless non-venomous snakes are often killed due to confusion with
              venomous species, while deadly kraits are mistaken for harmless wolf snakes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pair 1: Common Krait vs Wolf Snake */}
              <div className="rounded-xl bg-[#11231c] p-4 border border-[rgba(229,72,77,0.3)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#FF4D4D] uppercase">
                    Deadly vs Harmless Pair
                  </span>
                  <Badge variant="outline" className="text-gold border-gold/30 text-[10px]">
                    High Danger
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[rgba(229,72,77,0.1)] p-3 rounded-lg border border-[rgba(229,72,77,0.2)]">
                    <h5 className="font-bold text-[#ffb4ab]">Common Krait (Venomous)</h5>
                    <p className="text-[11px] text-[#e6efe9] mt-1">
                      • Paired thin white crossbands starting mid-body.
                      <br />
                      • Hexagonal enlarged scales along spine.
                      <br />• Highly nocturnal &amp; highly neurotoxic.
                    </p>
                  </div>
                  <div className="bg-[rgba(43,182,115,0.1)] p-3 rounded-lg border border-[rgba(43,182,115,0.2)]">
                    <h5 className="font-bold text-[#7fd6ad]">Common Wolf Snake (Harmless)</h5>
                    <p className="text-[11px] text-[#e6efe9] mt-1">
                      • Broad yellow/white bands starting right behind neck.
                      <br />
                      • Smooth rounded scales along spine.
                      <br />• Non-venomous gecko hunter.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pair 2: Cobra vs Rat Snake */}
              <div className="rounded-xl bg-[#11231c] p-4 border border-[rgba(214,158,46,0.3)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gold uppercase">Spectacle Hood Pair</span>
                  <Badge
                    variant="outline"
                    className="text-[#7fd6ad] border-[#7fd6ad]/30 text-[10px]"
                  >
                    Common
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-[rgba(229,72,77,0.1)] p-3 rounded-lg border border-[rgba(229,72,77,0.2)]">
                    <h5 className="font-bold text-[#ffb4ab]">Spectacled Cobra (Venomous)</h5>
                    <p className="text-[11px] text-[#e6efe9] mt-1">
                      • Flares wide hood with spectacle mark when cornered.
                      <br />
                      • Hisses loudly &amp; raises upper 1/3 of body.
                      <br />• Neurotoxic venom.
                    </p>
                  </div>
                  <div className="bg-[rgba(43,182,115,0.1)] p-3 rounded-lg border border-[rgba(43,182,115,0.2)]">
                    <h5 className="font-bold text-[#7fd6ad]">Indian Rat Snake (Harmless)</h5>
                    <p className="text-[11px] text-[#e6efe9] mt-1">
                      • Cannot flare hood.
                      <br />
                      • Extremely fast-moving, large body (up to 3 meters).
                      <br />• Non-venomous rodent predator.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: OFFLINE SMS SOS */}
        {activeTab === 'sms' && (
          <div className="rounded-2xl bg-[rgba(16,42,32,0.6)] p-6 border border-[rgba(43,182,115,0.2)] space-y-4">
            <div>
              <h3 className="text-lg font-bold text-mist">
                Zero-Internet Offline SOS Payload Generator
              </h3>
              <p className="text-xs text-[#8fa39b] mt-1">
                If 4G/WiFi is down in remote farmlands, send this structured SMS or WhatsApp string
                directly to village emergency contacts.
              </p>
            </div>

            <div className="bg-[#051710] p-4 rounded-xl border border-[rgba(234,243,237,0.1)] font-mono text-xs text-[#7fd6ad] break-all">
              {generateSmsText()}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={copySmsText}
                className="bg-[#2BB673] text-[#051710] hover:bg-[#239961] font-bold text-xs gap-2"
              >
                <Copy className="h-4 w-4" /> Copy SMS Text
              </Button>
              <Button
                onClick={sendWhatsApp}
                variant="outline"
                className="border-[rgba(43,182,115,0.4)] text-[#7fd6ad] hover:bg-[rgba(43,182,115,0.15)] font-bold text-xs gap-2"
              >
                <MessageSquare className="h-4 w-4" /> Send via WhatsApp
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
