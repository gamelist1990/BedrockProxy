# BedrockProxy - Visual UI Changes Guide

## 1. Custom Titlebar (Tauri Only)

### Before:
- Native Windows/macOS/Linux window decorations
- Standard title bar with system buttons

### After:
```
┌────────────────────────────────────────────────────────┐
│ BedrockProxy                          [—] [□] [×]      │  ← Custom gradient titlebar
└────────────────────────────────────────────────────────┘
```

**Features:**
- Beautiful blue gradient background (#1a73e8 → #1565c0)
- Custom minimize, maximize, close buttons
- Drag-to-move anywhere on titlebar
- Red hover effect on close button
- White icons with hover effects

**Location:** Always visible at the very top of the window (Tauri only)

---

## 2. Server Operations Tab

### Location: Server Details → Operations Tab

### Enhanced Features:

#### A. Auto Settings Section
```
┌─────────────────────────────────────────────────┐
│ Auto Settings                                   │
│ ┌─────────────────────────────────────────────┐ │
│ │ ☑ Auto Start on App Launch        [Toggle]│ │ ← NEW!
│ │   Automatically start this server when the  │ │
│ │   application launches                      │ │
│ │                                              │ │
│ │ ☑ Auto Restart                    [Toggle]│ │
│ │   Automatically restart the server when it  │ │
│ │   stops                                     │ │
│ │                                              │ │
│ │ ☐ Block connections from same IP [Toggle]│ │
│ │   Prevent multiple connections from the     │ │
│ │   same IP address.                          │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**CSS Improvements:**
- Gradient background (light blue)
- Better padding (24px)
- Hover effects on each toggle section
- Increased shadow depth
- Improved spacing between items

---

## 3. Console Tab Improvements

### Location: Server Details → Console Tab

### Header Changes:
```
┌────────────────────────────────────────────────────────────┐
│ Console Output              [Auto-scroll ☑] [Live] [123 行] │ ← NEW toggle!
└────────────────────────────────────────────────────────────┘
```

### Console Window:
```
┌────────────────────────────────────────────────────────────┐
│ [Server started on 0.0.0.0:19132]                          │
│ [INFO] Loading world...                                    │
│ [INFO] World loaded successfully                           │
│ [INFO] Ready for connections                               │
│ ...                                                         │  ← No visible scrollbar!
│ ↓ (auto-scrolls to bottom when new lines appear)           │
└────────────────────────────────────────────────────────────┘
```

**Improvements:**
1. **Hidden Scrollbar:**
   - Completely invisible (cross-browser)
   - Scroll functionality still works with mouse wheel/trackpad
   - Clean, professional appearance

2. **Auto-Scroll Toggle:**
   - Switch in console header
   - Default: ON (scrolls to latest automatically)
   - When OFF: stays at current position
   - User preference respected

---

## 4. Basic Settings (Overview Tab)

### Location: Server Details → Overview Tab

### Form Improvements:
```
┌─────────────────────────────────────────────────┐
│ Server Name:  [My Bedrock Server            ]  │
│                                                 │
│ Destination Settings:                           │
│ IPv4: [127.0.0.1    ] Port: [19132]            │
│                                                 │
│ Max Players:  [10                           ]  │
│ Icon URL:     [https://...                  ]  │
│                                                 │
│                              [    Save    ]     │ ← Improved!
└─────────────────────────────────────────────────┘
```

**CSS Improvements:**
- Better spacing between fields (18px gap)
- Enhanced save button:
  - Min-width: 120px
  - Better padding: 10px 24px
  - Box shadow on hover
  - Lift effect (translateY -1px)
  - Increased font weight

---

## 5. Connection Status Display

### Location: Top-right corner of app

### Before:
```
[connected] [—]
```

### After:
```
[connected] [45 ms]  ← Shows actual ping!
```

**Improvements:**
- Displays actual latency value
- Updates immediately on connection
- No more "—" placeholder
- Position adjusted for custom titlebar (in Tauri)

---

## 6. Action Buttons (Operations Tab)

### Location: Server Details → Operations Tab

### Button Enhancements:
```
┌───────────────────────────────────────────────┐
│ [▶ Start]  [■ Stop]  [⟲ Restart]             │
└───────────────────────────────────────────────┘
```

**CSS Improvements:**
- Larger buttons (56x56px)
- Box shadow on hover
- Lift animation (translateY -2px)
- Enhanced shadow depth
- Smooth transitions (0.2s ease)

---

## Color Scheme

### Primary Colors:
- **Primary Blue:** #1a73e8
- **Surface White:** #ffffff
- **Muted Gray:** #6b7280
- **Border:** #e5e7eb

### Gradients:
- **Titlebar:** linear-gradient(135deg, #1a73e8 0%, #1565c0 100%)
- **Auto Settings:** linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)
- **Action Buttons:** rgba(26,115,232,0.06) → rgba(26,115,232,0.14) on hover

---

## Responsive Behavior

All changes maintain responsive design:
- Works on mobile/tablet sizes
- Proper text wrapping
- Collapsible sections
- Touch-friendly button sizes
- Adaptive spacing

---

## Browser Compatibility

All CSS features tested for:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Tauri WebView

Cross-browser solutions used:
- Multiple scrollbar hiding methods
- Vendor prefixes where needed
- Fallback styles provided

---

## Accessibility

Maintained accessibility features:
- ✅ Proper ARIA labels
- ✅ Keyboard navigation
- ✅ Focus indicators
- ✅ Screen reader friendly
- ✅ Color contrast (WCAG AA)

---

## Summary

All UI changes follow Material Design principles and maintain consistency with the existing BedrockProxy design system. Changes are subtle but impactful, improving usability without disrupting the user experience.
