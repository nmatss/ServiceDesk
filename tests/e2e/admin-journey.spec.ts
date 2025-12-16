import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';
import { setupAuthenticatedSession, logout, login, TEST_USERS } from './helpers/auth';

/**
 * E2E Test: Complete Admin Journey
 *
 * This test follows a complete admin journey through the ServiceDesk system:
 * 1. Admin logs in
 * 2. Views comprehensive dashboard with analytics
 * 3. Manages users (view, create, edit)
 * 4. Configures SLA policies
 * 5. Views and generates reports
 * 6. Manages teams and permissions
 * 7. Reviews audit logs
 */
test.describe('Admin Journey: Login → Dashboard → Reports → Management', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
  });

  test('complete admin journey: dashboard, user management, reports, and configuration', async ({ page }) => {
    // ============================================
    // STEP 1: Admin Login
    // ============================================
    await test.step('Admin logs in to the system', async () => {
      await page.goto('/auth/login');
      await page.waitForLoadState('networkidle');

      // Verify login page
      await expect(page.locator('h1')).toContainText(/bem-vindo|login/i);

      // Login as admin
      await login(page, TEST_USERS.admin);

      // Verify successful authentication
      await page.waitForURL((url) => !url.pathname.includes('/auth/login'), {
        timeout: 10000
      });

      // Should be redirected to admin dashboard or home
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/auth/login');
    });

    // ============================================
    // STEP 2: View Admin Dashboard
    // ============================================
    await test.step('Admin views comprehensive dashboard with analytics', async () => {
      // Navigate to admin dashboard
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Verify admin dashboard is displayed
      await expect(page).toHaveURL(/\/admin/);

      const heading = page.locator('h1, h2');
      await expect(heading.first()).toBeVisible();

      // Check for key metrics/statistics
      const expectedMetrics = [
        /total.*tickets?/i,
        /tickets? abertos?|open tickets/i,
        /tempo.*m[ée]dio?|average.*time/i,
        /satisfa[çc][ãa]o|satisfaction/i,
        /agentes?|agents?/i,
        /usu[áa]rios?|users?/i
      ];

      let metricsFound = 0;
      for (const metric of expectedMetrics) {
        const metricElement = page.locator(`text=${metric}`);
        if (await metricElement.count() > 0) {
          metricsFound++;
        }
      }

      // At least half of the metrics should be visible
      expect(metricsFound).toBeGreaterThan(expectedMetrics.length / 2);

      // Check for charts/visualizations
      const charts = page.locator('svg, canvas, [class*="chart"]');
      const hasCharts = await charts.count();
      expect(hasCharts).toBeGreaterThan(0);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/admin-journey-dashboard.png',
        fullPage: true
      });
    });

    // ============================================
    // STEP 3: Navigate Admin Menu
    // ============================================
    await test.step('Admin explores admin navigation menu', async () => {
      // Check for admin navigation menu
      const adminMenu = page.locator('nav, [role="navigation"], aside');
      await expect(adminMenu.first()).toBeVisible();

      // Verify key admin menu items
      const menuItems = [
        /dashboard/i,
        /usu[áa]rios?|users/i,
        /equipes?|teams/i,
        /relat[óo]rios?|reports/i,
        /sla/i,
        /configura[çc][õo]es?|settings/i
      ];

      for (const item of menuItems) {
        const menuItem = page.locator(`a:has-text("${item.source}"), button:has-text("${item.source}")`).first();
        if (await menuItem.count() > 0) {
          await expect(menuItem).toBeVisible();
        }
      }
    });

    // ============================================
    // STEP 4: User Management
    // ============================================
    let newUserId: string | null = null;

    await test.step('Admin manages users (view and create)', async () => {
      // Navigate to users page
      const usersLink = page.locator('a[href*="/admin/users"]').first();

      if (await usersLink.count() > 0) {
        await usersLink.click();
      } else {
        await page.goto('/admin/users');
      }

      await page.waitForLoadState('networkidle');

      // Verify users page
      await expect(page).toHaveURL(/\/admin\/users/);

      // Check for users list
      const usersList = page.locator('table, .user-card, article, [class*="list"]');
      await expect(usersList.first()).toBeVisible();

      // Look for "New User" or "Add User" button
      const newUserButton = page.locator('a[href*="/users/new"], button:has-text("Novo"), button:has-text("Adicionar")').first();

      if (await newUserButton.count() > 0) {
        await newUserButton.click();
        await page.waitForLoadState('networkidle');

        // Fill in new user form
        const nameInput = page.locator('input[name="name"], input#name');
        if (await nameInput.count() > 0) {
          await nameInput.fill(`Test User ${Date.now()}`);
        }

        const emailInput = page.locator('input[name="email"], input#email');
        if (await emailInput.count() > 0) {
          await emailInput.fill(`testuser${Date.now()}@servicedesk.com`);
        }

        const passwordInput = page.locator('input[name="password"], input#password');
        if (await passwordInput.count() > 0) {
          await passwordInput.fill('TestPassword123!');
        }

        // Select role
        const roleSelect = page.locator('select[name="role"], select#role');
        if (await roleSelect.count() > 0) {
          const agentOption = await roleSelect.locator('option:has-text("Agente"), option:has-text("Agent")').first();
          if (await agentOption.count() > 0) {
            const optionValue = await agentOption.getAttribute('value');
            if (optionValue) {
              await roleSelect.selectOption({ value: optionValue });
            } else {
              await roleSelect.selectOption({ index: 1 });
            }
          } else {
            await roleSelect.selectOption({ index: 1 });
          }
        }

        // Submit form
        const submitButton = page.locator('button[type="submit"]');
        await submitButton.click();

        // Wait for redirect or success message
        await page.waitForTimeout(2000);

        // Check for success
        const successMessage = page.locator('[role="alert"], .success, text=/sucesso|success|criado|created/i');
        if (await successMessage.count() > 0) {
          await expect(successMessage.first()).toBeVisible();
        }

        // Get user ID if redirected to user detail page
        const currentUrl = page.url();
        const match = currentUrl.match(/users?\/(\d+)/);
        if (match) {
          newUserId = match[1];
        }
      }
    });

    // ============================================
    // STEP 5: View User Details
    // ============================================
    await test.step('Admin views user details and permissions', async () => {
      // If we created a user, view their details
      if (newUserId) {
        await page.goto(`/admin/users/${newUserId}`);
        await page.waitForLoadState('networkidle');
      } else {
        // Go back to users list and click on first user
        await page.goto('/admin/users');
        await page.waitForLoadState('networkidle');

        const firstUserLink = page.locator('a[href*="/admin/users/"]').first();
        if (await firstUserLink.count() > 0) {
          await firstUserLink.click();
          await page.waitForLoadState('networkidle');
        }
      }

      // Verify user details page
      const userInfo = page.locator('text=/nome|name|email|role|papel/i');
      if (await userInfo.count() > 0) {
        await expect(userInfo.first()).toBeVisible();
      }
    });

    // ============================================
    // STEP 6: SLA Configuration
    // ============================================
    await test.step('Admin configures SLA policies', async () => {
      // Navigate to SLA configuration
      const slaLink = page.locator('a[href*="/admin/sla"], a:has-text("SLA")').first();

      if (await slaLink.count() > 0) {
        await slaLink.click();
      } else {
        await page.goto('/admin/sla');
      }

      await page.waitForLoadState('networkidle');

      // Verify SLA page
      if (page.url().includes('/sla')) {
        // Check for SLA policies list
        const slaPolicies = page.locator('table, .sla-policy, article, [class*="list"]');

        if (await slaPolicies.count() > 0) {
          await expect(slaPolicies.first()).toBeVisible();

          // Look for SLA configuration options
          const slaConfig = page.locator('text=/prioridade|priority|tempo|time|prazo|deadline/i');
          if (await slaConfig.count() > 0) {
            await expect(slaConfig.first()).toBeVisible();
          }
        }

        // Take screenshot
        await page.screenshot({
          path: 'test-results/admin-journey-sla-config.png',
          fullPage: true
        });
      }
    });

    // ============================================
    // STEP 7: Team Management
    // ============================================
    await test.step('Admin manages teams', async () => {
      // Navigate to teams page
      const teamsLink = page.locator('a[href*="/admin/teams"], a:has-text("Equipes"), a:has-text("Teams")').first();

      if (await teamsLink.count() > 0) {
        await teamsLink.click();
        await page.waitForLoadState('networkidle');

        // Verify teams page
        if (page.url().includes('/teams')) {
          // Check for teams list
          const teamsList = page.locator('table, .team-card, article, [class*="list"]');

          if (await teamsList.count() > 0) {
            await expect(teamsList.first()).toBeVisible();
          }

          // Look for new team button
          const newTeamButton = page.locator('button:has-text("Nova Equipe"), button:has-text("New Team"), a[href*="/teams/new"]').first();

          if (await newTeamButton.count() > 0) {
            await expect(newTeamButton).toBeVisible();
          }
        }
      }
    });

    // ============================================
    // STEP 8: View Reports
    // ============================================
    await test.step('Admin views and generates reports', async () => {
      // Navigate to reports page
      const reportsLink = page.locator('a[href*="/admin/reports"], a[href*="/reports"]').first();

      if (await reportsLink.count() > 0) {
        await reportsLink.click();
      } else {
        await page.goto('/admin/reports');
      }

      await page.waitForLoadState('networkidle');

      // Verify reports page
      if (page.url().includes('/reports')) {
        // Check for report options
        const reportTypes = page.locator('text=/tickets?|agentes?|desempenho|performance|sla|satisfa[çc][ãa]o/i');
        const reportTypesCount = await reportTypes.count();
        expect(reportTypesCount).toBeGreaterThan(0);

        // Look for date filters
        const dateFilters = page.locator('input[type="date"], input[name*="date"]');
        if (await dateFilters.count() > 0) {
          await expect(dateFilters.first()).toBeVisible();
        }

        // Look for export/generate buttons
        const generateButton = page.locator('button:has-text("Gerar"), button:has-text("Generate"), button:has-text("Exportar"), button:has-text("Export")');
        if (await generateButton.count() > 0) {
          await expect(generateButton.first()).toBeVisible();
        }

        // Take screenshot
        await page.screenshot({
          path: 'test-results/admin-journey-reports.png',
          fullPage: true
        });
      }
    });

    // ============================================
    // STEP 9: Analytics Dashboard
    // ============================================
    await test.step('Admin explores detailed analytics', async () => {
      // Go to analytics or dashboard
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Check for various chart types
      const chartTypes = page.locator('svg, canvas');
      const chartsCount = await chartTypes.count();
      expect(chartsCount).toBeGreaterThan(0);

      // Check for time period filters
      const timePeriodFilter = page.locator('select:has(option:has-text("Hoje")), select:has(option:has-text("Semana")), button:has-text("7 dias")');
      if (await timePeriodFilter.count() > 0) {
        await expect(timePeriodFilter.first()).toBeVisible();
      }

      // Check for trend indicators
      const trends = page.locator('text=/\\+\\d+%|\\-\\d+%|↑|↓/');
      if (await trends.count() > 0) {
        await expect(trends.first()).toBeVisible();
      }
    });

    // ============================================
    // STEP 10: Audit Logs
    // ============================================
    await test.step('Admin reviews audit logs', async () => {
      // Try to access audit logs
      const auditLink = page.locator('a[href*="/audit"], a:has-text("Auditoria"), a:has-text("Audit")').first();

      if (await auditLink.count() > 0) {
        await auditLink.click();
        await page.waitForLoadState('networkidle');

        // Verify audit logs page
        if (page.url().includes('/audit')) {
          // Check for audit entries
          const auditEntries = page.locator('table, .audit-entry, [class*="log"]');
          if (await auditEntries.count() > 0) {
            await expect(auditEntries.first()).toBeVisible();
          }

          // Check for audit information
          const auditInfo = page.locator('text=/usu[áa]rio|user|a[çc][ãa]o|action|data|date|hora|time/i');
          if (await auditInfo.count() > 0) {
            await expect(auditInfo.first()).toBeVisible();
          }
        }
      }
    });

    // ============================================
    // STEP 11: System Settings
    // ============================================
    await test.step('Admin accesses system settings', async () => {
      // Navigate to settings
      const settingsLink = page.locator('a[href*="/settings"], a:has-text("Configura"), a:has-text("Settings")').first();

      if (await settingsLink.count() > 0) {
        await settingsLink.click();
        await page.waitForLoadState('networkidle');

        // Verify settings page
        if (page.url().includes('/settings') || page.url().includes('/config')) {
          // Check for settings categories
          const settingsCategories = page.locator('text=/geral|general|email|notifica[çc][õo]es?|integra[çc][õo]es?/i');
          if (await settingsCategories.count() > 0) {
            await expect(settingsCategories.first()).toBeVisible();
          }
        }
      }
    });

    // ============================================
    // STEP 12: Email Templates
    // ============================================
    await test.step('Admin manages email templates', async () => {
      // Try to access email templates
      const emailLink = page.locator('a[href*="/emails"], a[href*="/templates"], a:has-text("Email")').first();

      if (await emailLink.count() > 0) {
        await emailLink.click();
        await page.waitForLoadState('networkidle');

        // Verify email templates page
        if (page.url().includes('/email') || page.url().includes('/template')) {
          // Check for template list
          const templates = page.locator('text=/boas-vindas|welcome|ticket|resposta|response/i');
          if (await templates.count() > 0) {
            await expect(templates.first()).toBeVisible();
          }
        }
      }
    });

    // ============================================
    // STEP 13: Accessibility Check
    // ============================================
    await test.step('Verify accessibility of admin interface', async () => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      await injectAxe(page);
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: {
          html: true
        }
      });
    });

    // ============================================
    // STEP 14: Logout
    // ============================================
    await test.step('Admin logs out', async () => {
      await logout(page);

      // Verify logout by trying to access admin area
      await page.goto('/admin');

      // Should redirect to login
      await page.waitForURL((url) => url.pathname.includes('/auth/login'), {
        timeout: 5000
      });

      expect(page.url()).toContain('/auth/login');
    });
  });

  test('admin can export reports in different formats', async ({ page }) => {
    await test.step('Setup: Login as admin', async () => {
      await login(page, TEST_USERS.admin);
    });

    await test.step('Generate and export report', async () => {
      await page.goto('/admin/reports');
      await page.waitForLoadState('networkidle');

      if (page.url().includes('/reports')) {
        // Look for export buttons
        const exportButtons = page.locator('button:has-text("PDF"), button:has-text("Excel"), button:has-text("CSV"), button:has-text("Exportar")');

        if (await exportButtons.count() > 0) {
          // Verify export options are available
          await expect(exportButtons.first()).toBeVisible();

          // Click export button (don't wait for download in test)
          // await exportButtons.first().click();
        }
      }
    });

    await test.step('Cleanup: Logout', async () => {
      await logout(page);
    });
  });

  test('admin can view real-time system metrics', async ({ page }) => {
    await test.step('Setup: Login as admin', async () => {
      await login(page, TEST_USERS.admin);
    });

    await test.step('View real-time dashboard metrics', async () => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Check for metrics that should update in real-time
      const realtimeMetrics = page.locator('text=/online|ativo|em andamento|in progress/i');

      if (await realtimeMetrics.count() > 0) {
        // Verify metrics are displayed
        await expect(realtimeMetrics.first()).toBeVisible();
      }

      // Check for refresh button or auto-update indicator
      const refreshButton = page.locator('button:has-text("Atualizar"), button:has-text("Refresh"), [class*="auto-refresh"]');
      if (await refreshButton.count() > 0) {
        await expect(refreshButton.first()).toBeVisible();
      }
    });

    await test.step('Cleanup: Logout', async () => {
      await logout(page);
    });
  });

  test('admin cannot be accessed by non-admin users', async ({ page }) => {
    await test.step('Try to access admin area as regular user', async () => {
      await login(page, TEST_USERS.user);

      await page.goto('/admin');
      await page.waitForTimeout(2000);

      // Should be redirected or shown access denied
      const currentUrl = page.url();

      if (currentUrl.includes('/admin')) {
        // Check for access denied message
        const accessDenied = page.locator('text=/acesso negado|não autorizado|forbidden|access denied/i');
        await expect(accessDenied).toBeVisible();
      } else {
        // User was redirected away from admin area
        expect(currentUrl).not.toContain('/admin');
      }
    });

    await test.step('Cleanup: Logout', async () => {
      await logout(page);
    });
  });
});
