"use client";

import { useEffect, useState, type ChangeEvent, type DragEvent } from "react";
import { WorkspaceIcon } from "../components/workspace-icon";
import styles from "./materials.module.css";
import { createSupabaseBrowserClient } from "../../utils/supabase/browser";

type Extraction = {
  title: string;
  kind: string;
  summary: string;
  sections: { heading: string; content: string }[];
  key_terms: { term: string; definition: string }[];
};
type Material = {
  id: string;
  name: string;
  size: string;
  course: string;
  added: string;
  status: "uploading" | "uploaded" | "processing" | "ready" | "failed";
  content: Extraction | null;
  error: string | null;
  attempts: number;
};
type LibraryRow = {
  id: string; file_name: string; size_bytes: number; created_at: string;
  courses: { name: string } | null;
  file_extractions: {
    status: "processing" | "ready" | "failed"; content: Extraction | null;
    error: string | null; updated_at: string; attempts: number;
  } | null;
};
const mimeTypes: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
};
const maxFileSize = 2 * 1024 * 1024;

async function loadMaterials(): Promise<Material[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("files")
    .select("id, file_name, size_bytes, created_at, courses(name), file_extractions(status, content, error, updated_at, attempts)")
    .order("created_at", { ascending: false }).returns<LibraryRow[]>();
  if (error) throw new Error("Could not load your library. Please refresh and try again.");
  return (data ?? []).map(file => {
    const extraction = file.file_extractions;
    const interrupted = extraction?.status === "processing" && Date.now() - Date.parse(extraction.updated_at) > 180_000;
    return {
      id: file.id, name: file.file_name, size: formatSize(file.size_bytes),
      added: new Date(file.created_at).toLocaleDateString(), course: file.courses?.name ?? "Unassigned",
      status: interrupted ? "failed" : extraction?.status ?? "uploaded", content: extraction?.content ?? null,
      error: interrupted ? "Processing was interrupted. Please retry." : extraction?.error ?? null,
      attempts: extraction?.attempts ?? 0,
    };
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MaterialsContent() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Extraction | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaterials().then(items => { if (!cancelled) setMaterials(items); })
      .catch(() => { if (!cancelled) setError("Could not load your library. Check your connection and Supabase setup, then refresh."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const hasProcessing = materials.some(material => material.status === "processing");
  useEffect(() => {
    if (!hasProcessing) return;
    let cancelled = false;
    const timer = setInterval(() => {
      loadMaterials().then(items => {
        if (!cancelled) setMaterials(current => current.map(item =>
          item.status === "uploading" ? item : items.find(saved => saved.id === item.id) ?? item));
      }).catch(() => { /* A transient polling failure is retried on the next tick. */ });
    }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [hasProcessing]);

  function updateMaterial(id: string, patch: Partial<Material>) {
    setMaterials(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  async function processMaterial(id: string) {
    updateMaterial(id, { status: "processing", error: null });
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: invokeError } = await supabase.functions.invoke("process-study-material", { body: { file_id: id } });
      if (invokeError) {
        let message = "Could not process this material. Please retry.";
        if (invokeError.context instanceof Response) {
          const body = await invokeError.context.json().catch(() => null);
          if (typeof body?.error === "string") message = body.error;
        }
        throw new Error(message);
      }
      if (!data?.extraction) throw new Error("No processing result was returned. Please retry.");
      const extraction = data.extraction;
      updateMaterial(id, { status: extraction.status, content: extraction.content,
        error: extraction.error, attempts: extraction.attempts });
    } catch (cause) {
      // Check persisted state: a lost HTTP response does not mean the worker failed.
      try {
        const saved = (await loadMaterials()).find(item => item.id === id);
        if (saved && (saved.status === "ready" || saved.status === "processing")) {
          updateMaterial(id, saved);
          return;
        }
        if (saved) updateMaterial(id, saved);
      } catch { /* Display the original processing error. */ }
      updateMaterial(id, { status: "failed", error: cause instanceof Error ? cause.message : "Processing failed. Please retry." });
    }
  }

  async function addFiles(files: FileList | File[]) {
    setError("");
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!mimeTypes[extension] || file.size === 0 || file.size > maxFileSize) {
        rejected.push(`${file.name}: use a nonempty PDF, DOCX, DOC, JPEG, or PNG file up to 2 MB.`);
        continue;
      }
      const id = crypto.randomUUID();
      setMaterials(current => [{ id, name: file.name, size: formatSize(file.size), course: "Unassigned",
        added: "Just now", status: "uploading", content: null, error: null, attempts: 0 }, ...current]);
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) throw new Error("Please sign in before uploading files.");
        const path = `${user.id}/${id}/source.${extension}`;
        const { error: uploadError } = await supabase.storage.from("study-materials").upload(path, file, { contentType: mimeTypes[extension] });
        if (uploadError) throw new Error("Could not upload this file. Check your connection and storage setup.");
        const { error: insertError } = await supabase.from("files").insert({
          id, user_id: user.id, file_name: file.name, mime_type: mimeTypes[extension], size_bytes: file.size,
          storage_path: path, kind: "other",
        });
        if (insertError) {
          await supabase.storage.from("study-materials").remove([path]);
          throw new Error("Could not save the file record. Please check your profile and try again.");
        }
        updateMaterial(id, { status: "uploaded" });
        await processMaterial(id);
      } catch (cause) {
        setMaterials(current => current.filter(item => item.id !== id));
        rejected.push(`${file.name}: ${cause instanceof Error ? cause.message : "Upload failed."}`);
      }
    }
    if (rejected.length) setError(rejected.join(" "));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files) {
      addFiles(event.currentTarget.files);
      event.currentTarget.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!isLoading) void addFiles(event.dataTransfer.files);
  }

  return (
    <div className={styles.materialsPage}>
      <div className={styles.pageHeading}>
        <h1>Your notes, a clearer starting point.</h1>
        <p>Share notes and coursework with your AI study agent.</p>
      </div>

      <div className={styles.topGrid}>
        <section className={styles.uploadCard} aria-labelledby="upload-heading">
          <h2 id="upload-heading">Add study materials</h2>
          <div
            className={`${styles.dropZone}${isDragging ? ` ${styles.dragging}` : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsDragging(false);
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <span className={styles.uploadIcon}><WorkspaceIcon name="upload" /></span>
            <strong>Drop your files here, or browse</strong>
            <span className={styles.fileTypes}>PDF, DOCX, DOC, JPEG, or PNG · Up to 2 MB per file</span>
            <label className={styles.browseButton} htmlFor="study-material-files">Browse files</label>
            <input
              accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
              className={styles.fileInput}
              id="study-material-files"
              multiple
              onChange={handleFileChange}
              disabled={isLoading}
              type="file"
            />
          </div>
          {error ? (
            <p className={styles.uploadMessage} role="alert">{error}</p>
          ) : (
            <p className={styles.privacyNote}>
              <span aria-hidden="true">♙</span>
              Your files are stored privately and sent to OpenAI to extract study content.
            </p>
          )}
        </section>

        <aside className={styles.agentCard} aria-labelledby="agent-heading">
          <h2 id="agent-heading">Meet your study agent</h2>
          <WorkspaceIcon name="sparkle" />
          <p>Add your materials and StudyGo will help you understand them, one topic at a time.</p>
          <ul>
            <li>Organize key concepts</li>
            <li>Build practice questions</li>
            <li>Spot areas to revisit</li>
          </ul>
          <small>AI can make mistakes. Always check guidance against your course materials.</small>
        </aside>
      </div>

      <section className={styles.libraryCard} aria-labelledby="library-heading">
        <div className={styles.libraryHeading}>
          <h2 id="library-heading">Your library</h2>
          <p>{isLoading ? "Loading your library…" : `${materials.length} materials in your library`}</p>
        </div>
        <div className={styles.tableScroller}>
          <table className={styles.materialTable}>
            <thead>
              <tr>
                <th scope="col">Material</th>
                <th scope="col">Course</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && materials.length === 0 && <tr><td colSpan={4}>Upload your first study material to get started.</td></tr>}
              {materials.map((material) => (
                <tr key={material.id}>
                  <td>
                    <span className={styles.fileCell}>
                      <span className={styles.documentIcon}><WorkspaceIcon name="quiz" /></span>
                      <span>
                        <strong>{material.name}</strong>
                        <small>{material.size} · {material.added}</small>
                      </span>
                    </span>
                  </td>
                  <td>{material.course}</td>
                  <td>
                    <span className={`${styles.statusPill}${material.status !== "ready" ? ` ${styles.selected}` : ""}`}>
                      {material.status === "uploaded" ? "Uploaded" : material.status.charAt(0).toUpperCase() + material.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    {material.status === "ready" && material.content && (
                      <button type="button" className={styles.actionButton} onClick={() => setSelected(material.content)}>View content</button>
                    )}
                    {(material.status === "failed" || material.status === "uploaded") && material.attempts < 3 && (
                      <button type="button" className={styles.actionButton} onClick={() => void processMaterial(material.id)}>Retry processing</button>
                    )}
                    {material.error && <small className={styles.errorText}>{material.error}</small>}
                    {material.status === "failed" && material.attempts >= 3 && <small className={styles.errorText}>Attempt limit reached. Try uploading a smaller or clearer file.</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {selected && (
        <section className={styles.extractionCard} aria-label="Extracted study content">
          <button type="button" className={styles.actionButton} onClick={() => setSelected(null)}>Close content</button>
          <h2>{selected.title}</h2>
          <p>{selected.summary}</p>
          {selected.sections.map((section, index) => <div key={index}><h3>{section.heading}</h3><p>{section.content}</p></div>)}
          {selected.key_terms.length > 0 && <><h3>Key terms</h3><dl>{selected.key_terms.map((term, index) => <div key={index}><dt>{term.term}</dt><dd>{term.definition}</dd></div>)}</dl></>}
        </section>
      )}
    </div>
  );
}
