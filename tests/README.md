# Playwright GUI Tests

This directory contains Playwright tests for the BedrockProxy web interface.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install chromium
```

## Running Tests

### Run all tests:
```bash
npm run test:playwright
```

### Run tests in UI mode (interactive):
```bash
npm run test:playwright:ui
```

### Run tests in headed mode (see browser):
```bash
npm run test:playwright:headed
```

## Test Coverage

### ServerDetails GUI Tests (`serverDetails.spec.ts`)

1. **CardHeader Styling Test**
   - Verifies the CardHeader displays with proper styling
   - Checks for server avatar, title, status chip, and stat blocks
   - Captures screenshots for visual verification

2. **Operations Tab UI Test**
   - Validates the Operations tab layout and components
   - Checks for section titles with accent bars
   - Verifies action buttons and toggle switches
   - Tests auto-settings and forward-settings sections

3. **Basic Settings UI Test**
   - Validates the Overview/Basic Settings tab
   - Checks for proxy-config sections with improved styling
   - Verifies info-block components

4. **Real-time Settings Save Test**
   - Tests that toggle switches respond to user interaction
   - Verifies UI state changes when settings are toggled
   - Note: Full backend integration testing requires a running server

## Screenshots

Test screenshots are saved to `tests/screenshots/` and include:
- `main-page.png` - Main application page
- `server-details-header.png` - Server details CardHeader area
- `operations-tab.png` - Operations tab full view
- `auto-settings-section.png` - Auto-settings panel
- `forward-settings-section.png` - Forward settings panel
- `basic-settings.png` - Basic settings/Overview tab
- `proxy-config-section.png` - Proxy configuration section
- `info-block-section.png` - Info block component
- `toggle-state-changed.png` - Toggle switch state change

## Notes

- Tests are designed to work with or without existing servers
- If no servers are found, tests will skip gracefully with info messages
- The tests focus on UI/GUI components and visual styling verification
- Backend integration requires a running BedrockProxy server

## Configuration

The Playwright configuration is in `playwright.config.ts` at the root of the project.
- Base URL: `http://localhost:1420`
- Browser: Chromium (Desktop Chrome)
- Screenshots: Captured on failure
- Test reports: HTML format
