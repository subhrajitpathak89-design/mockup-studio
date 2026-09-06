"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clapperboard, Film, ImageIcon, Plus, Trash2, Upload, Video } from "lucide-react";
import Aurora from "@/components/Aurora";
import { Button } from "@/components/ui/button";
import { TemplateGallery } from "@/components/projects/TemplateGallery";
import { deleteProject, listProjects } from "@/lib/project/persistence";
import { readImageFile } from "@/lib/canvas/imageCache";
import { screenActions } from "@/lib/project/actions";
import { useProjectStore } from "@/store/projectStore";
import type { Template } from "@/lib/project/templates";
import type { ProjectMeta } from "@/types";
import { cn } from "@/lib/utils";
import { useRef } from "react";

/**
 * The project chooser — the level above the editor.
 *
 * Deliberately its own route rather than a mode inside the editor: at this
 * level there is no scene to undo, zoom, preview or export, so showing the
 * editor's toolbar would offer controls that act on a project you are not
 * looking at.
 */
export function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  const open = async (id: string) => {
    const store = useProjectStore.getState();
    if (store.dirty) await store.save();
    const ok = await store.openById(id);
    if (ok) router.push("/editor");
  };

  const create = () => {
    const store = useProjectStore.getState();
    if (store.dirty) void store.save();
    store.newProject("Untitled Project", 1920, 1080);
    router.push("/editor");
  };

  /** A template is a whole scene, so starting from one is just opening it. */
  const startFromTemplate = async (template: Template) => {
    const store = useProjectStore.getState();
    if (store.dirty) await store.save();
    store.newProject(template.label, template.width, template.height);
    store.setProject({ duration: template.duration });
    store.patchScene(() => template.build(), "template.apply");
    router.push("/editor");
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { dataUrl, width, height } = await readImageFile(file);
      const store = useProjectStore.getState();
      if (store.dirty) await store.save();
      store.newProject("Untitled Project", 1920, 1080);
      screenActions.setImage(dataUrl, width, height);
      router.push("/editor");
    } catch {
      // Unsupported file; the editor gives fuller feedback than a toast here.
    }
  };

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      {/* The same shader as the landing page, so the two levels feel like one
          product rather than a site and a tool bolted together. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-45 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      >
        <Aurora colorStops={["#38bdf8", "#6366f1", "#a855f7"]} amplitude={0.9} blend={0.6} speed={0.5} />
      </div>

      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <Clapperboard className="size-5" />
            Framecast
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push("/record")}
            >
              <Video /> Record
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInput.current?.click()}
            >
              <Upload /> Upload
            </Button>
            <Button size="sm" onClick={create}>
              <Plus /> New project
            </Button>
          </div>
        </div>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => void upload(e.target.files?.[0])}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-10">
        <TemplateGallery onPick={(t) => void startFromTemplate(t)} />

        <div className="my-12 h-px bg-white/[0.07]" />

        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">My projects</h1>
          {projects.length > 0 ? (
            <span className="text-sm text-muted-foreground tabular-nums">
              {projects.length}
            </span>
          ) : null}
        </div>

        {loading ? null : projects.length === 0 ? (
          <div className="mt-16 flex flex-col items-center text-center">
            <ImageIcon className="size-8 text-muted-foreground/40" />
            <p className="mt-5 text-base font-medium">Nothing here yet</p>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground text-pretty">
              Record your screen or drop in a screenshot. Projects save
              themselves as you work and show up here.
            </p>
            <div className="mt-7 flex gap-3">
              <Button onClick={() => router.push("/record")}>
                <Video /> Record your screen
              </Button>
              <Button variant="outline" onClick={() => fileInput.current?.click()}>
                <Upload /> Upload a screenshot
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => void open(project.id)}
                onDelete={async () => {
                  await deleteProject(project.id);
                  refresh();
                }}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectMeta;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const portrait = project.height > project.width;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] transition-colors hover:border-white/20">
      <button
        onClick={onOpen}
        className="block w-full text-left"
        aria-label={`Open ${project.name}`}
      >
        <div className="relative aspect-video w-full overflow-hidden bg-black/40">
          {project.thumbnail ? (
            /* A data URL out of IndexedDB — next/image would only add a proxy
               round trip to something already local. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={project.thumbnail}
              alt=""
              className={cn(
                "size-full",
                portrait ? "object-contain" : "object-cover",
              )}
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageIcon className="size-6 text-muted-foreground/40" />
            </div>
          )}
        </div>

        <div className="px-3.5 py-3">
          <p className="truncate text-sm font-medium">{project.name}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
            <Film className="size-3 shrink-0" />
            {formatDuration(project.duration)}
            <span className="opacity-50">·</span>
            {project.width}×{project.height}
          </p>
        </div>
      </button>

      <button
        onClick={onDelete}
        aria-label={`Delete ${project.name}`}
        title={`Delete ${project.name}`}
        className="absolute right-2 top-2 rounded-lg bg-zinc-950/80 p-2 text-white opacity-0 backdrop-blur transition-all hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}
