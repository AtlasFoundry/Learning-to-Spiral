import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("supplied pillar names replace legacy placeholders once, preserving custom names and lesson links", async ({
  page,
}) => {
  const names = [
    "Self-image",
    "Attention & mind",
    "Goals & discernment",
    "Intention",
    "Imagination & feeling",
    "Autosuggestion & conditioning",
    "Faith & prayer",
    "Order, action & movement",
    "Integration & embodiment",
  ];
  await page
    .getByRole("button", { name: "Edit pillar names", exact: true })
    .click();
  for (const [index, name] of names.entries()) {
    await expect(
      page
        .getByRole("dialog")
        .getByLabel(`Pillar ${index + 1}`, { exact: true }),
    ).toHaveValue(name);
  }
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await createLesson(page, "Existing linked lesson");
  await addSource(page, "Existing source");
  const legacy = JSON.parse(
    await downloadedText(page, () =>
      page
        .getByRole("button", { name: "Download backup", exact: true })
        .click(),
    ),
  );
  delete legacy.pillarNamesVersion;
  legacy.pillars = legacy.pillars.map((pillar: any, i: number) => ({
    ...pillar,
    name: i === 1 ? "My custom pillar" : `Pillar ${i + 1}`,
  }));
  await page.evaluate(async (library) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("learning-to-spiral", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("studio", "readwrite");
      transaction.objectStore("studio").put(library, "library");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, legacy);
  await page.reload();
  await page.getByRole("button", { name: /Existing linked lesson/ }).click();
  await expect(
    page.getByLabel("Pillar", { exact: true }).locator("option"),
  ).toHaveText(names.map((name, i) => (i === 1 ? "My custom pillar" : name)));
  await expect(
    page.getByRole("button", { name: "Existing source", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  const migrated = JSON.parse(
    await downloadedText(page, () =>
      page
        .getByRole("button", { name: "Download backup", exact: true })
        .click(),
    ),
  );
  expect(migrated.pillarNamesVersion).toBe(1);
  expect(migrated.lessons).toEqual(legacy.lessons);
  expect(migrated.sources).toEqual(legacy.sources);
  await page.getByLabel("Import portable backup").setInputFiles({
    name: "legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await page
    .getByRole("button", { name: "Replace & restore", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit pillar names", exact: true })
    .click();
  for (const [index, name] of names.entries()) {
    await expect(
      page
        .getByRole("dialog")
        .getByLabel(`Pillar ${index + 1}`, { exact: true }),
    ).toHaveValue(index === 1 ? "My custom pillar" : name);
  }
  // A later deliberate rename to a former placeholder must not be changed on reload.
  await page
    .getByRole("dialog")
    .getByLabel("Pillar 1", { exact: true })
    .fill("Pillar 1");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "01 Pillar 1", exact: true }),
  ).toBeVisible();
});

async function createLesson(page: Page, title: string, pillar = "Self-image") {
  await page.getByRole("button", { name: "New lesson", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Lesson title", { exact: true }).fill(title);
  await dialog
    .getByLabel("Pillar", { exact: true })
    .selectOption({ label: pillar });
  await dialog
    .getByRole("button", { name: "Create lesson", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}
async function addSource(page: Page, title = "A real source") {
  await page.getByRole("button", { name: "Add research", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog
    .getByLabel("Key findings or relevant ideas")
    .fill("A recorded finding.");
  await dialog
    .getByLabel("My notes on how this relates to the lesson")
    .fill("Supports the opening discussion.");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
}
async function downloadedText(page: Page, action: () => Promise<void>) {
  const event = page.waitForEvent("download");
  await action();
  const download = await event;
  return readFile((await download.path())!, "utf8");
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your Lesson Studio" }),
  ).toBeVisible();
});

test("master sources and visuals are reused, while each lesson shows only its linked material", async ({
  page,
}) => {
  await createLesson(page, "First lesson");
  await addSource(page);
  await page.getByRole("tab", { name: /Diagrams & Visuals/ }).click();
  await page.getByRole("button", { name: "Add diagram", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Shared diagram");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "All lessons", exact: true }).click();
  await createLesson(page, "Second lesson", "Attention & mind");
  await expect(
    page.getByRole("button", { name: "Shared diagram", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Link existing", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save links", exact: true }).click();
  await page
    .getByRole("button", { name: "Shared diagram", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Edited master diagram");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("tab", { name: /Research/ }).click();
  await expect(
    page.getByRole("button", { name: "A real source", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Link existing", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save links", exact: true }).click();
  await page
    .getByRole("button", { name: "A real source", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Shared, edited source");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page
    .getByRole("button", { name: "Research & Visuals", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByText("2 linked lessons", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Filter by pillar")
    .selectOption({ label: "Attention & mind" });
  await expect(
    page.getByRole("button", { name: "Shared, edited source", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Lesson Studio/ }).click();
  await page.getByRole("button", { name: /First lesson/ }).click();
  await expect(
    page.getByRole("button", { name: "Shared, edited source", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: /Diagrams & Visuals/ }).click();
  await expect(
    page.getByRole("button", { name: "Edited master diagram", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("2 linked lessons", { exact: true }),
  ).toBeVisible();
});

test("quotes preserve attribution, filter by lesson and use, and prevent dangling sources", async ({
  page,
}) => {
  await createLesson(page, "Quote lesson");
  await addSource(page, "Untitled author source");
  await page.getByRole("tab", { name: /Quotes & Extracts/ }).click();
  await page.getByRole("button", { name: "Add quote", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Exact quotation")
    .fill("These are the exact recorded words.");
  await dialog
    .getByLabel("Original research entry")
    .selectOption({ label: "Untitled author source" });
  await dialog.getByLabel("Page number, chapter, or section").fill("Chapter 2");
  await dialog.getByLabel("The teaching point it supports").fill("Be precise.");
  await dialog
    .getByLabel("My interpretation or commentary")
    .fill("A personal reading.");
  await dialog
    .getByLabel("Intended use", { exact: true })
    .selectOption("YouTube");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Author not recorded", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Research & Visuals", exact: true })
    .click();
  await page
    .getByLabel("Filter by lesson")
    .selectOption({ label: "Quote lesson" });
  await page.getByLabel("Filter by intended use").selectOption("TikTok");
  await expect(page.getByRole("article")).toHaveCount(0);
  await page.getByLabel("Filter by intended use").selectOption("YouTube");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("tab", { name: /Research/ }).click();
  await page
    .getByRole("button", { name: "Untitled author source", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("preserve attribution");
});

test("uploaded images and source attachments survive reload and a portable backup restore", async ({
  page,
}) => {
  await createLesson(page, "Portable lesson");
  await page.getByRole("button", { name: "Add research", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Attached source");
  await page.getByLabel("Upload source attachments").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Original attachment bytes"),
  });
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("tab", { name: /Diagrams & Visuals/ }).click();
  await page.getByRole("button", { name: "Add diagram", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill("Spiral model");
  await dialog
    .getByLabel("Concept being illustrated")
    .fill("Returning with perspective");
  await dialog.getByLabel("Where it will appear in the lesson").fill("Slide 3");
  await dialog.getByLabel("Notes for revisions").fill("Add a second turn.");
  await dialog.getByLabel("Status", { exact: true }).selectOption("Final");
  await dialog.getByLabel("Upload diagram image").setInputFiles({
    name: "spiral.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="30" fill="#657e55"/></svg>',
    ),
  });
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("img", { name: "Spiral model" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  await page.reload();
  await page.getByRole("button", { name: /Portable lesson/ }).click();
  await page.getByRole("tab", { name: /Diagrams & Visuals/ }).click();
  await expect(page.getByRole("img", { name: "Spiral model" })).toBeVisible();
  const backup = await downloadedText(page, () =>
    page.getByRole("button", { name: "Download backup", exact: true }).click(),
  );
  const data = JSON.parse(backup);
  expect(data.attachments).toHaveLength(2);
  expect(
    Buffer.from(
      data.attachments
        .find((a: any) => a.name === "notes.txt")
        .data.split(",")[1],
      "base64",
    ).toString(),
  ).toBe("Original attachment bytes");
  // Replace the workspace with a different valid backup, then restore the original.
  await page.getByLabel("Import portable backup").setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        ...data,
        lessons: [],
        sources: [],
        quotes: [],
        visuals: [],
        attachments: [],
      }),
    ),
  });
  await page.getByRole("button", { name: "Replace & restore" }).click();
  await page.getByRole("button", { name: /^Lesson Studio/ }).click();
  await expect(
    page.getByRole("button", { name: /Portable lesson/ }),
  ).toHaveCount(0);
  await page.getByLabel("Import portable backup").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });
  await page.getByRole("button", { name: "Replace & restore" }).click();
  await page.getByRole("button", { name: /Portable lesson/ }).click();
  await page.getByRole("tab", { name: /Diagrams & Visuals/ }).click();
  await expect(page.getByRole("img", { name: "Spiral model" })).toBeVisible();
  await page.getByRole("tab", { name: /Research/ }).click();
  await page
    .getByRole("button", { name: "Attached source", exact: true })
    .click();
  const attachment = await downloadedText(page, () =>
    page
      .getByRole("dialog")
      .getByRole("button", { name: "notes.txt", exact: true })
      .click(),
  );
  expect(attachment).toBe("Original attachment bytes");
});

test("ChatGPT exports include linked material and notes, without invented missing attribution", async ({
  page,
}) => {
  await createLesson(page, "Export lesson");
  await page.getByLabel("Lesson overview").fill("Lesson overview text");
  await page
    .getByLabel("Teaching notes", { exact: true })
    .fill("Teaching body");
  await page.getByText("My reflections & notes", { exact: true }).click();
  await page.getByLabel("My reflections and notes").fill("Personal reflection");
  await addSource(page, "Recorded source");
  await page.getByRole("tab", { name: /Quotes & Extracts/ }).click();
  await page.getByRole("button", { name: "Add quote", exact: true }).click();
  await page.getByLabel("Exact quotation").fill("Exact words");
  await page
    .getByLabel("Original research entry")
    .selectOption({ label: "Recorded source" });
  await page
    .getByLabel("My interpretation or commentary")
    .fill("My interpretation");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("tab", { name: /Diagrams & Visuals/ }).click();
  await page.getByRole("button", { name: "Add diagram", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Planned visual");
  await page.getByLabel("Notes for revisions").fill("Visual revision notes");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("button", { name: "Export for ChatGPT", exact: true })
    .click();
  const text = await downloadedText(page, () =>
    page.getByRole("button", { name: "Download ChatGPT text" }).click(),
  );
  for (const value of [
    "Lesson overview text",
    "Teaching body",
    "Personal reflection",
    "Recorded source",
    "Supports the opening discussion.",
    "Exact words",
    "My interpretation",
    "Planned visual",
    "Visual revision notes",
    "Author: [not recorded]",
    "[page/section not recorded]",
  ])
    expect(text).toContain(value);
  const bundle = JSON.parse(
    await downloadedText(page, () =>
      page.getByRole("button", { name: "Download with attachments" }).click(),
    ),
  );
  expect(bundle.lessons).toHaveLength(1);
  expect(bundle.sources).toHaveLength(1);
  expect(bundle.quotes).toHaveLength(1);
  expect(bundle.visuals).toHaveLength(1);
});

test("invalid backups and unsafe URLs are rejected without replacing data", async ({
  page,
}) => {
  await createLesson(page, "Keep this lesson");
  await page.getByLabel("Import portable backup").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1,"lessons":[]}'),
  });
  await expect(page.getByRole("alert")).toContainText("not a valid");
  await page.getByRole("button", { name: "Add research", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Unsafe URL");
  await page.getByLabel("URL or DOI").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "http/https",
  );
  await page.getByLabel("URL or DOI").fill("10.1234/example");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("link", { name: "View source" })).toHaveAttribute(
    "href",
    "https://doi.org/10.1234/example",
  );
  await expect(
    page.getByRole("heading", { name: "Keep this lesson", exact: true }),
  ).toBeVisible();
});

test("mobile layout stays within viewport and dialog keyboard focus is contained", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createLesson(page, "Mobile lesson");
  await page.getByRole("tab", { name: /Diagrams & Visuals/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Add diagram", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Save changes" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Workspace tools").click();
  await expect(
    page.getByRole("button", { name: "Download backup", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit pillar names", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Pillar 1", { exact: true })
    .fill("Foundations");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes" })
    .click();
  await expect(page.getByLabel("Pillar", { exact: true })).toHaveValue(
    "pillar-1",
  );
  await expect(
    page.getByLabel("Pillar", { exact: true }).locator("option:checked"),
  ).toHaveText("Foundations");
});

for (const format of ["png", "jpeg"] as const) {
  test(`${format} images render and an unsupported image is rejected`, async ({
    page,
  }) => {
    await createLesson(page, `${format} lesson`);
    await page.getByRole("tab", { name: /Diagrams & Visuals/ }).click();
    await page
      .getByRole("button", { name: "Add diagram", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Title", { exact: true })
      .fill(`${format} visual`);
    await page.getByLabel("Upload diagram image").setInputFiles({
      name: "bad.gif",
      mimeType: "image/gif",
      buffer: Buffer.from("unsupported"),
    });
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "PNG, JPG, or SVG",
    );
    const bytes = await page.evaluate(async (format) => {
      const canvas = document.createElement("canvas");
      canvas.width = 32;
      canvas.height = 32;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#657e55";
      context.fillRect(0, 0, 32, 32);
      return canvas.toDataURL(`image/${format}`).split(",")[1];
    }, format);
    await page.getByLabel("Upload diagram image").setInputFiles({
      name: `image.${format === "jpeg" ? "jpg" : "png"}`,
      mimeType: `image/${format}`,
      buffer: Buffer.from(bytes, "base64"),
    });
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page.getByRole("img", { name: `${format} visual` }),
    ).toBeVisible();
    expect(
      await page
        .getByRole("img", { name: `${format} visual` })
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    ).toBe(32);
  });
}
