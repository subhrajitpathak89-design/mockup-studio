"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Upload, Trash2, Plus } from "lucide-react";
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
import { CANVAS_PRESETS, type ProjectMeta } from "@/types";
import { deleteProject, listProjects } from "@/lib/project/persistence";
import { useProjectStore } from "@/store/projectStore";
import { screenActions } from "@/lib/project/actions";
import { readImageFile } from "@/lib/canvas/imageCache";
import { cn } from "@/lib/utils";

export function LandingScreen() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [pendingUpload, setPendingUpload] = useState<{
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  const openCreate = () => setOpen(true);

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
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center gap-2 text-sm font-medium">
          <Clapperboard className="size-5" />
          Mockup Motion Studio
        </header>

        <div className="flex flex-1 flex-col justify-center py-16">
          <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
            Turn your UI into motion.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
            Create polished product mockups and short UI animations without
            opening After Effects.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={openCreate}>
              <Plus /> Create Project
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => fileInput.current?.click()}
            >
              <Upload /> Upload UI
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
          </div>

          {projects.length > 0 ? (
            <section className="mt-16">
              <h2 className="text-sm font-medium text-muted-foreground">
                Recent projects
              </h2>
              <ul className="mt-3 divide-y divide-border rounded-lg border">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <button
                      className="flex-1 text-left"
                      onClick={async () => {
                        const ok = await useProjectStore.getState().openById(p.id);
                        if (ok) router.push("/editor");
                      }}
                    >
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                        {p.width} × {p.height} · {p.duration}s
                      </span>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${p.name}`}
                      onClick={async () => {
                        await deleteProject(p.id);
                        setProjects(await listProjects());
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

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
