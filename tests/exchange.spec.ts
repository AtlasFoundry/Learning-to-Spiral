import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { emptyLibrary } from "../src/library";

const lessonId = "self-image-lesson-1";
const originalContent =
  "## Foundation\nOriginal teaching notes.\n\nA reflection prompt.";
const originalNotes = "Keep this personal note.\nSecond paragraph.";
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="10"/></svg>';
const fixture = {
  ...emptyLibrary(),
  lessons: [
    {
      id: lessonId,
      title: "Self-image · Lesson 1",
      pillarId: "pillar-1",
      summary: "The lesson overview.",
      content: originalContent,
      notes: originalNotes,
      questions: "How can I explain self-image with care?",
    },
    {
      id: "unrelated-lesson",
      title: "An unrelated lesson",
      pillarId: "pillar-2",
      summary: "",
      content: "Do not rewrite this lesson.",
      notes: "Keep the unrelated notes.",
    },
  ],
  sources: [
    {
      id: "existing-source",
      title: "Existing research reference",
      author: "",
      year: "",
      type: "Other",
      url: "",
      reference: "My recorded section",
      findings: "A recorded idea.",
      notes: "My original research note.",
      status: "Reviewed",
      lessonIds: [lessonId, "unrelated-lesson"],
      attachmentIds: ["paper-file"],
    },
  ],
  quotes: [
    {
      id: "existing-quote",
      sourceId: "existing-source",
      text: "A passage already recorded in the test fixture.",
      reference: "Recorded page",
      point: "Original teaching point.",
      commentary: "My existing interpretation.",
      use: "General reference",
      lessonIds: [lessonId],
    },
  ],
  visuals: [
    {
      id: "existing-diagram",
      title: "Existing visual model",
      description: "My existing diagram description.",
      concept: "An original concept.",
      placement: "Opening discussion",
      status: "Draft",
      notes: "Keep the revision notes.",
      url: "",
      attachmentId: "diagram-file",
      lessonIds: [lessonId, "unrelated-lesson"],
    },
  ],
  attachments: [
    {
      id: "paper-file",
      name: "paper.txt",
      mime: "text/plain",
      data:
        "data:text/plain;base64," +
        Buffer.from("Original attachment bytes").toString("base64"),
    },
    {
      id: "diagram-file",
      name: "model.svg",
      mime: "image/svg+xml",
      data: "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64"),
    },
  ],
};
const update = (
  changes: object = {},
  additions?: object,
  target = lessonId,
) => ({
  format: "learning-to-spiral.lesson-update",
  version: 1,
  lessonId: target,
  changes,
  ...(additions ? { additions } : {}),
});
async function saved(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("learning-to-spiral", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const value = await new Promise<any>((resolve, reject) => {
      const request = database
        .transaction("studio")
        .objectStore("studio")
        .get("library");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {
      ...value,
      attachments: await Promise.all(
        value.attachments.map(async (a: any) => ({
          id: a.id,
          name: a.name,
          mime: a.mime,
          bytes: Array.from(new Uint8Array(await a.blob.arrayBuffer())),
        })),
      ),
    };
  });
}
async function preview(page: Page, payload: object | string) {
  await page
    .getByRole("button", { name: "Import from ChatGPT", exact: true })
    .click();
  await page
    .getByLabel("JSON lesson update")
    .fill(typeof payload === "string" ? payload : JSON.stringify(payload));
  await page
    .getByRole("button", { name: "Preview changes", exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your Lesson Studio" }),
  ).toBeVisible();
  await page
    .getByLabel("Import portable backup")
    .setInputFiles({
      name: "self-image-example.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(fixture)),
    });
  await page.getByRole("button", { name: "Replace & restore" }).click();
  await page.getByRole("button", { name: /Self-image · Lesson 1/ }).click();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
});

test("Self-image Lesson 1 copies Markdown and selectively saves the ChatGPT round trip without losing linked material", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const before = await saved(page);
  await page
    .getByRole("button", { name: "Copy for ChatGPT", exact: true })
    .click();
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  for (const text of [
    lessonId,
    "\n## Teaching notes\n" + originalContent,
    "\n## My notes\n" + originalNotes,
    "\n## Outstanding questions\nHow can I explain self-image with care?",
    "My original research note.",
    "A passage already recorded in the test fixture.",
    "My existing interpretation.",
    "My existing diagram description.",
    "Keep the revision notes.",
    "Source ID: existing-source",
    "do not rewrite unrelated",
    "learning-to-spiral.lesson-update",
  ])
    expect(brief).toContain(text);
  const revisedContent =
    "## Foundation\nRevised teaching notes.\n\n### Practice\nA new reflection prompt.";
  await preview(
    page,
    update(
      {
        content: revisedContent,
        notes: "A revision I do not approve.",
        summary: fixture.lessons[0].summary,
        questions: "Which example best supports this lesson?",
      },
      {
        research: [
          {
            key: "suggestion-1",
            title: "Suggested reference to check",
            notes: "Verify bibliographic details.",
          },
        ],
        quotes: [
          {
            sourceId: "existing-source",
            text: "A submitted quote that I do not approve.",
          },
        ],
        diagrams: [
          {
            title: "Suggested teaching model",
            description:
              "A proposed diagram, without replacing the existing asset.",
          },
        ],
      },
    ),
  );
  await expect(
    page.getByRole("heading", { name: "6 proposed changes" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(originalContent);
  await expect(page.getByRole("dialog")).toContainText(revisedContent);
  expect(await saved(page)).toEqual(before); // Preview is read-only.
  await expect(
    page.getByRole("button", { name: "Save accepted changes" }),
  ).toBeDisabled();
  for (const label of [
    "Accept Teaching notes",
    "Accept Outstanding questions",
    "Accept research: Suggested reference to check",
    "Accept diagram: Suggested teaching model",
  ])
    await page.getByRole("checkbox", { name: label, exact: true }).check();
  await page.getByRole("button", { name: "Save accepted changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Teaching notes", { exact: true })).toHaveValue(
    revisedContent,
  );
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  const after = await saved(page);
  expect(after.lessons[0]).toEqual({
    ...before.lessons[0],
    content: revisedContent,
    questions: "Which example best supports this lesson?",
  });
  expect(after.lessons[1]).toEqual(before.lessons[1]);
  expect(after.sources[0]).toEqual(before.sources[0]);
  expect(after.sources[1]).toMatchObject({
    title: "Suggested reference to check",
    author: "",
    year: "",
    status: "Awaiting verification",
    lessonIds: [lessonId],
  });
  expect(after.quotes).toEqual(before.quotes);
  expect(after.visuals[0]).toEqual(before.visuals[0]);
  expect(after.attachments).toEqual(before.attachments);
  await page.reload();
  await page.getByRole("button", { name: /Self-image · Lesson 1/ }).click();
  await expect(page.getByLabel("Teaching notes", { exact: true })).toHaveValue(
    revisedContent,
  );
  await page.getByText("My reflections & notes", { exact: true }).click();
  await expect(page.getByLabel("My reflections and notes")).toHaveValue(
    originalNotes,
  );
  await page.getByText("Outstanding questions", { exact: true }).click();
  await expect(
    page.getByLabel("Outstanding questions", { exact: true }),
  ).toHaveValue("Which example best supports this lesson?");
  await page
    .getByRole("button", { name: "Export for ChatGPT", exact: true })
    .click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ChatGPT text" }).click();
  const file = await event;
  const markdown = await readFile((await file.path())!, "utf8");
  expect(markdown).toContain(revisedContent);
  expect(markdown).toContain(originalNotes);
  expect(markdown).toContain("Awaiting verification");
});

test("JSON file updates can explicitly clear one accepted field and leave rejected revisions intact", async ({
  page,
}) => {
  const before = await saved(page);
  await page
    .getByRole("button", { name: "Import from ChatGPT", exact: true })
    .click();
  await page
    .getByLabel("Upload ChatGPT lesson update")
    .setInputFiles({
      name: "lesson-update.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify(
          update({
            notes: "Approved personal reflection.",
            questions: "",
            content: "Rejected revision.",
          }),
        ),
      ),
    });
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(page.getByRole("dialog")).toContainText("clear this field only");
  await page
    .getByRole("checkbox", {
      name: "Accept My reflections & notes",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Accept Outstanding questions",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Save accepted changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  const after = await saved(page);
  expect(after).toEqual({
    ...before,
    lessons: [
      {
        ...before.lessons[0],
        notes: "Approved personal reflection.",
        questions: "",
      },
      before.lessons[1],
    ],
  });
});

test("malformed input, wrong IDs, unverified source claims, and deletion requests never change saved data", async ({
  page,
}) => {
  const before = await saved(page);
  await page
    .getByRole("button", { name: "Import from ChatGPT", exact: true })
    .click();
  const badInputs = [
    "{bad JSON",
    JSON.stringify(update({ content: null })),
    JSON.stringify(
      update({ content: "wrong target" }, undefined, "unknown-lesson"),
    ),
    JSON.stringify(
      update({ content: "wrong target" }, undefined, "unrelated-lesson"),
    ),
    JSON.stringify({ ...update(), deletions: ["existing-source"] }),
    JSON.stringify({ ...update(), attachments: [] }),
    JSON.stringify(update({ pillarId: "pillar-2" })),
    JSON.stringify(
      update(
        {},
        {
          research: [
            {
              key: "new",
              title: "Unsupported verified claim",
              status: "Reviewed",
            },
          ],
        },
      ),
    ),
    JSON.stringify(
      update(
        {},
        { quotes: [{ text: "Unattributed text", sourceId: "missing-source" }] },
      ),
    ),
    JSON.stringify(
      update(
        {},
        { diagrams: [{ title: "Unsafe link", url: "javascript:alert(1)" }] },
      ),
    ),
    JSON.stringify(
      update(
        {},
        {
          research: [
            {
              key: "existing",
              id: "existing-source",
              title: "Overwrite a master",
            },
          ],
        },
      ),
    ),
    JSON.stringify({ ...update(), additions: null }),
  ];
  for (const input of badInputs) {
    await page.getByLabel("JSON lesson update").fill(input);
    await page.getByRole("button", { name: "Preview changes" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save accepted changes" }),
    ).toBeDisabled();
    expect(await saved(page)).toEqual(before);
  }
});

test("quotes require accepting their original research suggestion and preserve missing attribution", async ({
  page,
}) => {
  const before = await saved(page);
  await preview(
    page,
    update(
      {},
      {
        research: [{ key: "new-source", title: "Source to verify" }],
        quotes: [
          {
            sourceKey: "new-source",
            text: "Exact passage submitted for review.",
            reference: "A recorded section",
            use: "YouTube",
          },
        ],
      },
    ),
  );
  await page
    .getByRole("checkbox", { name: "Accept quote: Quote 1", exact: true })
    .check();
  await page.getByRole("button", { name: "Save accepted changes" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Accept its source too",
  );
  expect(await saved(page)).toEqual(before);
  await page
    .getByRole("checkbox", {
      name: "Accept research: Source to verify",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Save accepted changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await saved(page);
  expect(after.quotes[1].sourceId).toBe(after.sources[1].id);
  expect(after.sources[1]).toMatchObject({
    author: "",
    year: "",
    status: "Awaiting verification",
  });
  expect(after.quotes[0]).toEqual(before.quotes[0]);
});

test("unchanged fields are omitted from preview, and cancel rejects all changes", async ({
  page,
}) => {
  const before = await saved(page);
  await preview(
    page,
    "```json\n" +
      JSON.stringify(update({ content: originalContent })) +
      "\n```",
  );
  await expect(
    page.getByRole("heading", { name: "No changes found" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save accepted changes" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await preview(page, update({ content: "A change I reject." }));
  await page
    .getByRole("checkbox", { name: "Accept Teaching notes", exact: true })
    .check();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await saved(page)).toEqual(before);
});

test("a failed local save leaves the previous workspace intact and allows retry", async ({
  page,
}) => {
  const before = await saved(page);
  await preview(page, update({ content: "Approved revised notes." }));
  await page
    .getByRole("checkbox", { name: "Accept Teaching notes", exact: true })
    .check();
  await page.evaluate(() => {
    (window as any).originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Save accepted changes" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Quota exceeded",
  );
  expect(await saved(page)).toEqual(before);
  await expect(page.getByLabel("Teaching notes", { exact: true })).toHaveValue(
    originalContent,
  );
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = (window as any).originalPut;
  });
  await page.getByRole("button", { name: "Save accepted changes" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Teaching notes", { exact: true })).toHaveValue(
    "Approved revised notes.",
  );
});

test("clipboard denial provides a readable manual brief instead of reporting a successful copy", async ({
  page,
}) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard denied");
        },
      },
    });
    document.execCommand = () => false;
  });
  await page
    .getByRole("button", { name: "Copy for ChatGPT", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Clipboard unavailable");
  await expect(
    page.getByRole("dialog").locator(".export-preview"),
  ).toContainText(originalContent);
  await expect(
    page.getByRole("dialog").locator(".export-preview"),
  ).toContainText(lessonId);
});

test("the standalone HTML supports the exchange offline and keeps the existing library", async ({
  page,
  context,
}) => {
  const html = await readFile("dist/Learning-to-Spiral.html", "utf8");
  const url = "http://127.0.0.1:5173/exchange-offline";
  await context.route(url, (route) =>
    route.fulfill({ body: html, contentType: "text/html" }),
  );
  await context.setOffline(true);
  await page.goto(url);
  await page.getByRole("button", { name: /Self-image · Lesson 1/ }).click();
  const before = await saved(page);
  await preview(page, update({ content: "Offline approved teaching notes." }));
  await page
    .getByRole("checkbox", { name: "Accept Teaching notes", exact: true })
    .check();
  await page.getByRole("button", { name: "Save accepted changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  await page.reload();
  await page.getByRole("button", { name: /Self-image · Lesson 1/ }).click();
  const after = await saved(page);
  expect(after).toEqual({
    ...before,
    lessons: [
      { ...before.lessons[0], content: "Offline approved teaching notes." },
      before.lessons[1],
    ],
  });
});
