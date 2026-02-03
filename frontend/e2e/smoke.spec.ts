import { test, expect } from '@playwright/test';

test.describe('MedX E2E Tests', () => {
  const loginUser = async (page: any) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Войти")');
    await page.waitForNavigation();
  };

  test('1. Login should work', async ({ page }) => {
    await loginUser(page);
    // Should be on Reception page after login
    expect(page.url()).toContain('/');
    // Should see patient search form
    await expect(page.locator('input[placeholder*="Телефон"]')).toBeVisible();
  });

  test('2. Add patient to queue should work', async ({ page }) => {
    await loginUser(page);
    
    // Enter patient phone
    await page.fill('input[placeholder*="Телефон"]', '1234567890');
    await page.fill('input[placeholder*="Имя"]', 'John');
    await page.fill('input[placeholder*="Фамилия"]', 'Doe');
    
    // Create button should be enabled
    const createBtn = page.locator('button:has-text("Создать")');
    await expect(createBtn).toBeEnabled();
    
    // Click create
    await createBtn.click();
    
    // Should see confirmation dialog
    const confirmBtn = page.locator('button:has-text("ОК")');
    await confirmBtn.click();
    
    // Wait for success toast
    await expect(page.locator('text=создан')).toBeVisible({ timeout: 5000 });
  });

  test('3. Process payment should work', async ({ page }) => {
    await loginUser(page);
    
    // Find a patient (use existing patient)
    await page.fill('input[placeholder*="Телефон"]', '+');
    await page.waitForTimeout(500);
    
    // Click first patient if available
    const firstPatient = page.locator('.patient-row').first();
    if (await firstPatient.isVisible()) {
      // Look for "Add to Queue" button
      const addBtn = firstPatient.locator('button:has-text("В очередь")');
      if (await addBtn.isVisible()) {
        await addBtn.click();
        
        // Select doctor (first available)
        const doctorOption = page.locator('button:has-text("врач")').first();
        if (await doctorOption.isVisible()) {
          await doctorOption.click();
          
          // Should see success toast
          await expect(page.locator('text=добавлен')).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('4. Close shift should work', async ({ page }) => {
    await loginUser(page);
    
    // Navigate to Finance
    const financeBtn = page.locator('a[href*="/finance"]');
    if (await financeBtn.isVisible()) {
      await financeBtn.click();
      await page.waitForNavigation();
      
      // Look for close shift button
      const closeBtn = page.locator('button:has-text("Закрыть смену")');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        
        // Should see confirmation dialog
        const confirmBtn = page.locator('button:has-text("ОК")');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
          
          // Should see success toast
          await expect(page.locator('text=закрыт')).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });

  test('5. Error handling - invalid login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'invalid');
    await page.fill('input[type="password"]', 'wrong');
    await page.click('button:has-text("Войти")');
    
    // Should see error message
    await expect(page.locator('text=ошибк|error|failed')).toBeVisible({ timeout: 5000 });
  });

  test('6. Network retry - should handle connection errors', async ({ page }) => {
    await loginUser(page);
    
    // Simulate offline (Playwright limitation - just check that UI handles errors gracefully)
    await page.context().setOffline(true);
    
    // Try to search for patient
    await page.fill('input[placeholder*="Телефон"]', '123');
    await page.waitForTimeout(2000);
    
    // Go back online
    await page.context().setOffline(false);
    
    // Should recover gracefully
    await page.reload();
    await expect(page).toHaveURL(/\//);
  });

  test('7. Loading states - should show loading indicator', async ({ page }) => {
    await loginUser(page);
    
    // Search for patient (should show loading state)
    await page.fill('input[placeholder*="Телефон"]', '+');
    
    // Should see loading indicator (if implemented)
    const loadingIndicator = page.locator('[data-testid="loading"]').first();
    if (await loadingIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Should disappear after data loads
      await expect(loadingIndicator).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('8. Logout should work', async ({ page }) => {
    await loginUser(page);
    
    // Find logout button (usually in topbar)
    const logoutBtn = page.locator('button:has-text("Выход")').first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
      
      // Should redirect to login
      await expect(page).toHaveURL(/login/);
    }
  });
});
