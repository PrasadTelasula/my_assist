import { expect, test } from '@playwright/test';

/**
 * Fake-provider smokes: the dev server runs with MY_ASSIST_PROVIDER=fake, so
 * the Demo agent works every flow deterministically without API keys.
 */

test('chat: message → live trace shows the tool call → assistant reply', async ({ page }) => {
  await page.goto('/chat');
  await page.getByRole('button', { name: 'New chat' }).click();
  await page.getByLabel('Agent').selectOption({ label: 'Demo · demo' });
  await page.getByRole('button', { name: 'Start chat' }).click();

  await page.getByLabel('Message').fill('What time is it?');
  await page.getByRole('button', { name: 'Send' }).click();

  // The trace panel streams the get_time call, then the reply lands in the transcript.
  await expect(page.getByTestId('trace-timeline')).toContainText('get_time', { timeout: 15_000 });
  await expect(
    page.getByText('Demo reply: everything is wired up and working.').first(),
  ).toBeVisible({ timeout: 15_000 });
});

test('board: goal fills the backlog, assigning the agent drives the card to Review', async ({
  page,
}) => {
  await page.goto('/board');

  page.on('dialog', (dialog) => void dialog.accept(`Sprint ${Date.now()}`));
  await page.getByRole('button', { name: 'New sprint' }).click();
  await expect(page.getByRole('button', { name: 'Plan from goal' })).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole('button', { name: 'Plan from goal' }).click();
  await page.getByLabel('Sprint goal').fill('Demonstrate the platform end to end');
  await page.getByLabel('Planner agent').selectOption({ label: 'Demo' });
  await page.getByRole('button', { name: 'Fill the backlog' }).click();

  // Planner run inserts two demo stories into Backlog.
  await expect(page.getByText('Demo story 1')).toBeVisible({ timeout: 20_000 });

  // Assign the demo agent via the drawer; it works the card to Review.
  await page.getByText('Demo story 1').click();
  await page.getByLabel('Assignee').selectOption({ label: '🤖 Demo' });
  await expect(page.getByText('Demo work finished; ready for review.')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('review', { exact: false }).first()).toBeVisible();
});
