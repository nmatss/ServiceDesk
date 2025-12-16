# UX Components Quick Reference

## 🚀 Quick Start Cheatsheet

### Loading States
```tsx
import { PageLoadingBar, ButtonLoading, SkeletonTable } from '@/components/ui/loading-states'

<PageLoadingBar isLoading={loading} />
<ButtonLoading isLoading={saving}>Save</ButtonLoading>
<SkeletonTable rows={5} columns={4} />
```

### Errors
```tsx
import { NetworkError, InlineError } from '@/components/ui/error-states'

<NetworkError onRetry={refetch} />
<InlineError message="Invalid input" />
```

### Empty States
```tsx
import { TicketsEmptyState, NotificationsEmptyState } from '@/components/ui/empty-state'

{items.length === 0 && <TicketsEmptyState onCreateTicket={create} />}
```

### Animations
```tsx
import { AnimatedCard, FadeIn, AnimatedNumber } from '@/components/ui/animated-card'

<AnimatedCard onClick={handleClick}>Content</AnimatedCard>
<FadeIn direction="up">Content</FadeIn>
<AnimatedNumber value={count} />
```

### Toasts
```tsx
import { enhancedToast } from '@/lib/ui/toast'

enhancedToast.success('Done!', { action: { label: 'View', onClick: view } })
enhancedToast.undo('Deleted', onUndo)
```

### Forms
```tsx
import { EnhancedFormField, PasswordStrengthMeter } from '@/components/ui/enhanced-form'

<EnhancedFormField
  label="Email"
  value={email}
  onChange={setEmail}
  validate={(v) => !v.includes('@') ? 'Invalid email' : null}
  showCount
  maxLength={100}
/>
```

### Search
```tsx
import { EnhancedSearch } from '@/components/ui/enhanced-search'

<EnhancedSearch
  data={items}
  searchKeys={['name', 'description']}
  onSearch={setFiltered}
  onSelect={handleSelect}
/>
```

### Keyboard Shortcuts
```tsx
import { useKeyboardShortcut } from '@/lib/ui/keyboard-shortcuts'

useKeyboardShortcut('n', createNew, { meta: true })
```

### Command Palette
```tsx
import { useCommandPalette } from '@/components/ui/command-palette'

const { CommandPalette } = useCommandPalette(commands)
return <CommandPalette />
```

### Optimistic Updates
```tsx
import { useOptimisticList } from '@/lib/ui/optimistic'

const { list, updateItem, deleteItem } = useOptimisticList(data)
await updateItem(id, updates, saveAPI)
```

### Help & Tooltips
```tsx
import { HelpTooltip, InlineHelp } from '@/components/ui/help-tooltip'

<HelpTooltip content="Help text">
  <button>?</button>
</HelpTooltip>
```

---

## 📦 Component Categories

### 1. Feedback Components
- Loading states (skeletons, spinners, progress bars)
- Error states (network, 404, 500, permissions)
- Empty states (no data, no results, filters)
- Toast notifications (success, error, warning, info)

### 2. Interactive Components
- Enhanced forms (validation, character count, auto-save)
- Enhanced search (fuzzy, keyboard nav, suggestions)
- Command palette (Cmd+K searchable commands)
- Animated cards (hover effects, transitions)

### 3. Utility Hooks
- Keyboard shortcuts
- Optimistic updates
- Page transitions
- Network status
- Idle detection

### 4. Help Components
- Tooltips
- Inline help
- Onboarding
- Feature announcements

---

## 🎨 Common Patterns

### Pattern: Loading → Data → Error
```tsx
function TicketList() {
  const { data, isLoading, error, refetch } = useTickets()

  if (isLoading) return <SkeletonTable rows={5} />
  if (error) return <NetworkError onRetry={refetch} />
  if (data.length === 0) return <TicketsEmptyState onCreate={create} />

  return <AnimatedList>{data.map(renderItem)}</AnimatedList>
}
```

### Pattern: Form with Validation
```tsx
function TicketForm() {
  const [title, setTitle] = useState('')

  return (
    <EnhancedFormField
      label="Title"
      value={title}
      onChange={setTitle}
      validate={(v) => v.length < 5 ? 'Too short' : null}
      maxLength={100}
      showCount
      required
    />
  )
}
```

### Pattern: Optimistic Delete
```tsx
function TicketItem({ ticket }) {
  const { deleteItem } = useOptimisticList(tickets)

  const handleDelete = async () => {
    await deleteItem(ticket.id, () => api.delete(ticket.id))
  }

  return <button onClick={handleDelete}>Delete</button>
}
```

### Pattern: Search with Results
```tsx
function TicketSearch() {
  const [results, setResults] = useState(tickets)

  return (
    <>
      <EnhancedSearch
        data={tickets}
        searchKeys={['title', 'description']}
        onSearch={setResults}
      />
      {results.length === 0 ? (
        <SearchEmptyState query={query} onClear={clear} />
      ) : (
        results.map(renderTicket)
      )}
    </>
  )
}
```

---

## ⌨️ Keyboard Shortcuts

### Global Shortcuts
- `Cmd/Ctrl + K` - Open command palette
- `Cmd/Ctrl + N` - New ticket
- `Cmd/Ctrl + S` - Save form
- `Cmd/Ctrl + /` - Show shortcuts help
- `Esc` - Close modal/dropdown

### Navigation Shortcuts
- `Cmd/Ctrl + Shift + D` - Go to dashboard
- `Cmd/Ctrl + Shift + T` - Go to tickets

### List Navigation
- `↑↓` - Navigate items
- `Enter` - Select item
- `Esc` - Close/Cancel

---

## 🎯 Best Practices

### Loading States
✅ Show skeleton after 200ms delay
✅ Use contextual spinners in buttons
✅ Provide progress feedback for long operations
❌ Don't flash loading states for quick operations

### Errors
✅ Always provide retry/recovery options
✅ Show clear, actionable messages
✅ Log errors to monitoring service
❌ Don't show technical error messages to users

### Animations
✅ Keep duration under 300ms
✅ Use spring physics for natural feel
✅ Respect prefers-reduced-motion
❌ Don't overuse or make distracting

### Forms
✅ Validate in real-time with debounce
✅ Show character counts near limits
✅ Auto-save drafts
✅ Prevent accidental navigation with unsaved changes
❌ Don't validate on every keystroke

### Toasts
✅ Auto-dismiss non-critical messages
✅ Provide undo for destructive actions
✅ Stack multiple toasts
❌ Don't block UI with toast notifications

---

## 🔧 Customization

### Theme Integration
All components support dark mode via Tailwind classes:
```tsx
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
```

### Animation Customization
```tsx
<AnimatedCard hoverScale={1.05} hoverY={-8} tapScale={0.95}>
```

### Toast Customization
```tsx
enhancedToast.success('Message', {
  duration: 10000,
  position: 'bottom-right',
  dismissible: false
})
```

### Form Validation
```tsx
<EnhancedFormField
  validate={(value) => {
    if (!value) return 'Required field'
    if (value.length < 3) return 'Too short'
    if (!/\S+@\S+/.test(value)) return 'Invalid email'
    return null // No error
  }}
  debounceMs={500}
/>
```

---

## 📱 Mobile Considerations

### Touch Targets
Minimum 44x44px for all interactive elements:
```tsx
<button className="min-h-[44px] min-w-[44px]">
```

### Responsive Modals
Use bottom sheets on mobile:
```tsx
<SlideInPanel side="bottom" className="h-auto max-h-[80vh]">
```

### Swipe Gestures
Implement with Framer Motion:
```tsx
<motion.div drag="x" dragConstraints={{ left: -100, right: 0 }}>
```

---

## 🧪 Testing

### Component Testing
```tsx
import { render, screen } from '@testing-library/react'
import { ButtonLoading } from '@/components/ui/loading-states'

test('shows spinner when loading', () => {
  render(<ButtonLoading isLoading>Save</ButtonLoading>)
  expect(screen.getByRole('button')).toBeDisabled()
})
```

### Keyboard Testing
```tsx
test('command palette opens with Cmd+K', () => {
  const { getByPlaceholderText } = render(<App />)
  userEvent.keyboard('{Meta>}k{/Meta}')
  expect(getByPlaceholderText('Search commands...')).toBeVisible()
})
```

---

## 📊 Performance

### Optimization Tips
1. Debounce search: 300ms
2. Throttle scroll events: 100ms
3. Lazy load images
4. Code split heavy components
5. Memoize expensive calculations

### Monitoring
```tsx
import { usePageLoadPerformance } from '@/lib/ui/page-transitions'

const metrics = usePageLoadPerformance()
// metrics.loadTime, metrics.firstPaint, etc.
```

---

## 🐛 Common Issues

### Issue: Toast not appearing
**Solution**: Add `<ToastProvider />` to root layout

### Issue: Keyboard shortcuts not working
**Solution**: Check if focus is in input field (some shortcuts disabled in inputs)

### Issue: Animations stuttering
**Solution**: Use `transform` and `opacity` for better performance

### Issue: Search too slow
**Solution**: Increase debounce delay or reduce search threshold

---

## 📚 Resources

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Fuse.js Docs](https://fusejs.io/)
- [React Hot Toast Docs](https://react-hot-toast.com/)
- [Headless UI Docs](https://headlessui.com/)

---

**Need help? Check UX_IMPROVEMENTS_SUMMARY.md for detailed documentation!**
