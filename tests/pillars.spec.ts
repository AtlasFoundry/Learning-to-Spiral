import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function backup(page: Page) {
  const event = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download backup", exact: true })
    .click();
  const file = await event;
  return JSON.parse(await readFile((await file.path())!, "utf8"));
}
async function restore(page: Page, data: object) {
  await page.getByLabel("Import portable backup").setInputFiles({
    name: "pillars.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await page.getByRole("button", { name: "Replace & restore" }).click();
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your Lesson Studio" }),
  ).toBeVisible();
});

test("pillar aims and dispositions stay separate, persist after reload, and inform the correct lesson brief", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await expect(
    page.getByRole("textbox", {
      name: "What this pillar aims to accomplish",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "01 Self-image", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Self-image", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", {
      name: "What this pillar aims to accomplish",
      exact: true,
    })
    .fill("A self-image intention.\nA second line in my own words.");
  await page
    .getByLabel("Central disposition", { exact: true })
    .fill("A curious, compassionate orientation.");
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  await page
    .getByRole("button", { name: "02 Attention & mind", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "What this pillar aims to accomplish",
      exact: true,
    }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Central disposition", { exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("textbox", {
      name: "What this pillar aims to accomplish",
      exact: true,
    })
    .fill("An attention intention.");
  await page
    .getByLabel("Central disposition", { exact: true })
    .fill("Steady attention.");
  await page.getByRole("button", { name: "New lesson", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByLabel("Pillar", { exact: true }),
  ).toHaveValue("pillar-2");
  await page
    .getByLabel("Lesson title", { exact: true })
    .fill("A lesson in attention");
  await page
    .getByRole("button", { name: "Create lesson", exact: true })
    .click();
  await page
    .getByLabel("Teaching notes", { exact: true })
    .fill("Keep the original lesson content.");
  await page
    .getByRole("button", { name: "Copy for ChatGPT", exact: true })
    .click();
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  expect(brief).toContain(
    "\n## What this pillar aims to accomplish\nAn attention intention.",
  );
  expect(brief).toContain("\n## Central disposition\nSteady attention.");
  expect(brief).not.toContain("A self-image intention.");
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  await page.reload();
  await page.getByLabel("View pillar").selectOption("pillar-1");
  await expect(
    page.getByRole("textbox", {
      name: "What this pillar aims to accomplish",
      exact: true,
    }),
  ).toHaveValue("A self-image intention.\nA second line in my own words.");
  await expect(
    page.getByLabel("Central disposition", { exact: true }),
  ).toHaveValue("A curious, compassionate orientation.");
  await page.getByLabel("View pillar").selectOption("pillar-2");
  await expect(
    page.getByLabel("Central disposition", { exact: true }),
  ).toHaveValue("Steady attention.");
  await page.getByRole("button", { name: /A lesson in attention/ }).click();
  await expect(page.getByLabel("Teaching notes", { exact: true })).toHaveValue(
    "Keep the original lesson content.",
  );
});

test("backups preserve pillar context, older backups remain usable, and malformed context is rejected", async ({
  page,
}) => {
  await page.getByLabel("View pillar").selectOption("pillar-7");
  await page
    .getByRole("textbox", {
      name: "What this pillar aims to accomplish",
      exact: true,
    })
    .fill("My pillar intention.\nAnother paragraph.");
  await page
    .getByLabel("Central disposition", { exact: true })
    .fill("My central disposition.");
  await page.getByRole("button", { name: "New lesson", exact: true }).click();
  await page
    .getByLabel("Lesson title", { exact: true })
    .fill("A preserved lesson");
  await page
    .getByRole("button", { name: "Create lesson", exact: true })
    .click();
  await page
    .getByLabel("Teaching notes", { exact: true })
    .fill("Original teaching content.");
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  const data = await backup(page);
  expect(data.pillars[6]).toMatchObject({
    aim: "My pillar intention.\nAnother paragraph.",
    disposition: "My central disposition.",
  });
  await page.getByRole("button", { name: "All lessons", exact: true }).click();
  await page.getByLabel("View pillar").selectOption("pillar-7");
  await page
    .getByRole("textbox", {
      name: "What this pillar aims to accomplish",
      exact: true,
    })
    .fill("Temporary edit.");
  await page
    .getByLabel("Central disposition", { exact: true })
    .fill("Temporary disposition.");
  await restore(page, data);
  await expect(
    page.getByRole("textbox", {
      name: "What this pillar aims to accomplish",
      exact: true,
    }),
  ).toHaveValue("My pillar intention.\nAnother paragraph.");
  await expect(
    page.getByLabel("Central disposition", { exact: true }),
  ).toHaveValue("My central disposition.");
  for (const field of ["aim", "disposition"]) {
    const invalid = structuredClone(data);
    invalid.pillars[6][field] = { invalid: true };
    await page.getByLabel("Import portable backup").setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(invalid)),
    });
    await expect(page.getByRole("alert")).toContainText("not a valid");
    await expect(
      page.getByLabel("Central disposition", { exact: true }),
    ).toHaveValue("My central disposition.");
  }
  const legacy = structuredClone(data);
  for (const pillar of legacy.pillars) {
    delete pillar.aim;
    delete pillar.disposition;
  }
  await restore(page, legacy);
  await expect(
    page.getByRole("textbox", {
      name: "What this pillar aims to accomplish",
      exact: true,
    }),
  ).toHaveValue("");
  await expect(
    page.getByLabel("Central disposition", { exact: true }),
  ).toHaveValue("");
  await page.getByRole("button", { name: /A preserved lesson/ }).click();
  await expect(page.getByLabel("Teaching notes", { exact: true })).toHaveValue(
    "Original teaching content.",
  );
});

test("sidebar pillar navigation opens its context from the library, and mobile users can choose every pillar", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Research & Visuals", exact: true })
    .click();
  await page
    .getByRole("button", { name: "03 Goals & discernment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Goals & discernment", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Central disposition", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("View pillar").selectOption("pillar-9");
  await expect(
    page.getByRole("heading", {
      name: "Integration & embodiment",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", {
      name: "What this pillar aims to accomplish",
      exact: true,
    })
    .fill("A mobile pillar intention.");
  await page
    .getByLabel("Central disposition", { exact: true })
    .fill("A mobile disposition.");
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("View pillar").selectOption("pillar-1");
  await expect(
    page.getByLabel("Central disposition", { exact: true }),
  ).toHaveValue("");
  await page.getByLabel("View pillar").selectOption("pillar-9");
  await expect(
    page.getByLabel("Central disposition", { exact: true }),
  ).toHaveValue("A mobile disposition.");
});
