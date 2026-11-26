import { createSupabaseBrowserClient } from "../../utils/supabase/browser";
import type { Course, Extraction, LibraryRow, Material } from "../../utils/materials";

const mimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export class SupabaseMaterials {
  /** Overridable in unit tests so the hosted database is never touched. */
  static createClient = createSupabaseBrowserClient;

  static async supabaseLoadCourses(): Promise<Course[]> {
    const supabase = SupabaseMaterials.createClient();
    const { data, error } = await supabase.from("courses")
      .select("id, code, name, term, status")
      .order("name", { ascending: true })
      .returns<Course[]>();
    if (error) throw new Error("Could not load your courses. Please refresh and try again.");
    return data ?? [];
  }

  static async supabaseLoadMaterials(): Promise<Material[]> {
    const supabase = SupabaseMaterials.createClient();
    const { data, error } = await supabase.from("files")
      .select("id, course_id, file_name, storage_path, size_bytes, created_at, tags, courses(name), file_extractions(status, content, error, updated_at, attempts)")
      .order("created_at", { ascending: false })
      .returns<LibraryRow[]>();
    if (error) throw new Error("Could not load your library. Please refresh and try again.");
    return (data ?? []).map(file => {
      const extraction = file.file_extractions;
      const interrupted = extraction?.status === "processing"
        && Date.now() - Date.parse(extraction.updated_at) > 180_000;
      return {
        id: file.id,
        name: file.file_name,
        storagePath: file.storage_path,
        size: formatSize(file.size_bytes),
        added: new Date(file.created_at).toLocaleDateString(),
        courseId: file.course_id,
        course: file.courses?.name ?? "Unassigned",
        tags: file.tags ?? [],
        status: interrupted ? "failed" : extraction?.status ?? "uploaded",
        content: extraction?.content ?? null,
        error: interrupted ? "Processing was interrupted. Please retry." : extraction?.error ?? null,
        attempts: extraction?.attempts ?? 0,
      };
    });
  }

  static async supabaseSendFile(file: File, id: string, extension: string): Promise<string> {
    const supabase = SupabaseMaterials.createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Please sign in before uploading files.");
    const path = `${user.id}/${id}/source.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("study-materials")
      .upload(path, file, { contentType: mimeTypes[extension] });
    if (uploadError) throw new Error("Could not upload this file. Check your connection and storage setup.");
    const { error: insertError } = await supabase.from("files").insert({
      id,
      user_id: user.id,
      file_name: file.name,
      mime_type: mimeTypes[extension],
      size_bytes: file.size,
      storage_path: path,
      kind: "other",
    });
    if (insertError) {
      await supabase.storage.from("study-materials").remove([path]);
      throw new Error("Could not save the file record. Please check your profile and try again.");
    }
    return path;
  }

  static async supabaseDeleteFile(id: string, storagePath: string): Promise<string | null> {
    const supabase = SupabaseMaterials.createClient();
    const { data, error: deleteError } = await supabase
      .from("files")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (deleteError) throw new Error(`Could not delete this material: ${deleteError.message}`);
    if (!data) throw new Error("Could not delete this material. It may have already been removed.");

    const { error: storageError } = await supabase.storage
      .from("study-materials")
      .remove([storagePath]);
    if (storageError) {
      return `The material was removed from your library, but its uploaded file could not be removed from storage: ${storageError.message}`;
    }
    return null;
  }

  static async supabaseAddCourse(name: string): Promise<Course> {
    const supabase = SupabaseMaterials.createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Please sign in before adding a course.");
    const { data, error: insertError } = await supabase.from("courses")
      .insert({ name, user_id: user.id })
      .select("id, code, name, term, status")
      .single();
    if (insertError) throw new Error(`Could not add this course: ${insertError.message}`);
    if (!data) throw new Error("Could not add this course. Please try again.");
    return data;
  }

  static async supabaseUpdateFileSummary(fileId: string, content: Extraction): Promise<void> {
    const supabase = SupabaseMaterials.createClient();
    const { error: saveError } = await supabase.rpc("update_file_extraction_content", {
      p_file_id: fileId,
      p_content: content,
    });
    if (saveError) throw new Error("Could not save this study content. Please try again.");
  }

  static async supabaseUpdateFileTags(fileId: string, tags: string[]): Promise<string[]> {
    const supabase = SupabaseMaterials.createClient();
    const { data: savedTags, error: tagsError } = await supabase.rpc("update_file_tags", {
      p_file_id: fileId,
      p_tags: tags,
    });
    if (tagsError) throw new Error("Could not save these tags. Please try again.");
    return Array.isArray(savedTags) ? savedTags as string[] : tags;
  }

  static async supabaseAssignFileCourse(fileId: string, courseId: string | null): Promise<void> {
    const supabase = SupabaseMaterials.createClient();
    const { error: assignError } = await supabase.rpc("assign_file_course", {
      p_file_id: fileId,
      p_course_id: courseId,
    });
    if (assignError) throw new Error("Could not assign this course. Please try again.");
  }

  static async supabaseProcessMaterial(id: string): Promise<{
    status: Material["status"];
    content: Extraction | null;
    error: string | null;
    attempts: number;
  }> {
    const supabase = SupabaseMaterials.createClient();
    const { data, error: invokeError } = await supabase.functions.invoke("process-study-material", {
      body: { file_id: id },
    });
    if (invokeError) {
      let message = "Could not process this material. Please retry.";
      if (invokeError.context instanceof Response) {
        const body = await invokeError.context.json().catch(() => null);
        if (typeof body?.error === "string") message = body.error;
      }
      throw new Error(message);
    }
    if (!data?.extraction) throw new Error("No processing result was returned. Please retry.");
    return data.extraction;
  }
}

export { formatSize, mimeTypes };
