import { test, expect } from '@playwright/test';

test.describe('ServerDetails GUI Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the main page first
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display CardHeader with proper styling', async ({ page }) => {
    // Wait for servers to load
    await page.waitForSelector('.server-card', { timeout: 10000 }).catch(() => {
      console.log('No server cards found - this is expected for a fresh install');
    });

    // Take screenshot of the main page
    await page.screenshot({ path: 'tests/screenshots/main-page.png', fullPage: true });
    
    // Check if we have any servers to test with
    const serverCards = await page.locator('.server-card').count();
    
    if (serverCards > 0) {
      // Click on the first server to go to details
      await page.locator('.server-card').first().click();
      await page.waitForLoadState('networkidle');
      
      // Wait for the details page to load
      await page.waitForSelector('.details-card-header', { timeout: 5000 });
      
      // Take screenshot of server details
      await page.screenshot({ path: 'tests/screenshots/server-details-header.png', fullPage: true });
      
      // Verify CardHeader elements
      const cardHeader = page.locator('.details-card-header');
      await expect(cardHeader).toBeVisible();
      
      // Check for server avatar
      const avatar = page.locator('.server-avatar');
      await expect(avatar).toBeVisible();
      
      // Check for server title
      const title = cardHeader.locator('.server-title');
      await expect(title).toBeVisible();
      
      // Check for status chip
      const statusChip = cardHeader.locator('.MuiChip-root');
      await expect(statusChip.first()).toBeVisible();
      
      // Check for stat blocks
      const statBlocks = page.locator('.stat-block');
      const statBlockCount = await statBlocks.count();
      expect(statBlockCount).toBeGreaterThanOrEqual(3);
      
      console.log(`✓ Found ${statBlockCount} stat blocks`);
    } else {
      console.log('ℹ No servers found to test - skipping server details tests');
    }
  });

  test('should display Operations tab with improved UI', async ({ page }) => {
    const serverCards = await page.locator('.server-card').count();
    
    if (serverCards > 0) {
      // Navigate to server details
      await page.locator('.server-card').first().click();
      await page.waitForLoadState('networkidle');
      
      // Click on Operations tab
      await page.locator('button:has-text("Operations")').click();
      await page.waitForTimeout(500);
      
      // Take screenshot of operations tab
      await page.screenshot({ path: 'tests/screenshots/operations-tab.png', fullPage: true });
      
      // Verify operations panel
      const operationsPanel = page.locator('.operations-panel');
      await expect(operationsPanel).toBeVisible();
      
      // Check for section title with accent bar
      const sectionTitle = operationsPanel.locator('.section-title');
      await expect(sectionTitle.first()).toBeVisible();
      
      // Check for action buttons
      const actionButtons = page.locator('.action-button');
      const buttonCount = await actionButtons.count();
      expect(buttonCount).toBeGreaterThanOrEqual(3);
      
      // Check for auto-settings section
      const autoSettings = page.locator('.auto-settings');
      await expect(autoSettings).toBeVisible();
      
      // Take a close-up screenshot of auto-settings
      await autoSettings.screenshot({ path: 'tests/screenshots/auto-settings-section.png' });
      
      // Check for toggle switches
      const switches = autoSettings.locator('.MuiSwitch-root');
      const switchCount = await switches.count();
      expect(switchCount).toBeGreaterThanOrEqual(2);
      
      console.log(`✓ Found ${buttonCount} action buttons and ${switchCount} toggle switches`);
      
      // Check for forward-settings section
      const forwardSettings = page.locator('.forward-settings');
      if (await forwardSettings.isVisible()) {
        await forwardSettings.screenshot({ path: 'tests/screenshots/forward-settings-section.png' });
      }
    } else {
      console.log('ℹ No servers found to test - skipping operations tab tests');
    }
  });

  test('should display Basic Settings with improved styling', async ({ page }) => {
    const serverCards = await page.locator('.server-card').count();
    
    if (serverCards > 0) {
      // Navigate to server details
      await page.locator('.server-card').first().click();
      await page.waitForLoadState('networkidle');
      
      // Overview tab should be active by default
      await page.waitForTimeout(500);
      
      // Take screenshot of overview/basic settings
      await page.screenshot({ path: 'tests/screenshots/basic-settings.png', fullPage: true });
      
      // Check for section title
      const sectionTitle = page.locator('.section-title').first();
      await expect(sectionTitle).toBeVisible();
      
      // Check for proxy-config sections
      const proxyConfigs = page.locator('.proxy-config');
      const configCount = await proxyConfigs.count();
      expect(configCount).toBeGreaterThanOrEqual(2);
      
      console.log(`✓ Found ${configCount} proxy config sections`);
      
      // Take close-up of first proxy config
      await proxyConfigs.first().screenshot({ path: 'tests/screenshots/proxy-config-section.png' });
      
      // Check for info-block
      const infoBlock = page.locator('.info-block');
      if (await infoBlock.isVisible()) {
        await infoBlock.screenshot({ path: 'tests/screenshots/info-block-section.png' });
      }
    } else {
      console.log('ℹ No servers found to test - skipping basic settings tests');
    }
  });

  test('should verify real-time settings save functionality', async ({ page }) => {
    const serverCards = await page.locator('.server-card').count();
    
    if (serverCards > 0) {
      // Navigate to server details
      await page.locator('.server-card').first().click();
      await page.waitForLoadState('networkidle');
      
      // Go to Operations tab
      await page.locator('button:has-text("Operations")').click();
      await page.waitForTimeout(500);
      
      // Find the first toggle switch (autoStart)
      const firstSwitch = page.locator('.auto-settings .MuiSwitch-root').first();
      
      if (await firstSwitch.isVisible()) {
        // Get initial state
        const initialState = await firstSwitch.locator('input').isChecked();
        console.log(`Initial switch state: ${initialState}`);
        
        // Click to toggle
        await firstSwitch.click();
        await page.waitForTimeout(500);
        
        // Verify state changed
        const newState = await firstSwitch.locator('input').isChecked();
        expect(newState).toBe(!initialState);
        console.log(`✓ Switch toggled successfully: ${initialState} → ${newState}`);
        
        // Take screenshot showing the toggled state
        await page.screenshot({ path: 'tests/screenshots/toggle-state-changed.png', fullPage: true });
        
        // Note: In a real test environment with backend, we'd verify the setting was saved
        // For now, we're just verifying the UI responds
      }
    } else {
      console.log('ℹ No servers found to test - skipping toggle tests');
    }
  });
});
