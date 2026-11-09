"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { WorkspaceIcon } from "../components/workspace-icon";
import styles from "./materials.module.css";
import { tryUnlockAward } from "../../utils/awards";
import { createSupabaseBrowserClient } from "../../utils/supabase/browser";

type Extraction = {
  title: string;
  kind: string;
  summary: string;
  sections: { heading: string; content: string }[];
  key_terms: { term: string; definition: string }[];
};
type Course = {
  id: string;
  code: string;
  name: string;
  term: string;
  status: string;
};
type Material = {
  id: string;
  name: string;
  storagePath: string;
  size: string;
  courseId: string | null;
  course: string;
  tags: string[];
  added: string;
  status: "uploading" | "uploaded" | "processing" | "ready" | "failed";
  content: Extraction | null;
  error: string | null;
  attempts: number;
};
type LibraryRow = {
  id: string; course_id: string | null; file_name: string; storage_path: string; size_bytes: number; created_at: string;
  tags: string[] | null;
  courses: { name: string } | null;
  file_extractions: {
    status: "processing" | "ready" | "failed"; content: Extraction | null;
    error: string | null; updated_at: string; attempts: number;
  } | null;
};
type PendingUpload = {
  id: string;
  file: File;
  courseId: string | null;
};
type ConfirmDialog = {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};
const mimeTypes: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
};
const maxFileSize = 2 * 1024 * 1024;

function courseLabel(course: Pick<Course, "code" | "name" | "term">) {
  return [course.code, course.name, course.term].filter(Boolean).join(" · ");
}

async function loadCourses(): Promise<Course[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("courses")
    .select("id, code, name, term, status")
    .order("name", { ascending: true })
    .returns<Course[]>();
  if (error) throw new Error("Could not load your courses. Please refresh and try again.");
  return data ?? [];
}

async function loadMaterials(): Promise<Material[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("files")
    .select("id, course_id, file_name, storage_path, size_bytes, created_at, tags, courses(name), file_extractions(status, content, error, updated_at, attempts)")
    .order("created_at", { ascending: false }).returns<LibraryRow[]>();
  if (error) throw new Error("Could not load your library. Please refresh and try again.");
  return (data ?? []).map(file => {
    const extraction = file.file_extractions;
    const interrupted = extraction?.status === "processing" && Date.now() - Date.parse(extraction.updated_at) > 180_000;
    return {
      id: file.id, name: file.file_name, storagePath: file.storage_path, size: formatSize(file.size_bytes),
      added: new Date(file.created_at).toLocaleDateString(),
      courseId: file.course_id, course: file.courses?.name ?? "Unassigned",
      tags: file.tags ?? [],
      status: interrupted ? "failed" : extraction?.status ?? "uploaded", content: extraction?.content ?? null,
      error: interrupted ? "Processing was interrupted. Please retry." : extraction?.error ?? null,
      attempts: extraction?.attempts ?? 0,
    };
  });
}

function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MaterialsContent() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<{ fileId: string; content: Extraction; tags: string[]; mode: "view" | "edit" } | null>(null);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [contentNotice, setContentNotice] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingUpload[]>([]);
  const [addingCourseForId, setAddingCourseForId] = useState<string | null>(null);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState("all");
  const [courseSort, setCourseSort] = useState<"newest" | "name-asc" | "name-desc">("newest");
  const [tagFilter, setTagFilter] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const assigningIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    loadMaterials()
      .then(items => { if (!cancelled) setMaterials(items); })
      .catch(() => { if (!cancelled) setError("Could not load your library. Check your connection and Supabase setup, then refresh."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    loadCourses()
      .then(courseList => { if (!cancelled) setCourses(courseList); })
      .catch(() => { if (!cancelled) setError("Could not load your courses. Check your connection and Supabase setup, then refresh."); });
    return () => { cancelled = true; };
  }, []);

  const hasProcessing = materials.some(material => material.status === "processing");
  const tagFilters = tagFilter
    .split(",")
    .map(tag => normalizeTag(tag).toLowerCase())
    .filter(Boolean);
  const visibleMaterials = materials
    .filter(material => {
      if (courseFilter === "unassigned" && material.courseId !== null) return false;
      if (courseFilter !== "all" && courseFilter !== "unassigned" && material.courseId !== courseFilter) return false;
      if (tagFilters.length === 0) return true;
      const materialTags = material.tags.map(tag => tag.toLowerCase());
      return tagFilters.every(tag => materialTags.some(materialTag => materialTag.includes(tag)));
    })
    .sort((left, right) => {
      if (courseSort === "newest") return 0;
      const byName = left.course.localeCompare(right.course, undefined, { sensitivity: "base" });
      return courseSort === "name-asc" ? byName : -byName;
    });
  const libraryCount = isLoading
    ? "Loading your library…"
    : `${visibleMaterials.length} material${visibleMaterials.length === 1 ? "" : "s"} in your library`;
  useEffect(() => {
    if (!hasProcessing) return;
    let cancelled = false;
    const timer = setInterval(() => {
      loadMaterials().then(items => {
        if (!cancelled) setMaterials(current => current.map(item => {
          if (item.status === "uploading" || assigningIds.current.has(item.id)) return item;
          return items.find(saved => saved.id === item.id) ?? item;
        }));
      }).catch(() => { /* A transient polling failure is retried on the next tick. */ });
    }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [hasProcessing]);

  function updateMaterial(id: string, patch: Partial<Material>) {
    setMaterials(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  async function assignCourse(id: string, courseId: string | null) {
    const course = courses.find(item => item.id === courseId);
    const previous = materials.find(item => item.id === id);
    if (!previous || previous.status === "processing" || previous.courseId === courseId) return;
    assigningIds.current.add(id);
    setAssigningId(id);
    updateMaterial(id, { courseId, course: course ? course.name : "Unassigned" });
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: assignError } = await supabase.rpc("assign_file_course", {
        p_file_id: id,
        p_course_id: courseId,
      });
      if (assignError) throw new Error("Could not assign this course. Please try again.");
      setError("");
    } catch (cause) {
      updateMaterial(id, { courseId: previous.courseId, course: previous.course });
      setError(cause instanceof Error ? cause.message : "Could not assign this course. Please try again.");
    } finally {
      assigningIds.current.delete(id);
      setAssigningId(current => current === id ? null : current);
    }
  }

  function requestConfirm(message: string, onConfirm: () => void, confirmLabel = "Confirm") {
    setConfirmDialog({ message, confirmLabel, onConfirm });
  }

  function deleteMaterial(material: Material) {
    if (deletingId || material.status === "uploading" || material.status === "processing") return;

    requestConfirm(
      `Delete "${material.name}" and its extracted study content? This cannot be undone.`,
      () => {
        void (async () => {
          setDeletingId(material.id);
          setError("");
          try {
            const supabase = createSupabaseBrowserClient();
            const { data, error: deleteError } = await supabase
              .from("files")
              .delete()
              .eq("id", material.id)
              .select("id")
              .maybeSingle();

            if (deleteError) throw new Error(`Could not delete this material: ${deleteError.message}`);
            if (!data) throw new Error("Could not delete this material. It may have already been removed.");

            setMaterials(current => current.filter(item => item.id !== material.id));
            setSelected(current => current?.fileId === material.id ? null : current);

            const { error: storageError } = await supabase.storage
              .from("study-materials")
              .remove([material.storagePath]);
            if (storageError) {
              setError(
                `The material was removed from your library, but its uploaded file could not be removed from storage: ${storageError.message}`,
              );
              return;
            }
            setError("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not delete this material. Please try again.");
          } finally {
            setDeletingId(null);
          }
        })();
      },
      "Delete",
    );
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

  function openContent(material: Material, mode: "view" | "edit") {
    if (material.status !== "ready" || !material.content) return;
    setContentNotice("");
    setTagDraft("");
    setSelected({
      fileId: material.id,
      mode,
      tags: [...material.tags],
      content: {
        ...structuredClone(material.content),
        sections: material.content.sections.map(section => ({ ...section })),
        key_terms: material.content.key_terms.map(term => ({ ...term })),
      },
    });
  }

  function addTag() {
    if (!selected) return;
    const tag = normalizeTag(tagDraft);
    if (!tag) return;
    if (tag.length > 40) {
      setError("Each tag must be 40 characters or fewer.");
      return;
    }
    if (selected.tags.some(existing => existing.toLowerCase() === tag.toLowerCase())) {
      setTagDraft("");
      return;
    }
    if (selected.tags.length >= 20) {
      setError("A file can have at most 20 tags.");
      return;
    }
    setContentNotice("");
    setError("");
    setSelected({ ...selected, tags: [...selected.tags, tag] });
    setTagDraft("");
  }

  function removeTag(tag: string) {
    setContentNotice("");
    setSelected(current => current
      ? { ...current, tags: current.tags.filter(existing => existing !== tag) }
      : current);
  }

  function updateDraft(patch: Partial<Extraction>) {
    setContentNotice("");
    setSelected(current => current ? { ...current, content: { ...current.content, ...patch } } : current);
  }

  function updateSection(index: number, patch: Partial<Extraction["sections"][number]>) {
    setContentNotice("");
    setSelected(current => {
      if (!current) return current;
      return {
        ...current,
        content: {
          ...current.content,
          sections: current.content.sections.map((section, sectionIndex) => (
            sectionIndex === index ? { ...section, ...patch } : section
          )),
        },
      };
    });
  }

  async function saveContent() {
    if (!selected || isSavingContent) return;
    const content = selected.content;
    if (!content.title.trim() || !content.summary.trim() || content.sections.some(section => !section.heading.trim() || !section.content.trim())) {
      setError("Add a title, summary, and text for every section before saving.");
      return;
    }
    setIsSavingContent(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: saveError } = await supabase.rpc("update_file_extraction_content", {
        p_file_id: selected.fileId,
        p_content: content,
      });
      if (saveError) throw new Error("Could not save this study content. Please try again.");
      const { data: savedTags, error: tagsError } = await supabase.rpc("update_file_tags", {
        p_file_id: selected.fileId,
        p_tags: selected.tags,
      });
      if (tagsError) throw new Error("Could not save these tags. Please try again.");
      const tags = Array.isArray(savedTags) ? savedTags as string[] : selected.tags;
      updateMaterial(selected.fileId, { content, tags });
      setSelected(current => current ? { ...current, tags } : current);
      setError("");
      setContentNotice("Saved.");
    } catch (cause) {
      setContentNotice("");
      setError(cause instanceof Error ? cause.message : "Could not save this study content. Please try again.");
    } finally {
      setIsSavingContent(false);
    }
  }

  function assignPendingCourse(id: string, courseId: string | null) {
    setPendingFiles(current => current.map(item => item.id === id ? { ...item, courseId } : item));
  }

  async function confirmNewCourse(pendingId: string) {
    if (isSavingCourse) return;
    const name = newCourseName.trim();
    if (!name) return;
    const existing = courses.find(course => course.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      assignPendingCourse(pendingId, existing.id);
      setAddingCourseForId(null);
      setNewCourseName("");
      return;
    }
    setIsSavingCourse(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in before adding a course.");
      const { data, error: insertError } = await supabase.from("courses")
        .insert({ name, user_id: user.id })
        .select("id, code, name, term, status")
        .single();
      if (insertError) throw new Error(`Could not add this course: ${insertError.message}`);
      if (!data) throw new Error("Could not add this course. Please try again.");
      setCourses(current => [...current, data].sort((left, right) => left.name.localeCompare(right.name)));
      assignPendingCourse(pendingId, data.id);
      setAddingCourseForId(null);
      setNewCourseName("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this course. Please try again.");
    } finally {
      setIsSavingCourse(false);
    }
  }

  async function addFiles(files: FileList | File[], course: Course | null) {
    setError("");
    const rejected: string[] = [];
    const failed: File[] = [];
    for (const file of Array.from(files)) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!mimeTypes[extension] || file.size === 0 || file.size > maxFileSize) {
        rejected.push(`${file.name}: use a nonempty PDF, DOCX, DOC, JPEG, or PNG file up to 2 MB.`);
        continue;
      }
      const id = crypto.randomUUID();
      setMaterials(current => [{ id, name: file.name, size: formatSize(file.size), courseId: null, course: "Unassigned",
        tags: [], storagePath: "", added: "Just now", status: "uploading", content: null, error: null, attempts: 0 }, ...current]);
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
        let assigned = !course;
        if (course) {
          const { error: assignError } = await supabase.rpc("assign_file_course", {
            p_file_id: id,
            p_course_id: course.id,
          });
          assigned = !assignError;
          if (assignError) rejected.push(`${file.name}: the file uploaded, but the course could not be assigned.`);
        }
        updateMaterial(id, {
          status: "uploaded",
          storagePath: path,
          courseId: assigned && course ? course.id : null,
          course: assigned && course ? course.name : "Unassigned",
        });
        void tryUnlockAward("unlock_file_upload_award");
        await processMaterial(id);
      } catch (cause) {
        setMaterials(current => current.filter(item => item.id !== id));
        failed.push(file);
        rejected.push(`${file.name}: ${cause instanceof Error ? cause.message : "Upload failed."}`);
      }
    }
    if (rejected.length) setError(rejected.join(" "));
    return failed;
  }

  function stageFiles(files: FileList | File[]) {
    const accepted: PendingUpload[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!mimeTypes[extension] || file.size === 0 || file.size > maxFileSize) {
        rejected.push(`${file.name}: use a nonempty PDF, DOCX, DOC, JPEG, or PNG file up to 2 MB.`);
        continue;
      }
      accepted.push({ id: crypto.randomUUID(), file, courseId: null });
    }
    if (accepted.length) {
      setPendingFiles(accepted);
      setAddingCourseForId(null);
      setNewCourseName("");
    }
    setError(rejected.join(" "));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.currentTarget.files?.length) {
      stageFiles(event.currentTarget.files);
      event.currentTarget.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!isLoading && event.dataTransfer.files.length) stageFiles(event.dataTransfer.files);
  }

  async function uploadPendingFile(pendingId: string) {
    const pending = pendingFiles.find(item => item.id === pendingId);
    if (!pending || uploadingId || addingCourseForId || isSavingCourse) return;
    const course = courses.find(item => item.id === pending.courseId) ?? null;
    setUploadingId(pendingId);
    setPendingFiles(current => current.filter(item => item.id !== pendingId));
    try {
      const failed = await addFiles([pending.file], course);
      if (failed.length) {
        setPendingFiles(current => [
          ...current,
          { id: pendingId, file: pending.file, courseId: pending.courseId },
        ]);
      }
    } finally {
      setUploadingId(null);
    }
  }

  function assignCourseToAllPending(courseId: string | null) {
    if (!pendingFiles.length || uploadingId || addingCourseForId || isSavingCourse) return;
    const courseName = courseId
      ? courses.find(course => course.id === courseId)?.name ?? "this course"
      : "Unassigned";
    const count = pendingFiles.length;
    requestConfirm(
      `Assign ${courseName} to all ${count} pending file${count === 1 ? "" : "s"}?`,
      () => {
        setPendingFiles(current => current.map(item => ({ ...item, courseId })));
      },
      "Assign",
    );
  }

  function uploadAllPendingFiles() {
    if (!pendingFiles.length || uploadingId || addingCourseForId || isSavingCourse) return;
    const queue = [...pendingFiles];
    const count = queue.length;
    requestConfirm(
      `Upload all ${count} pending file${count === 1 ? "" : "s"} now?`,
      () => {
        void (async () => {
          setPendingFiles([]);
          setUploadingId("all");
          const failed: PendingUpload[] = [];
          try {
            for (const pending of queue) {
              const course = courses.find(item => item.id === pending.courseId) ?? null;
              const rejected = await addFiles([pending.file], course);
              if (rejected.length) {
                failed.push({ id: pending.id, file: pending.file, courseId: pending.courseId });
              }
            }
            if (failed.length) setPendingFiles(current => [...current, ...failed]);
          } finally {
            setUploadingId(null);
          }
        })();
      },
      "Upload all",
    );
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
              disabled={isLoading || uploadingId !== null}
              type="file"
            />
          </div>
          {pendingFiles.length > 0 && (
            <>
              <div className={styles.pendingBulkActions}>
                <select
                  aria-label="Assign course to all pending files"
                  className={styles.pendingCourseSelect}
                  disabled={uploadingId !== null || addingCourseForId !== null || isSavingCourse}
                  onChange={(event) => {
                    const value = event.target.value;
                    event.currentTarget.value = "";
                    if (!value) return;
                    assignCourseToAllPending(value === "unassigned" ? null : value);
                  }}
                  value=""
                >
                  <option value="">Assign course to all…</option>
                  <option value="unassigned">Unassigned</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
                <button
                  className={styles.browseButton}
                  disabled={uploadingId !== null || addingCourseForId !== null || isSavingCourse}
                  onClick={() => void uploadAllPendingFiles()}
                  type="button"
                >
                  {uploadingId === "all" ? "Uploading…" : "Upload all"}
                </button>
              </div>
              <ul className={styles.pendingUploadList}>
                {pendingFiles.map(pending => {
                  const busy = uploadingId !== null || isSavingCourse;
                  const addingCourse = addingCourseForId === pending.id;
                  return (
                    <li className={styles.pendingUpload} key={pending.id}>
                      <span className={styles.pendingFileName}>{pending.file.name}</span>
                      {addingCourse ? (
                        <>
                          <input
                            aria-label={`New course name for ${pending.file.name}`}
                            autoFocus
                            className={styles.pendingCourseName}
                            disabled={busy}
                            onChange={(event) => setNewCourseName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void confirmNewCourse(pending.id);
                              }
                            }}
                            placeholder="Course name"
                            value={newCourseName}
                          />
                          <button
                            className={styles.browseButton}
                            disabled={isSavingCourse || !newCourseName.trim()}
                            onClick={() => void confirmNewCourse(pending.id)}
                            type="button"
                          >
                            {isSavingCourse ? "Saving…" : "Save course"}
                          </button>
                          <button
                            className={styles.actionButton}
                            disabled={isSavingCourse}
                            onClick={() => {
                              setAddingCourseForId(null);
                              setNewCourseName("");
                            }}
                            type="button"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <select
                          aria-label={`Course for ${pending.file.name}`}
                          className={styles.pendingCourseSelect}
                          disabled={busy || addingCourseForId !== null}
                          onChange={(event) => {
                            if (event.target.value === "new") {
                              setAddingCourseForId(pending.id);
                              setNewCourseName("");
                              return;
                            }
                            assignPendingCourse(pending.id, event.target.value || null);
                          }}
                          value={pending.courseId ?? ""}
                        >
                          <option value="">Select course (optional)</option>
                          {courses.map(course => (
                            <option key={course.id} value={course.id}>{course.name}</option>
                          ))}
                          <option value="new">Create new course</option>
                        </select>
                      )}
                      <button
                        className={styles.browseButton}
                        disabled={busy || addingCourseForId !== null}
                        onClick={() => void uploadPendingFile(pending.id)}
                        type="button"
                      >
                        {uploadingId === pending.id ? "Uploading…" : "Upload file"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
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

      <aside className={styles.libraryCard} aria-labelledby="library-heading">
        <div className={styles.libraryHeading}>
          <h2 id="library-heading">Your library</h2>
          <p>{libraryCount}</p>
          <div className={styles.libraryControls}>
            <select
              aria-label="Filter by course"
              className={styles.libraryControl}
              onChange={(event) => setCourseFilter(event.target.value)}
              value={courseFilter}
            >
              <option value="all">All courses</option>
              <option value="unassigned">Unassigned</option>
              {courses.map(course => {
                const sharedName = courses.filter(item => item.name === course.name).length > 1;
                return (
                  <option key={course.id} value={course.id}>
                    {sharedName ? courseLabel(course) : course.name}
                  </option>
                );
              })}
            </select>
            <select
              aria-label="Sort by course name"
              className={styles.libraryControl}
              onChange={(event) => setCourseSort(event.target.value as "newest" | "name-asc" | "name-desc")}
              value={courseSort}
            >
              <option value="newest">Newest first</option>
              <option value="name-asc">Course name A–Z</option>
              <option value="name-desc">Course name Z–A</option>
            </select>
            <input
              aria-label="Filter by tags"
              className={`${styles.libraryControl} ${styles.tagFilter}`}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="Tags, comma-separated"
              value={tagFilter}
            />
          </div>
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
              {!isLoading && materials.length > 0 && visibleMaterials.length === 0 && <tr><td colSpan={4}>No materials match these filters.</td></tr>}
              {visibleMaterials.map((material) => (
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
                  <td>
                    <select
                      aria-label={`Course for ${material.name}`}
                      className={styles.courseSelect}
                      disabled={material.status === "uploading" || material.status === "processing" || assigningId === material.id}
                      onChange={(event) => void assignCourse(material.id, event.target.value || null)}
                      value={material.courseId ?? ""}
                    >
                      <option value="">Unassigned</option>
                      {material.courseId && !courses.some(course => course.id === material.courseId) && (
                        <option value={material.courseId}>{material.course}</option>
                      )}
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>{courseLabel(course)}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`${styles.statusPill}${material.status !== "ready" ? ` ${styles.selected}` : ""}`}>
                      {material.status === "uploaded" ? "Uploaded" : material.status.charAt(0).toUpperCase() + material.status.slice(1)}
                    </span>
                  </td>
                  <td>
                    {material.status === "ready" && material.content && (
                      <span className={styles.rowActions}>
                        <button type="button" className={styles.actionButton} onClick={() => openContent(material, "view")}>View content</button>
                        <button type="button" className={styles.actionButton} onClick={() => openContent(material, "edit")}>Edit content</button>
                      </span>
                    )}
                    {(material.status === "failed" || material.status === "uploaded") && material.attempts < 3 && (
                      <button type="button" className={styles.actionButton} onClick={() => void processMaterial(material.id)}>Retry processing</button>
                    )}
                    <button
                      aria-label={`Delete ${material.name}`}
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      disabled={
                        material.status === "uploading" ||
                        material.status === "processing" ||
                        deletingId !== null
                      }
                      onClick={() => void deleteMaterial(material)}
                      type="button"
                    >
                      {deletingId === material.id ? "Deleting…" : "Delete"}
                    </button>
                    {material.error && <small className={styles.errorText}>{material.error}</small>}
                    {material.status === "failed" && material.attempts >= 3 && <small className={styles.errorText}>Attempt limit reached. Try uploading a smaller or clearer file.</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
      {selected?.mode === "view" && (
        <section className={styles.extractionCard} aria-label="Extracted study content">
          <button type="button" className={styles.actionButton} onClick={() => setSelected(null)}>Close content</button>
          {selected.tags.length > 0 && (
            <ul className={styles.tagList}>
              {selected.tags.map(tag => <li key={tag}>{tag}</li>)}
            </ul>
          )}
          <h2>{selected.content.title}</h2>
          <p>{selected.content.summary}</p>
          {selected.content.sections.map((section, index) => (
            <div key={index}><h3>{section.heading}</h3><p>{section.content}</p></div>
          ))}
          {selected.content.key_terms.length > 0 && (
            <>
              <h3>Key terms</h3>
              <dl>
                {selected.content.key_terms.map((term, index) => (
                  <div key={index}><dt>{term.term}</dt><dd>{term.definition}</dd></div>
                ))}
              </dl>
            </>
          )}
        </section>
      )}
      {selected?.mode === "edit" && (
        <section className={styles.extractionCard} aria-label="Extracted study content">
          <form
            className={styles.extractionFields}
            onSubmit={(event) => {
              event.preventDefault();
              void saveContent();
            }}
          >
            <div className={styles.extractionActions}>
              <button className={styles.actionButton} disabled={isSavingContent} type="submit">
                {isSavingContent ? "Saving…" : "Save content"}
              </button>
              <button type="button" className={styles.actionButton} onClick={() => setSelected(null)}>Close content</button>
            </div>
            {contentNotice && <p>{contentNotice}</p>}
            <fieldset>
              <legend>Tags</legend>
              <ul className={styles.tagList}>
                {selected.tags.map(tag => (
                  <li key={tag}>
                    <span>{tag}</span>
                    <button
                      aria-label={`Remove ${tag}`}
                      className={styles.tagRemove}
                      onClick={() => removeTag(tag)}
                      type="button"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <div className={styles.tagComposer}>
                <input
                  aria-label="New tag"
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add a tag"
                  value={tagDraft}
                />
                <button className={styles.actionButton} onClick={addTag} type="button">Add tag</button>
              </div>
            </fieldset>
            <label>
              Title
              <input value={selected.content.title} onChange={(event) => updateDraft({ title: event.target.value })} />
            </label>
            <label>
              Summary
              <textarea value={selected.content.summary} onChange={(event) => updateDraft({ summary: event.target.value })} />
            </label>
            {selected.content.sections.map((section, index) => (
              <fieldset key={index}>
                <legend>Section {index + 1}</legend>
                <label>
                  Heading
                  <input value={section.heading} onChange={(event) => updateSection(index, { heading: event.target.value })} />
                </label>
                <label>
                  Body
                  <textarea value={section.content} onChange={(event) => updateSection(index, { content: event.target.value })} />
                </label>
              </fieldset>
            ))}
            {selected.content.key_terms.length > 0 && (
              <div>
                <h3>Key terms</h3>
                <dl>
                  {selected.content.key_terms.map((term, index) => (
                    <div key={index}><dt>{term.term}</dt><dd>{term.definition}</dd></div>
                  ))}
                </dl>
              </div>
            )}
          </form>
        </section>
      )}
      {confirmDialog && (
        <div
          className={styles.confirmBackdrop}
          onClick={() => setConfirmDialog(null)}
          role="presentation"
        >
          <div
            aria-describedby="confirm-dialog-message"
            aria-modal="true"
            className={styles.confirmDialog}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <p id="confirm-dialog-message">{confirmDialog.message}</p>
            <div className={styles.confirmActions}>
              <button
                className={styles.actionButton}
                onClick={() => setConfirmDialog(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className={`${styles.browseButton} ${styles.confirmButton}`}
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  action();
                }}
                type="button"
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
