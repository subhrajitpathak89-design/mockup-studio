"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Clapperboard,
  Upload,
  Video,
  MonitorPlay,
  Wand2,
  Download,
  Scissors,
  Layers,
  ShieldCheck,
} from "lucide-react";
import Aurora from "@/components/Aurora";
import BlurText from "@/components/BlurText";
import ShinyText from "@/components/ShinyText";
import SpotlightCard from "@/components/SpotlightCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CANVAS_PRESETS } from "@/types";
import { useProjectStore } from "@/store/projectStore";
import { screenActions } from "@/lib/project/actions";
import { readImageFile } from "@/lib/canvas/imageCache";
import { cn } from "@/lib/utils";

export function LandingScreen() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = await readImageFile(file);
      setPendingUpload({
        dataUrl: result.dataUrl,
        width: result.width,
        height: result.height,
      });
      setOpen(true);
    } catch {
      // Silently ignore unsupported files; the editor gives fuller feedback.
    }
  };

  return (
    <main className="min-h-dvh bg-background">
      <SiteNav onOpenEditor={() => router.push("/projects")} />

      <Hero
        onRecord={() => router.push("/record")}
        onUpload={() => fileInput.current?.click()}
      />

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleUpload(e.target.files?.[0])}
      />

      <CapabilityStrip />
      <Features />
      <HowItWorks />

      <ClosingCta onRecord={() => router.push("/record")} />
      <SiteFooter />

      <CreateProjectDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setPendingUpload(null);
        }}
        onCreate={(name, width, height) => {
          useProjectStore.getState().newProject(name, width, height);
          if (pendingUpload) {
            screenActions.setImage(
              pendingUpload.dataUrl,
              pendingUpload.width,
              pendingUpload.height,
            );
          }
          router.push("/editor");
        }}
      />
    </main>
  );
}

function SiteNav({ onOpenEditor }: { onOpenEditor: () => void }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-background/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <a href="#top" className="flex items-center gap-2 font-semibold">
          <Clapperboard className="size-5" />
          Framecast
        </a>
        <div className="hidden gap-7 text-sm text-muted-foreground sm:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
        </div>
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={onOpenEditor}>
            My projects
          </Button>
        </div>
      </nav>
    </header>
  );
}

function Hero({
  onRecord,
  onUpload,
}: {
  onRecord: () => void;
  onUpload: () => void;
}) {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* The shader sits behind everything and fades out before the copy
          starts, so the headline never has to fight it for contrast. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-16 h-[620px] opacity-70 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      >
        <Aurora colorStops={["#38bdf8", "#6366f1", "#a855f7"]} amplitude={1.1} blend={0.6} speed={0.7} />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs">
            <Video className="size-3.5 text-sky-400" />
            <ShinyText text="Now records your screen" speed={4} />
          </span>

          {/* BlurText renders a paragraph, so the real heading stays for
              assistive tech and the animated copy is decoration. */}
          <h1 className="sr-only">Capture it. Frame it. Ship it.</h1>
          <div aria-hidden className="mt-7">
            <BlurText
              text="Capture it. Frame it. Ship it."
              animateBy="words"
              delay={90}
              className="justify-center text-5xl font-semibold tracking-tight text-balance sm:text-7xl"
            />
          </div>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground text-pretty">
            Record a flow or drop in a screenshot, put it inside an animated
            device mockup, and export a demo worth shipping — without opening
            After Effects.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={onRecord}>
              <Video /> Record your screen
            </Button>
            <Button size="lg" variant="outline" onClick={onUpload}>
              <Upload /> Upload a screenshot
            </Button>
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            Runs entirely in your browser. No account, no upload, no watermark.
          </p>
        </div>

        <HeroShot />
      </div>
    </section>
  );
}

/** The editor itself, sat on a glow so it reads as the product, not a banner. */
function HeroShot() {
  const ref = useRef<HTMLDivElement>(null);

  /**
   * The shot starts tilted away and settles flat as you scroll — the product
   * standing up to meet you rather than sitting there as a flat rectangle.
   *
   * Driven from a scroll listener rather than a CSS scroll-timeline: those are
   * still Chromium-only, and this is the first thing anyone sees.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Anyone who has asked for less motion gets the settled frame, full stop.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (still.matches) return;

    let frame = 0;
    const apply = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      // The shot already sits high on first paint, so the range runs almost to
      // the top of the viewport — otherwise it arrives nearly settled and the
      // whole effect is invisible.
      const start = window.innerHeight;
      const end = window.innerHeight * 0.1;
      const progress = Math.min(
        1,
        Math.max(0, (start - rect.top) / Math.max(1, start - end)),
      );
      // Smoothstep rather than ease-out: the middle of the travel is the part
      // anyone actually watches.
      const eased = progress * progress * (3 - 2 * progress);
      el.style.transform = `perspective(1600px) rotateX(${(1 - eased) * 12}deg) scale(${0.92 + eased * 0.08})`;
      // Never starts truly faded — this is the first thing on the page.
      el.style.opacity = String(0.78 + eased * 0.22);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="relative mt-16">
      <div
        aria-hidden
        className="absolute -inset-x-10 -top-8 bottom-10 rounded-[3rem] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.30),transparent_70%)] blur-2xl"
      />
      <div
        ref={ref}
        style={{ transformOrigin: "50% 100%", willChange: "transform" }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/5"
      >
        <Image
          src="/shots/editor.png"
          alt="The Framecast editor: a dashboard screenshot inside a MacBook frame, with the scene panel and timeline"
          width={1560}
          height={940}
          priority
          className="w-full"
        />
      </div>
    </div>
  );
}

const CAPABILITIES = [
  { icon: MonitorPlay, label: "Screen, window or tab" },
  { icon: Layers, label: "Four device frames" },
  { icon: Wand2, label: "Animation presets" },
  { icon: Download, label: "MP4, WebM, GIF, PNG" },
];

function CapabilityStrip() {
  return (
    <section className="border-y border-white/[0.06] bg-white/[0.015]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 sm:grid-cols-4">
        {CAPABILITIES.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center justify-center gap-2.5 py-5 text-sm text-muted-foreground"
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </div>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Video,
    title: "Record in the browser",
    body: "Capture a screen, window or tab with your microphone and system audio. Stop, trim the ends, and it opens as a project with the recording already in the frame.",
    spotlight: "rgba(56, 189, 248, 0.16)" as const,
  },
  {
    icon: Scissors,
    title: "Trim without re-encoding",
    body: "Cut the fumbling off both ends while you still remember what you recorded. Trim is stored, never applied, so you can widen it again later.",
    spotlight: "rgba(168, 85, 247, 0.16)" as const,
  },
  {
    icon: Download,
    title: "Export what you need",
    body: "MP4 and WebM carry your audio. GIF and PNG are rendered frame by frame, so their timing is exact rather than best effort.",
    spotlight: "rgba(52, 211, 153, 0.16)" as const,
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-24">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-sky-400">Everything in one place</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight text-balance">
          A recorder and a mockup studio, not two tabs.
        </h2>
        <p className="mt-4 text-muted-foreground text-pretty">
          Most recorders hand you a raw file and leave the presentation to you.
          Framecast treats the capture as the beginning of the shot.
        </p>
      </div>

      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <SpotlightCard
            key={f.title}
            spotlightColor={f.spotlight}
            className="h-full rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7"
          >
            <f.icon className="size-5 text-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground text-pretty">
              {f.body}
            </p>
          </SpotlightCard>
        ))}
      </div>

      <div className="mt-20 space-y-20">
        <Showcase
          eyebrow="Record"
          title="Hit record, get a project."
          body="Pick your audio, hit record, and the browser hands you its picker. Stop and you trim the ends while you still remember what you captured — then it opens in the editor, already inside a device."
          shot="/shots/record.png"
          alt="The Framecast recording screen, with microphone, system audio and countdown toggles"
        />
        <Showcase
          reversed
          eyebrow="Export"
          title="Four formats, honest timing."
          body="Video records in real time, so a six second animation takes about six seconds — and if the machine cannot keep up, the export says so instead of quietly handing back a mistimed file."
          shot="/shots/export.png"
          alt="The Framecast export dialog offering PNG, WebM, MP4 and GIF with resolution and frame rate options"
        />
      </div>
    </section>
  );
}

/** A screenshot and its explanation, alternating sides down the page. */
function Showcase({
  eyebrow,
  title,
  body,
  shot,
  alt,
  reversed = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  shot: string;
  alt: string;
  reversed?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <div className={cn(reversed && "lg:order-2")}>
        <p className="text-sm font-medium text-sky-400">{eyebrow}</p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h3>
        <p className="mt-4 leading-relaxed text-muted-foreground text-pretty">
          {body}
        </p>
      </div>
      <div className={cn("relative", reversed && "lg:order-1")}>
        <div
          aria-hidden
          className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_50%,rgba(99,102,241,0.18),transparent_70%)] blur-xl"
        />
        <div className="relative overflow-hidden rounded-xl border border-white/[0.09] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
          <Image src={shot} alt={alt} width={1560} height={940} className="w-full" />
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Capture or upload",
    body: "Record the flow you want to show, or drop in a screenshot you already have.",
  },
  {
    n: "02",
    title: "Frame it",
    body: "Pick a device, rotate it in 3D, set a background and light it. The frame is drawn procedurally, so it stays sharp at any export size.",
  },
  {
    n: "03",
    title: "Animate and export",
    body: "Apply a motion preset, add captions, scrub the timeline, then export at 720p or 1080p.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="border-t border-white/[0.06] bg-white/[0.015]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="max-w-xl text-4xl font-semibold tracking-tight text-balance">
          Three steps, one tab.
        </h2>
        <ol className="mt-12 grid gap-10 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n}>
              <div className="font-mono text-sm text-sky-400">{s.n}</div>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ClosingCta({ onRecord }: { onRecord: () => void }) {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_100%_at_50%_100%,rgba(99,102,241,0.18),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-2xl px-6 py-24 text-center">
        <h2 className="text-4xl font-semibold tracking-tight text-balance">
          Your next demo is one recording away.
        </h2>
        <p className="mt-4 text-muted-foreground text-pretty">
          Nothing to install, nothing to sign up for. Your recordings stay on
          your machine.
        </p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={onRecord}>
            <Video /> Record your screen
          </Button>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Clapperboard className="size-4" />
          Framecast
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <ShieldCheck className="size-3.5" />
          Recordings never leave your browser
        </div>
        <span aria-hidden className="hidden opacity-30 sm:inline">
          ·
        </span>
        <div>
          Built by <span className="text-foreground">Subhrajit</span>
        </div>
      </div>
    </footer>
  );
}

function CreateProjectDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, width: number, height: number) => void;
}) {
  const [name, setName] = useState("Untitled Project");
  const [presetId, setPresetId] = useState("16:9");
  const [custom, setCustom] = useState({ width: 1920, height: 1080 });

  const isCustom = presetId === "custom";
  const preset = CANVAS_PRESETS.find((p) => p.id === presetId);
  const width = isCustom ? custom.width : (preset?.width ?? 1920);
  const height = isCustom ? custom.height : (preset?.height ?? 1080);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Pick a canvas size. You can change it later in the editor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Canvas</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {CANVAS_PRESETS.map((p) => (
                <PresetTile
                  key={p.id}
                  active={presetId === p.id}
                  onClick={() => setPresetId(p.id)}
                  title={p.ratio}
                  subtitle={`${p.width}×${p.height}`}
                />
              ))}
              <PresetTile
                active={isCustom}
                onClick={() => setPresetId("custom")}
                title="Custom"
                subtitle="Set size"
              />
            </div>
          </div>

          {isCustom ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="w">Width</Label>
                <Input
                  id="w"
                  type="number"
                  value={custom.width}
                  onChange={(e) =>
                    setCustom((c) => ({ ...c, width: clampSize(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="h">Height</Label>
                <Input
                  id="h"
                  type="number"
                  value={custom.height}
                  onChange={(e) =>
                    setCustom((c) => ({ ...c, height: clampSize(e.target.value) }))
                  }
                />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button onClick={() => onCreate(name || "Untitled Project", width, height)}>
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PresetTile({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-2.5 text-left transition-colors",
        active
          ? "border-primary bg-accent"
          : "border-border hover:border-foreground/30",
      )}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-[11px] text-muted-foreground tabular-nums">
        {subtitle}
      </div>
    </button>
  );
}

function clampSize(raw: string) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1920;
  return Math.min(4096, Math.max(120, Math.round(n)));
}
