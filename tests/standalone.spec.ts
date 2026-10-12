import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";

async function checkStandalone(
  page: Page,
  context: BrowserContext,
  url: string,
) {
  // Offline also proves this is a self-contained file, without Vite or a CDN.
  await context.setOffline(true);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Your Lesson Studio" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New lesson", exact: true }).click();
  await page.getByLabel("Lesson title", { exact: true }).fill("Offline lesson");
  await page
    .getByRole("dialog")
    .getByLabel("Pillar", { exact: true })
    .selectOption({ label: "Integration & embodiment" });
  await page
    .getByRole("button", { name: "Create lesson", exact: true })
    .click();
  await page.getByRole("tab", { name: /Diagrams & Visuals/ }).click();
  await page.getByRole("button", { name: "Add diagram", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill("Offline visual");
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="10"/></svg>';
  await page.getByLabel("Upload diagram image").setInputFiles({
    name: "offline.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(svg),
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("img", { name: "Offline visual" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Saved locally");
  await page.reload();
  await page.getByRole("button", { name: /Offline lesson/ }).click();
  await expect(page.getByLabel("Pillar", { exact: true })).toHaveValue(
    "pillar-9",
  );
  await page.getByRole("tab", { name: /Diagrams & Visuals/ }).click();
  await expect(page.getByRole("img", { name: "Offline visual" })).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download backup", exact: true })
    .click();
  const download = await downloadEvent;
  const backup = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(backup.lessons[0].pillarId).toBe("pillar-9");
  expect(
    Buffer.from(backup.attachments[0].data.split(",")[1], "base64").toString(),
  ).toBe(svg);
  expect(errors).toEqual([]);
}

test("embedded standalone HTML works offline, saves lessons and images, and exports a portable backup", async ({
  page,
  context,
}) => {
  const html = await readFile(resolve("dist/Learning-to-Spiral.html"), "utf8");
  expect(html).not.toMatch(
    /<script\b[^>]*\bsrc=|<link\b[^>]*\brel="stylesheet"/i,
  );
  // Serve the exact standalone bytes through an allowed local origin. All
  // other network access remains offline; no Vite assets or CDN are available.
  const url = "http://127.0.0.1:5173/standalone-test";
  await context.route(url, (route) =>
    route.fulfill({ body: html, contentType: "text/html" }),
  );
  await checkStandalone(page, context, url);
});

test("standalone HTML supports direct file opening", async ({
  page,
  context,
}) => {
  try {
    await checkStandalone(
      page,
      context,
      pathToFileURL(resolve("dist/Learning-to-Spiral.html")).href,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("net::ERR_BLOCKED_BY_ADMINISTRATOR")
    ) {
      test.skip(
        true,
        "The managed cloud browser policy forbids file:// navigation. Direct opening must be checked in a browser permitting local files.",
      );
    }
    throw error;
  }
});
