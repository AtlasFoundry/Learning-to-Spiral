import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { emptyLibrary } from "../src/library";

const targetId = "lesson-to-delete";
const otherId = "lesson-to-keep";
const title = "Draft to remove";
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green"/></svg>';
const fixture = {
  ...emptyLibrary(),
  pillars: emptyLibrary().pillars.map((p) => ({
    ...p,
    aim: "Keep the pillar aim",
    disposition: "Keep the disposition",
  })),
  lessons: [
    {
      id: targetId,
      title,
      pillarId: "pillar-1",
      summary: "Draft overview",
      content: "Teaching notes to remove",
      notes: "Draft notes",
      questions: "Draft questions",
    },
    {
      id: otherId,
      title: "Lesson to keep",
      pillarId: "pillar-2",
      summary: "Keep overview",
      content: "Keep teaching notes",
      notes: "Keep private notes",
      questions: "Keep questions",
    },
  ],
  sources: [true, false].map((shared) => ({
    id: shared ? "shared-source" : "only-source",
    title: shared ? "Shared source" : "Source for the removed lesson",
    author: "",
    year: "",
    type: "Other",
    url: "",
    reference: "",
    findings: "Keep findings",
    notes: "Keep source notes",
    status: "Reviewed",
    lessonIds: shared ? [targetId, otherId] : [targetId],
    attachmentIds: ["paper"],
  })),
  quotes: [true, false].map((shared) => ({
    id: shared ? "shared-quote" : "only-quote",
    sourceId: shared ? "shared-source" : "only-source",
    text: "Keep the recorded passage",
    reference: "",
    point: "Keep teaching point",
    commentary: "Keep commentary",
    use: "General reference",
    lessonIds: shared ? [targetId, otherId] : [targetId],
  })),
  visuals: [true, false].map((shared) => ({
    id: shared ? "shared-visual" : "only-visual",
    title: shared ? "Shared diagram" : "Diagram for the removed lesson",
    description: "Keep description",
    concept: "Keep concept",
    placement: "Keep placement",
    status: "Draft",
    notes: "Keep revisions",
    url: "",
    attachmentId: "image",
    lessonIds: shared ? [targetId, otherId] : [targetId],
  })),
  attachments: [
    {
      id: "paper",
      name: "paper.txt",
      mime: "text/plain",
      data: `data:text/plain;base64,${Buffer.from("Original attachment bytes").toString("base64")}`,
    },
    {
      id: "image",
      name: "diagram.svg",
      mime: "image/svg+xml",
      data: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    },
  ],
};
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
const card = (page: Page) =>
  page.getByRole("article", { name: title, exact: true });
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your Lesson Studio" }),
  ).toBeVisible();
  await page
    .getByLabel("Import portable backup")
    .setInputFiles({
      name: "delete-example.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Replace & restore" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
});

test("standalone card deletion unlinks only the target lesson and preserves reusable masters, attribution and attachment bytes through reload and export", async ({
  page,
  context,
}) => {
  const html = await readFile("dist/Learning-to-Spiral.html", "utf8");
  const url = "http://127.0.0.1:5173/delete-lesson-offline";
  await context.route(url, route => route.fulfill({ body: html, contentType: "text/html" }));
  await context.setOffline(true);
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Your Lesson Studio" })).toBeVisible();
  const before = await saved(page);
  await card(page)
    .getByRole("button", { name: "Delete lesson", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Delete lesson?",
    exact: true,
  });
  await expect(dialog).toContainText(title);
  await expect(dialog).toContainText(
    "uploaded files stay in your central library",
  );
  expect(await saved(page)).toEqual(before);
  await dialog
    .getByRole("button", { name: "Delete lesson", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  await expect(card(page)).toHaveCount(0);
  const after = await saved(page);
  expect(after.lessons).toEqual([before.lessons[1]]);
  expect(after.pillars).toEqual(before.pillars);
  expect(after.attachments).toEqual(before.attachments);
  for (const collection of ["sources", "quotes", "visuals"] as const)
    expect(after[collection]).toEqual(
      before[collection].map((record: any) => ({
        ...record,
        lessonIds: record.lessonIds.filter((id: string) => id !== targetId),
      })),
    );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your Lesson Studio" }),
  ).toBeVisible();
  expect(await saved(page)).toEqual(after);
  await page.getByRole("button", { name: /Lesson to keep/ }).click();
  await expect(page.getByLabel("Teaching notes", { exact: true })).toHaveValue(
    fixture.lessons[1].content,
  );
  await page.getByRole("tab", { name: /Diagrams & Visuals/ }).click();
  await expect(
    page.getByRole("img", { name: "Shared diagram", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Diagram for the removed lesson",
      exact: true,
    }),
  ).toHaveCount(0);
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download backup", exact: true })
    .click();
  const download = await pending;
  const text = await readFile((await download.path())!, "utf8");
  const portable = JSON.parse(text);
  expect(portable.attachments).toEqual(fixture.attachments);
  expect(portable.lessons).toEqual([fixture.lessons[1]]);
  await page
    .getByLabel("Import portable backup")
    .setInputFiles({
      name: "after-delete.json",
      mimeType: "application/json",
      buffer: Buffer.from(text),
    });
  await expect(page.getByRole("dialog")).toContainText("1 lessons");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await saved(page)).toEqual(after);
});

test("card delete is independently labelled, opens without entering the editor, and cancels safely with mouse and keyboard on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const before = await saved(page);
  const trash = card(page).getByRole("button", {
    name: "Delete lesson",
    exact: true,
  });
  await expect(trash).toHaveAccessibleDescription(title);
  await expect(card(page).locator("button button")).toHaveCount(0);
  await trash.click();
  await expect(
    page.getByRole("heading", { name: "Your Lesson Studio" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(trash).toBeFocused();
  expect(await saved(page)).toEqual(before);
  await trash.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trash).toBeFocused();
  expect(await saved(page)).toEqual(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await card(page)
    .getByRole("button", { name: /Draft to remove/ })
    .click();
  await expect(page.getByLabel("Teaching notes", { exact: true })).toHaveValue(
    fixture.lessons[0].content,
  );
});

test("failed deletion keeps saved data and the card intact, then can be retried atomically", async ({
  page,
}) => {
  const before = await saved(page);
  await card(page)
    .getByRole("button", { name: "Delete lesson", exact: true })
    .click();
  await page.evaluate(() => {
    (window as any).originalDeletePut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = () => {
      throw new DOMException(
        "Delete storage unavailable",
        "QuotaExceededError",
      );
    };
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete lesson", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Your saved workspace is unchanged",
  );
  expect(await saved(page)).toEqual(before);
  await expect(card(page)).toHaveCount(1);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (window as any).originalDeletePut;
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete lesson", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await saved(page);
  expect(after.lessons).toEqual([before.lessons[1]]);
  expect(after.attachments).toEqual(before.attachments);
});
