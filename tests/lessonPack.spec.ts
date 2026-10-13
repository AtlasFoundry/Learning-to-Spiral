import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { emptyLibrary } from "../src/library";

const existingId = "existing-self-image";
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="8"/></svg>';
const fixture = {
  ...emptyLibrary(),
  pillars: emptyLibrary().pillars.map((pillar) => ({
    ...pillar,
    aim: `Preserve ${pillar.id} aim`,
    disposition: "Preserve disposition",
  })),
  lessons: [
    {
      id: existingId,
      title: "Existing self-image lesson",
      pillarId: "pillar-1",
      summary: "Original overview",
      content: "Original teaching content",
      notes: "Private notes",
      questions: "Original questions",
    },
    {
      id: "other-lesson",
      title: "Other lesson",
      pillarId: "pillar-2",
      summary: "",
      content: "Unrelated content",
      notes: "Unrelated notes",
    },
  ],
  sources: [
    {
      id: "existing-source",
      title: "Existing source",
      author: "",
      year: "",
      type: "Other",
      url: "",
      reference: "",
      findings: "Keep findings",
      notes: "Keep source notes",
      status: "Reviewed",
      lessonIds: [existingId, "other-lesson"],
      attachmentIds: ["paper"],
    },
  ],
  quotes: [
    {
      id: "existing-quote",
      sourceId: "existing-source",
      text: "An existing recorded passage",
      reference: "",
      point: "",
      commentary: "Keep interpretation",
      use: "General reference",
      lessonIds: [existingId],
    },
  ],
  visuals: [
    {
      id: "existing-visual",
      title: "Existing visual",
      description: "Keep description",
      concept: "",
      placement: "",
      status: "Draft",
      notes: "Keep revision notes",
      url: "",
      attachmentId: "image",
      lessonIds: [existingId, "other-lesson"],
    },
  ],
  attachments: [
    {
      id: "paper",
      name: "paper.txt",
      mime: "text/plain",
      data: `data:text/plain;base64,${Buffer.from("Original paper bytes").toString("base64")}`,
    },
    {
      id: "image",
      name: "image.svg",
      mime: "image/svg+xml",
      data: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    },
  ],
};
function lessonPack() {
  const pillarNumbers = [1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 7, 8, 9];
  const lessons = pillarNumbers.map((pillar, index) => ({
    id: `new-${index + 1}`,
    title: index === 0 ? "Possible expansion" : `Draft ${index + 1}`,
    pillarId: `pillar-${pillar}`,
    summary: "Editorial draft",
    content: "Draft teaching sequence",
    notes:
      index === 0
        ? "Check existing studio lesson “Existing self-image lesson” before adding this expansion."
        : "Draft notes",
  }));
  const sources = [1, 2].map((index) => ({
    id: `new-source-${index}`,
    title: `Pack source ${index}`,
    author: "",
    year: "",
    type: "Other",
    url: "",
    reference: "Photo filenames remain locators",
    findings: "A reading prompt",
    notes: "Not a verified scientific claim",
    status: "To read",
    lessonIds: lessons.map((lesson) => lesson.id),
    attachmentIds: [],
  }));
  const visuals = [1, 3, 4, 6, 8, 10, 12, 13].map((index) => ({
    id: `new-visual-${index}`,
    title: `Visual brief ${index}`,
    description: "Proposed model",
    concept: "Teaching concept",
    placement: "Introduction",
    status: "Idea",
    notes: "Design later",
    url: "",
    attachmentId: "",
    lessonIds: [`new-${index}`],
  }));
  return {
    kind: "learning-to-spiral-additive-lesson-pack",
    schemaVersion: 1,
    studioSchemaVersion: 1,
    lessonCount: 13,
    lessons,
    sources,
    visuals,
    quotes: [],
    attachments: [],
    important: "Metadata is not a merging instruction",
    mergeRules: { doNotReplacePillars: false },
    pillarMapping: [
      { id: "pillar-1", name: "Never overwrite the user's pillar" },
    ],
  };
}
async function saved(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("learning-to-spiral", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise<any>((resolve, reject) => {
      const request = db
        .transaction("studio")
        .objectStore("studio")
        .get("library");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return {
      ...value,
      attachments: await Promise.all(
        value.attachments.map(async (file: any) => ({
          id: file.id,
          name: file.name,
          mime: file.mime,
          bytes: Array.from(new Uint8Array(await file.blob.arrayBuffer())),
        })),
      ),
    };
  });
}
async function upload(page: Page, value: unknown) {
  await page.getByLabel("Upload additive lesson pack").setInputFiles({
    name: "lesson-pack.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      typeof value === "string" ? value : JSON.stringify(value),
    ),
  });
}
async function safetyBackup(page: Page) {
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download safety backup", exact: true })
    .click();
  const file = await pending;
  return JSON.parse(await readFile((await file.path())!, "utf8"));
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your Lesson Studio" }),
  ).toBeVisible();
  await page.getByLabel("Import portable backup").setInputFiles({
    name: "original.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole("button", { name: "Replace & restore" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  await page
    .getByRole("button", { name: "Add lesson pack", exact: true })
    .click();
});

test("additive pack previews 13 drafts, holds a noted overlap and its visual, preserves all existing records and attachment bytes, and skips repeat IDs", async ({
  page,
}) => {
  const before = await saved(page);
  const pack = lessonPack();
  await upload(page, pack);
  await expect(
    page.getByRole("heading", {
      name: "12 lessons, 2 sources, 7 visual briefs selected",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "Add lesson: Possible expansion",
      exact: true,
    }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", {
      name: "Add visual: Visual brief 1",
      exact: true,
    }),
  ).toBeDisabled();
  expect(await saved(page)).toEqual(before);
  await expect(
    page.getByRole("button", { name: "Add selected drafts" }),
  ).toBeDisabled();
  const backup = await safetyBackup(page);
  for (const field of [
    "pillars",
    "lessons",
    "sources",
    "quotes",
    "visuals",
    "attachments",
  ] as const)
    expect(backup[field]).toEqual(fixture[field]);
  await page
    .getByRole("checkbox", { name: "Add lesson: Draft 3", exact: true })
    .uncheck();
  await expect(
    page.getByRole("heading", {
      name: "11 lessons, 2 sources, 6 visual briefs selected",
    }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Add lesson: Draft 3", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Add selected drafts", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Added 12 lessons",
  );
  const after = await saved(page);
  for (const field of ["pillars", "quotes", "attachments"] as const)
    expect(after[field]).toEqual(before[field]);
  for (const field of ["lessons", "sources", "visuals"] as const)
    expect(after[field].slice(0, before[field].length)).toEqual(before[field]);
  expect(after.lessons.slice(before.lessons.length)).toEqual(
    pack.lessons.slice(1),
  );
  expect(after.sources.slice(before.sources.length)).toEqual(
    pack.sources.map((source) => ({
      ...source,
      lessonIds: pack.lessons.slice(1).map((lesson) => lesson.id),
    })),
  );
  expect(after.visuals.slice(before.visuals.length)).toEqual(
    pack.visuals.slice(1),
  );
  const reportEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download import report" }).click();
  const reportFile = await reportEvent;
  const report = await readFile((await reportFile.path())!, "utf8");
  expect(report).toContain("Self-image: 1 added");
  expect(report).toContain("new-13");
  expect(report).toContain("new-1 — Possible expansion");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your Lesson Studio" }),
  ).toBeVisible();
  expect(await saved(page)).toEqual(after);
  await page
    .getByRole("button", { name: "Add lesson pack", exact: true })
    .click();
  await upload(page, pack);
  await expect(
    page.getByRole("heading", {
      name: "0 lessons, 0 sources, 0 visual briefs selected",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("21 records skipped", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await saved(page)).toEqual(after);
});

test("malformed packs, unsupported fields, claimed attachments and broken links never write; duplicate titles require explicit selection", async ({
  page,
}) => {
  const before = await saved(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByLabel("Import portable backup").setInputFiles({
    name: "pack.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(lessonPack())),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Use Add lesson pack instead of Restore backup",
  );
  expect(await saved(page)).toEqual(before);
  await page
    .getByRole("button", { name: /Existing self-image lesson/ })
    .click();
  await page
    .getByRole("button", { name: "Import from ChatGPT", exact: true })
    .click();
  await page
    .getByLabel("JSON lesson update")
    .fill(JSON.stringify(lessonPack()));
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Use Add lesson pack",
  );
  expect(await saved(page)).toEqual(before);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Add lesson pack", exact: true })
    .click();
  const variants: unknown[] = ["{bad", fixture];
  for (const mutate of [
    (pack: any) => {
      pack.lessons[1].id = pack.lessons[0].id;
    },
    (pack: any) => {
      pack.lessons[0].pillarId = "unknown-pillar";
    },
    (pack: any) => {
      pack.lessons[0].target = existingId;
    },
    (pack: any) => {
      pack.lessons[0].notes = null;
    },
    (pack: any) => {
      pack.sources[0].lessonIds.push("unknown-lesson");
    },
    (pack: any) => {
      pack.sources[0].attachmentIds = ["paper"];
    },
    (pack: any) => {
      pack.visuals[0].url = "javascript:alert(1)";
    },
    (pack: any) => {
      pack.visuals[0].attachmentId = "image";
    },
    (pack: any) => {
      pack.quotes = [{ id: "quote" }];
    },
  ]) {
    const pack = lessonPack();
    mutate(pack);
    variants.push(pack);
  }
  for (const variant of variants) {
    await upload(page, variant);
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add selected drafts" }),
    ).toBeDisabled();
    expect(await saved(page)).toEqual(before);
  }
  const pack = lessonPack();
  pack.lessons[1].title = fixture.lessons[0].title;
  pack.sources[0].id = "existing-source";
  pack.visuals[1].id = "existing-visual";
  pack.sources[1].title = "Existing source";
  pack.visuals[2].title = "Existing visual";
  await upload(page, pack);
  await expect(
    page.getByRole("checkbox", {
      name: "Add lesson: Existing self-image lesson",
      exact: true,
    }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", {
      name: "Add source: Existing source",
      exact: true,
    }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", {
      name: "Add visual: Existing visual",
      exact: true,
    }),
  ).not.toBeChecked();
  await safetyBackup(page);
  await page.getByRole("button", { name: "Add selected drafts" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Added 11 lessons",
  );
  const after = await saved(page);
  expect(after.sources[0]).toEqual(before.sources[0]);
  expect(after.visuals[0]).toEqual(before.visuals[0]);
  expect(after.lessons.slice(0, 2)).toEqual(before.lessons);
});

test("save failure leaves the workspace unchanged and permits an atomic retry", async ({
  page,
}) => {
  const before = await saved(page);
  await upload(page, lessonPack());
  await expect(
    page.getByRole("heading", {
      name: "12 lessons, 2 sources, 7 visual briefs selected",
    }),
  ).toBeVisible();
  await safetyBackup(page);
  await page.evaluate(() => {
    (window as any).originalPackPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("Pack save unavailable", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Add selected drafts" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Pack save unavailable",
  );
  expect(await saved(page)).toEqual(before);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (window as any).originalPackPut;
  });
  await page.getByRole("button", { name: "Add selected drafts" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Added 12 lessons",
  );
  expect((await saved(page)).lessons).toHaveLength(before.lessons.length + 12);
});

test("mobile workspace tools expose pack importing without overflow and keep keyboard focus inside the dialog", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Workspace tools").click();
  await page
    .locator(".mobile-tools")
    .getByRole("button", { name: "Add lesson pack", exact: true })
    .click();
  await upload(page, lessonPack());
  await expect(
    page.getByRole("heading", {
      name: "12 lessons, 2 sources, 7 visual briefs selected",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Cancel", exact: true }).focus();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => !!document.activeElement?.closest('[role="dialog"]'),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
