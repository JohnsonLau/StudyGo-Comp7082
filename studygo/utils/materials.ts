export type Extraction = {
  title: string;
  kind: string;
  summary: string;
  sections: { heading: string; content: string }[];
  key_terms: { term: string; definition: string }[];
};

export type Course = {
  id: string;
  code: string;
  name: string;
  term: string;
  status: string;
};

export type Material = {
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

export type LibraryRow = {
  id: string;
  course_id: string | null;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  created_at: string;
  tags: string[] | null;
  courses: { name: string } | null;
  file_extractions: {
    status: "processing" | "ready" | "failed";
    content: Extraction | null;
    error: string | null;
    updated_at: string;
    attempts: number;
  } | null;
};

export type AddTagResult =
  | { ok: true; tag: string }
  | { ok: false; error?: string; clearDraft?: boolean };

export type MaterialsFilterOptions = {
  courseFilter: string;
  courseSort: "newest" | "name-asc" | "name-desc";
  tagFilter: string;
};

export class MaterialsLogic {
  static normalizeTag(value: string) {
    return value.trim().replace(/\s+/g, " ");
  }

  static filterAndSortMaterials(
    materials: Material[],
    options: MaterialsFilterOptions,
  ): Material[] {
    const tagFilters = options.tagFilter
      .split(",")
      .map(tag => MaterialsLogic.normalizeTag(tag).toLowerCase())
      .filter(Boolean);

    return materials
      .filter(material => {
        if (options.courseFilter === "unassigned" && material.courseId !== null) return false;
        if (
          options.courseFilter !== "all"
          && options.courseFilter !== "unassigned"
          && material.courseId !== options.courseFilter
        ) {
          return false;
        }
        if (tagFilters.length === 0) return true;
        const materialTags = material.tags.map(tag => tag.toLowerCase());
        return tagFilters.every(tag => materialTags.some(materialTag => materialTag.includes(tag)));
      })
      .sort((left, right) => {
        if (options.courseSort === "newest") return 0;
        const byName = left.course.localeCompare(right.course, undefined, { sensitivity: "base" });
        return options.courseSort === "name-asc" ? byName : -byName;
      });
  }

  static canAddTag(existingTags: string[], draft: string): AddTagResult {
    const tag = MaterialsLogic.normalizeTag(draft);
    if (!tag) return { ok: false };
    if (tag.length > 40) {
      return { ok: false, error: "Each tag must be 40 characters or fewer." };
    }
    if (existingTags.some(existing => existing.toLowerCase() === tag.toLowerCase())) {
      return { ok: false, clearDraft: true };
    }
    if (existingTags.length >= 20) {
      return { ok: false, error: "A file can have at most 20 tags." };
    }
    return { ok: true, tag };
  }

  static validateExtraction(content: Extraction): { ok: true } | { ok: false; error: string } {
    if (
      !content.title.trim()
      || !content.summary.trim()
      || content.sections.some(section => !section.heading.trim() || !section.content.trim())
    ) {
      return {
        ok: false,
        error: "Add a title, summary, and text for every section before saving.",
      };
    }
    return { ok: true };
  }
}
