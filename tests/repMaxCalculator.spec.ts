import { test, expect } from "@playwright/test";
import { PlaywrightUtils } from "./playwrightUtils";

test("Rep Max Calculator", async ({ page }) => {
  await page.goto("https://local.liftosaur.com:8080/app/?skipintro=1");
  await page.getByRole("button", { name: "Basic Beginner Routine" }).click();
  await page.getByTestId("clone-program").click();
  await page.getByTestId("start-workout").click();

  await page.getByTestId("entry-bench-press").getByTestId("exercise-edit-mode").click();
  await page.getByTestId("state-weight-calculator").click();

  await PlaywrightUtils.type("3", () => page.getByTestId("rep-max-calculator-known-reps"));
  await PlaywrightUtils.type("8", () => page.getByTestId("rep-max-calculator-known-rpe"));
  await PlaywrightUtils.type("5", () => page.getByTestId("rep-max-calculator-target-reps"));
  await PlaywrightUtils.type("7", () => page.getByTestId("rep-max-calculator-target-rpe"));

  await expect(page.getByTestId("rep-max-calculator-target-weight")).toHaveText("182 lb");

  await page.getByTestId("rep-max-calculator-submit").click();
  await expect(page.getByTestId("menu-item-value-weight")).toHaveValue("182");

  await page.getByTestId("modal-edit-mode-program").click();
  await page.getByTestId("tab-advanced").click();
  await page.getByTestId("state-weight-calculator").click();

  await PlaywrightUtils.type("150", () => page.getByTestId("rep-max-calculator-known-weight"));
  await expect(page.getByTestId("rep-max-calculator-target-weight")).toHaveText("173 lb");

  await page.getByTestId("rep-max-calculator-submit").click();
  await expect(page.getByTestId("menu-item-value-weight")).toHaveValue("173");
});
