'use client';

import { useState } from 'react';
import { ShaderBackground } from '@/components/shader-background';
import { TopAppBar, NavigationDrawer, SiteFooter } from '@/components/sections';
import {
  LiveSosDemo,
  MythBuster,
  KnowledgeBasePanel,
  StatsStrip,
  SnakeIdUpload,
  AuditTrailPanel,
  OutboxPanel,
  HospitalStockConsole,
  SymptomLogger,
} from '@/components/interactive';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function Page() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<
    'sos' | 'responder' | 'hospital' | 'myth' | 'snake_id' | 'admin'
  >('sos');

  return (
    <div className="relative flex min-h-screen flex-col bg-[#051710] font-[Lexend] text-[#d2e7dc] selection:bg-[#2BB673] selection:text-[#051710]">
      {/* Background Snake Scale Pattern & WebGL Fragment Shader */}
      <div className="fixed inset-0 bg-pattern-snake pointer-events-none z-0" />
      <ShaderBackground />

      {/* Top Header & Navigation Drawer */}
      <TopAppBar
        onToggleDrawer={() => setDrawerOpen((prev) => !prev)}
        activeRole={activeRole}
        onSelectRole={(r) => setActiveRole(r as typeof activeRole)}
      />
      <NavigationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSelectRole={(r) => setActiveRole(r as typeof activeRole)}
      />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 pt-24 pb-28 px-4 md:px-8 max-w-6xl mx-auto w-full">
        {/* Role Quick Selector Tabs (Mobile / Sub-header) */}
        <div className="flex lg:hidden overflow-x-auto gap-2 pb-4 mb-4 border-b border-[rgba(234,243,237,0.1)] no-scrollbar">
          {[
            { id: 'sos', label: 'Victim SOS' },
            { id: 'responder', label: 'Responder' },
            { id: 'hospital', label: 'Hospitals' },
            { id: 'myth', label: 'AI Myth Buster' },
            { id: 'snake_id', label: 'Snake ID' },
            { id: 'admin', label: 'Analytics' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveRole(tab.id as typeof activeRole)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeRole === tab.id
                  ? 'bg-[#2BB673] text-[#051710]'
                  : 'bg-[#11231c] text-[#b8cbc1] hover:bg-[#1c2e26]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* -------------------- VIEW 1: VICTIM SOS HOME -------------------- */}
        {activeRole === 'sos' && (
          <div className="space-y-6">
            {/* Status Row: Area & Monsoon Risk */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#1c2e26] rounded-2xl p-5 outline-luminous flex items-start gap-4">
                <div className="p-3 bg-[#11231c] rounded-xl text-[#b1cdbe]">
                  <span className="material-symbols-outlined text-2xl">my_location</span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#8c928e] font-semibold mb-1">
                    Current Area
                  </p>
                  <h2 className="text-xl font-bold text-mist">
                    Western Ghats Sector 4 · Bengaluru Rural
                  </h2>
                  <p className="text-xs text-[#8fa39b] mt-1">High-density agricultural zone</p>
                </div>
              </div>

              <div className="bg-[#1c2e26] rounded-2xl p-5 outline-luminous flex items-start gap-4 border-l-4 border-[#ffb4ab]">
                <div className="p-3 bg-[#93000a] text-[#ffdad6] rounded-xl">
                  <span className="material-symbols-outlined text-2xl">warning</span>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-[#8c928e] font-semibold mb-1">
                    Risk Level
                  </p>
                  <h2 className="text-xl font-bold text-[#ffb4ab]">High / Monsoon Advisory</h2>
                  <p className="text-xs text-[#c2c8c3] mt-1">
                    Increased Russell&apos;s Viper & Cobra activity reported in wet underbrush.
                  </p>
                </div>
              </div>
            </div>

            {/* Central SOS Trigger & Dispatch Stream */}
            <LiveSosDemo />

            {/* Secondary Bento Grid Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setActiveRole('snake_id')}
                className="bg-[#1c2e26] hover:bg-[#273831] transition-all rounded-2xl p-6 outline-luminous flex flex-col justify-between h-40 text-left border-l-2 border-[#b8cbc1] group"
              >
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-[#0a1a14] text-[#b8cbc1] rounded-xl">
                    <span className="material-symbols-outlined text-2xl">search</span>
                  </div>
                  <span className="material-symbols-outlined text-[#8c928e] group-hover:text-mist transition-colors">
                    arrow_forward
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-mist">Identify Snake Species</h3>
                  <p className="text-xs text-[#8fa39b] mt-1">
                    AI photo camera classification & venom disclaimers
                  </p>
                </div>
              </button>

              <button
                onClick={() => setActiveRole('myth')}
                className="bg-[#1c2e26] hover:bg-[#273831] transition-all rounded-2xl p-6 outline-luminous flex flex-col justify-between h-40 text-left border-l-2 border-[#b8cbc1] group"
              >
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-[#0a1a14] text-[#b8cbc1] rounded-xl">
                    <span className="material-symbols-outlined text-2xl">healing</span>
                  </div>
                  <span className="material-symbols-outlined text-[#8c928e] group-hover:text-mist transition-colors">
                    arrow_forward
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-mist">First Aid & AI Myth Buster</h3>
                  <p className="text-xs text-[#8fa39b] mt-1">
                    Grounded medical facts, do&apos;s, and don&apos;ts
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* -------------------- VIEW 2: RESPONDER DASHBOARD -------------------- */}
        {activeRole === 'responder' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-mist">Responder Dashboard</h2>
              <p className="text-sm text-[#8fa39b]">Village First Responders & Rescue Teams</p>
            </div>

            {/* Active Urgent Incident Card */}
            <div className="bg-[#1c2e26] rounded-2xl p-6 border-l-4 border-[#FF4D4D] urgent-glow space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 text-[#ffb4ab]">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Critical Priority Alert
                  </span>
                </div>
                <Badge className="bg-[#FF4D4D] text-white font-bold text-xs uppercase px-3 py-1">
                  SOS Active
                </Badge>
              </div>

              <div>
                <h3 className="text-xl font-bold text-mist">
                  Snakebite Emergency · Bannerghatta Rural
                </h3>
                <p className="text-sm text-[#c2c8c3] mt-1 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#2BB673]" /> 2.4 km away · Sector 4 Playground
                </p>
                <p className="text-xs text-[#8fa39b] mt-2">
                  Bystander reported suspected Spectacled Cobra bite 4 mins ago. Victim immobilized.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Button className="h-12 bg-[#2BB673] hover:bg-[#239961] text-[#051710] font-bold text-sm rounded-xl gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Accept Dispatch
                </Button>
                <Button
                  variant="outline"
                  className="h-12 border-[rgba(234,243,237,0.15)] text-mist hover:bg-[rgba(234,243,237,0.06)] text-sm rounded-xl"
                >
                  Decline / Re-route
                </Button>
              </div>
            </div>

            {/* Structured Symptom Logger */}
            <div className="bg-[#1c2e26] rounded-2xl p-6 outline-luminous">
              <h3 className="text-lg font-bold text-mist mb-1">First Responder Symptom Logger</h3>
              <p className="text-xs text-[#8fa39b] mb-4">
                Log observations directly for pre-arrival hospital handoff
              </p>
              <SymptomLogger incidentId="NR-1042" />
            </div>
          </div>
        )}

        {/* -------------------- VIEW 3: HOSPITAL & ANTIVENOM CONSOLE -------------------- */}
        {activeRole === 'hospital' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-mist">Hospital & Antivenom Registry</h2>
              <p className="text-sm text-[#8fa39b]">
                Live hospital inventory management & shortest-path Dijkstra ranking
              </p>
            </div>

            <HospitalStockConsole />
          </div>
        )}

        {/* -------------------- VIEW 4: AI MYTH BUSTER (RAG) -------------------- */}
        {activeRole === 'myth' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-mist">AI Myth Buster (NagRaksha Mitra)</h2>
              <p className="text-sm text-[#8fa39b]">
                Curated RAG knowledge base for snakebite first-aid and myth debunking
              </p>
            </div>

            <MythBuster />
          </div>
        )}

        {/* -------------------- VIEW 5: SNAKE PHOTO ID -------------------- */}
        {activeRole === 'snake_id' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-mist">Snake Photo Identification (CV)</h2>
              <p className="text-sm text-[#8fa39b]">
                Smartphone camera classification with confidence scoring & disclaimers
              </p>
            </div>

            <SnakeIdUpload />
          </div>
        )}

        {/* -------------------- VIEW 6: ADMIN ANALYTICS -------------------- */}
        {activeRole === 'admin' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold text-mist">Platform Analytics & Audit Log</h2>
              <p className="text-sm text-[#8fa39b]">
                Real-time operational stats, transactional outbox worker, and RAG corpus
              </p>
            </div>

            <StatsStrip />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AuditTrailPanel />
              <OutboxPanel />
            </div>

            <KnowledgeBasePanel />
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center h-20 px-4 bg-[#051710]/95 backdrop-blur-md border-t border-[rgba(234,243,237,0.1)] lg:hidden">
        <button
          onClick={() => setActiveRole('sos')}
          className={`flex flex-col items-center justify-center px-4 py-2 rounded-full transition-all ${
            activeRole === 'sos'
              ? 'bg-[#FF4D4D] text-white font-bold shadow-lg scale-105'
              : 'text-[#b8cbc1]'
          }`}
        >
          <span className="material-symbols-outlined text-2xl">campaign</span>
          <span className="text-[10px] mt-0.5">Emergency</span>
        </button>

        <button
          onClick={() => setActiveRole('responder')}
          className={`flex flex-col items-center justify-center px-4 py-2 rounded-full transition-all ${
            activeRole === 'responder'
              ? 'bg-[#2BB673] text-[#051710] font-bold shadow-lg scale-105'
              : 'text-[#b8cbc1]'
          }`}
        >
          <span className="material-symbols-outlined text-2xl">medical_services</span>
          <span className="text-[10px] mt-0.5">Responder</span>
        </button>

        <button
          onClick={() => setActiveRole('hospital')}
          className={`flex flex-col items-center justify-center px-4 py-2 rounded-full transition-all ${
            activeRole === 'hospital'
              ? 'bg-[#D69E2E] text-[#051710] font-bold shadow-lg scale-105'
              : 'text-[#b8cbc1]'
          }`}
        >
          <span className="material-symbols-outlined text-2xl">location_on</span>
          <span className="text-[10px] mt-0.5">Hospitals</span>
        </button>

        <button
          onClick={() => setActiveRole('myth')}
          className={`flex flex-col items-center justify-center px-4 py-2 rounded-full transition-all ${
            activeRole === 'myth'
              ? 'bg-[#b8cbc1] text-[#051710] font-bold shadow-lg scale-105'
              : 'text-[#b8cbc1]'
          }`}
        >
          <span className="material-symbols-outlined text-2xl">psychology</span>
          <span className="text-[10px] mt-0.5">Chatbot</span>
        </button>
      </nav>

      <SiteFooter />
    </div>
  );
}
