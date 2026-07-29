import { expect, test } from '@playwright/test';

/**
 * The path a user actually takes to use their own model server: configure it in
 * Settings, turn it into an agent, chat. Regression guard for the gap where a
 * configured connection was unusable without knowing to visit Agents first.
 * Points at the discard port so the unreachable path is deterministic no matter
 * what happens to be listening on the machine running this.
 */
test('a connection is usable from Settings without a detour', async ({ page }) => {
  const name = `probe-${Date.now()}`;

  await page.goto('/settings');
  await page.getByRole('button', { name: 'Add connection' }).click();
  await page.locator('input[placeholder="apfel-local"]').fill(name);
  await page
    .locator('input[placeholder="http://127.0.0.1:11434/v1"]')
    .fill('http://127.0.0.1:9/v1');
  await page.locator('form button[type="submit"]').click();

  // Scope to this connection's own row — the page lists every saved connection.
  const row = page.locator('li').filter({ hasText: name });
  await expect(row).toBeVisible({ timeout: 15_000 });

  await row.getByRole('button', { name: 'Test' }).click();
  await expect(row.getByText(/Could not reach|Reachable/)).toBeVisible({ timeout: 15_000 });

  // Creating an agent is one click from here — with nothing listening it must
  // say why instead of creating an agent pointed at a dead endpoint.
  await row.getByRole('button', { name: 'Create agent' }).click();
  await expect(row.getByText(/No models reported|Could not reach/)).toBeVisible({
    timeout: 15_000,
  });

  // Leave the shared database as we found it.
  await row.getByRole('button', { name: `Delete ${name}` }).click();
  await expect(row).toHaveCount(0, { timeout: 10_000 });
});

test('an agent page opens a chat directly', async ({ page }) => {
  await page.goto('/agents');
  await page.getByRole('link', { name: /Demo/ }).first().click();
  await page.waitForURL(/\/agents\/[0-9a-f-]{36}$/);

  await page.getByRole('button', { name: 'Start chat' }).click();
  await page.waitForURL(/\/chat\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  await page.getByLabel('Message').fill('Say hello');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByTestId('trace-timeline')).toBeVisible({ timeout: 20_000 });
});
