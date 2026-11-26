import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { MaterialsLogic, type Extraction } from "../utils/materials.ts";
import { SupabaseMaterials } from "../app/study-materials/materials-supabase.ts";

const validExtraction: Extraction = {
  title: "Cells",
  kind: "notes",
  summary: "Cell structure",
  sections: [{ heading: "ATP", content: "Energy carrier" }],
  key_terms: [{ term: "ATP", definition: "Energy carrier" }],
};

const originalCreateClient = SupabaseMaterials.createClient;

type QueryResult = { data: unknown; error: { message: string } | null };

function mockQuery(result: QueryResult) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  api.select = self;
  api.order = self;
  api.insert = self;
  api.eq = self;
  api.delete = self;
  api.returns = () => Promise.resolve(result);
  api.single = () => Promise.resolve(result);
  api.maybeSingle = () => Promise.resolve(result);
  return api;
}

function useMockClient(options: {
  fromResult?: QueryResult;
  rpcResult?: QueryResult;
}) {
  const fromResult = options.fromResult ?? { data: [], error: null };
  const rpcResult = options.rpcResult ?? { data: null, error: null };
  SupabaseMaterials.createClient = (() => ({
    from() {
      return mockQuery(fromResult);
    },
    rpc() {
      return Promise.resolve(rpcResult);
    },
    auth: {
      getUser() {
        return Promise.resolve({ data: { user: { id: "user-1" } }, error: null });
      },
    },
    storage: {
      from() {
        return {
          upload: async () => ({ error: null }),
          remove: async () => ({ error: null }),
        };
      },
    },
    functions: {
      invoke: async () => ({ data: null, error: null }),
    },
  })) as typeof SupabaseMaterials.createClient;
}

afterEach(() => {
  SupabaseMaterials.createClient = originalCreateClient;
});

test("normalizeTag trims and collapses whitespace", () => {
  assert.equal(MaterialsLogic.normalizeTag("  midterm   review  "), "midterm review");
  assert.equal(MaterialsLogic.normalizeTag("\tunit-1\n"), "unit-1");
});

test("canAddTag accepts new tags and rejects blank, long, duplicate, and over-limit tags", () => {
  assert.deepEqual(MaterialsLogic.canAddTag([], "  Biology  "), { ok: true, tag: "Biology" });
  assert.deepEqual(MaterialsLogic.canAddTag([], "   "), { ok: false });
  assert.deepEqual(
    MaterialsLogic.canAddTag([], "x".repeat(41)),
    { ok: false, error: "Each tag must be 40 characters or fewer." },
  );
  assert.deepEqual(
    MaterialsLogic.canAddTag(["Biology"], "biology"),
    { ok: false, clearDraft: true },
  );
  assert.deepEqual(
    MaterialsLogic.canAddTag(Array.from({ length: 20 }, (_, i) => `tag-${i}`), "extra"),
    { ok: false, error: "A file can have at most 20 tags." },
  );
});

test("validateExtraction requires title, summary, and complete sections", () => {
  assert.deepEqual(MaterialsLogic.validateExtraction(validExtraction), { ok: true });
  assert.deepEqual(
    MaterialsLogic.validateExtraction({ ...validExtraction, title: "  " }),
    { ok: false, error: "Add a title, summary, and text for every section before saving." },
  );
  assert.deepEqual(
    MaterialsLogic.validateExtraction({
      ...validExtraction,
      sections: [{ heading: "ATP", content: "" }],
    }),
    { ok: false, error: "Add a title, summary, and text for every section before saving." },
  );
});

test("supabaseLoadCourses returns courses from the mock database", async () => {
  const courses = [
    { id: "c1", code: "BIO", name: "Biology", term: "Fall", status: "active" },
  ];
  useMockClient({ fromResult: { data: courses, error: null } });
  assert.deepEqual(await SupabaseMaterials.supabaseLoadCourses(), courses);
});

test("supabaseAssignFileCourse resolves when the mock RPC succeeds", async () => {
  useMockClient({ rpcResult: { data: null, error: null } });
  await assert.doesNotReject(() =>
    SupabaseMaterials.supabaseAssignFileCourse("file-1", "course-1"),
  );
});

test("supabaseUpdateFileTags returns saved tags from the mock RPC", async () => {
  useMockClient({ rpcResult: { data: ["midterm", "cells"], error: null } });
  assert.deepEqual(
    await SupabaseMaterials.supabaseUpdateFileTags("file-1", ["midterm", "cells"]),
    ["midterm", "cells"],
  );
});
