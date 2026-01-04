# Visual Feedback Components - Usage Guide

A comprehensive guide to using the visual feedback system in the ServiceDesk application.

---

## Quick Import

```typescript
import {
  InteractiveButton,
  InteractiveLink,
  InteractiveCard,
  FormLoadingOverlay,
  ActionFeedback,
  ProgressIndicator,
  useRipple,
} from '@/components/ui/visual-feedback';

// Or use the index export
import { InteractiveButton, FormLoadingOverlay } from '@/components/ui';
```

---

## Components

### 1. InteractiveButton

Enhanced button with ripple effects and state animations.

#### Basic Usage
```typescript
<InteractiveButton onClick={handleClick}>
  Click Me
</InteractiveButton>
```

#### With Loading State
```typescript
<InteractiveButton loading={isLoading}>
  {isLoading ? 'Saving...' : 'Save'}
</InteractiveButton>
```

#### With Success/Error Feedback
```typescript
const [success, setSuccess] = useState(false);
const [error, setError] = useState(false);

<InteractiveButton
  success={success}
  error={error}
  onClick={handleAction}
>
  Submit
</InteractiveButton>
```

#### Props
- `variant`: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
- `size`: 'sm' | 'md' | 'lg'
- `loading`: boolean
- `success`: boolean
- `error`: boolean
- `ripple`: boolean (default: true)
- `disabled`: boolean

---

### 2. FormLoadingOverlay

Full-form overlay during async operations.

#### Usage
```typescript
<form onSubmit={handleSubmit} className="relative">
  <FormLoadingOverlay
    isLoading={isSubmitting}
    message="Saving your changes..."
  />

  {/* Form fields */}
  <Input label="Name" />
  <Input label="Email" />

  <InteractiveButton type="submit" loading={isSubmitting}>
    Submit
  </InteractiveButton>
</form>
```

#### Props
- `isLoading`: boolean (required)
- `message`: string (default: 'Processing...')
- `className`: string

#### Important Notes
- Parent element MUST have `position: relative` or `className="relative"`
- Automatically prevents form interaction during loading
- Uses backdrop blur for visual clarity

---

### 3. InteractiveLink

Links with smooth animations and external link indicators.

#### Basic Usage
```typescript
<InteractiveLink href="/dashboard">
  Go to Dashboard
</InteractiveLink>
```

#### With Icon
```typescript
<InteractiveLink href="/tickets" showIcon>
  View Tickets
</InteractiveLink>
```

#### External Link
```typescript
<InteractiveLink href="https://example.com" external>
  Visit Example
</InteractiveLink>
```

#### Variants
```typescript
<InteractiveLink variant="default">Default</InteractiveLink>
<InteractiveLink variant="underline">Underlined</InteractiveLink>
<InteractiveLink variant="subtle">Subtle</InteractiveLink>
<InteractiveLink variant="bold">Bold</InteractiveLink>
```

#### Props
- `href`: string (required)
- `variant`: 'default' | 'underline' | 'subtle' | 'bold'
- `showIcon`: boolean
- `external`: boolean

---

### 4. InteractiveCard

Cards with hover lift animations.

#### Basic Usage
```typescript
<InteractiveCard>
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</InteractiveCard>
```

#### Clickable Card
```typescript
<InteractiveCard
  clickable
  onClick={() => router.push('/details')}
>
  <div className="flex items-center gap-4">
    <Icon className="w-6 h-6" />
    <div>
      <h3>Click Me</h3>
      <p>Navigate to details page</p>
    </div>
  </div>
</InteractiveCard>
```

#### Variants
```typescript
<InteractiveCard variant="default">Default</InteractiveCard>
<InteractiveCard variant="elevated">Elevated</InteractiveCard>
<InteractiveCard variant="outline">Outline</InteractiveCard>
```

#### Props
- `clickable`: boolean
- `variant`: 'default' | 'elevated' | 'outline'
- `hoverEffect`: boolean (default: true)
- `onClick`: () => void

---

### 5. ProgressIndicator

Animated progress bars.

#### Basic Usage
```typescript
<ProgressIndicator value={75} />
```

#### With Label
```typescript
<ProgressIndicator
  value={uploadProgress}
  showLabel
  label="Upload Progress"
/>
```

#### Different Variants
```typescript
<ProgressIndicator value={100} variant="success" />
<ProgressIndicator value={50} variant="warning" />
<ProgressIndicator value={25} variant="error" />
```

#### Real Upload Example
```typescript
const [uploadProgress, setUploadProgress] = useState(0);

const handleFileUpload = (file: File) => {
  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const percent = (e.loaded / e.total) * 100;
      setUploadProgress(percent);
    }
  });

  xhr.addEventListener('load', () => {
    setUploadProgress(100);
    setTimeout(() => setUploadProgress(0), 1000);
  });

  const formData = new FormData();
  formData.append('file', file);
  xhr.open('POST', '/api/upload');
  xhr.send(formData);
};

// In JSX
<ProgressIndicator
  value={uploadProgress}
  variant={uploadProgress === 100 ? 'success' : 'default'}
  showLabel
  label="Uploading..."
/>
```

#### Props
- `value`: number (required) - Current progress value
- `max`: number (default: 100) - Maximum value
- `variant`: 'default' | 'success' | 'warning' | 'error'
- `size`: 'sm' | 'md' | 'lg'
- `showLabel`: boolean
- `label`: string

---

### 6. ActionFeedback

Enhanced feedback component with actions.

#### Usage
```typescript
const [showFeedback, setShowFeedback] = useState(false);

<ActionFeedback
  type="success"
  message="Changes saved!"
  description="Your profile has been updated successfully."
  onClose={() => setShowFeedback(false)}
  action={{
    label: 'Undo',
    onClick: handleUndo
  }}
/>
```

#### Props
- `type`: 'success' | 'error' | 'warning' | 'info' (required)
- `message`: string (required)
- `description`: string
- `onClose`: () => void
- `duration`: number (default: 5000ms)
- `action`: { label: string; onClick: () => void }

---

### 7. useRipple Hook

Custom hook for ripple effects on any element.

#### Usage
```typescript
const { createRipple, RippleContainer } = useRipple();

<button
  onClick={createRipple}
  className="relative overflow-hidden"
>
  Click Me
  <RippleContainer color="rgba(255, 255, 255, 0.5)" />
</button>
```

#### Props for RippleContainer
- `color`: string (default: 'rgba(255, 255, 255, 0.5)')
- `duration`: number (default: 600ms)

---

## Integration with Toast System

### Import Toast
```typescript
import { customToast } from '@/components/ui/toast';
```

### Success Toast
```typescript
customToast.success('Action completed successfully!');
```

### Error Toast
```typescript
customToast.error('Something went wrong!');
```

### Warning Toast
```typescript
customToast.warning('Please review your input');
```

### Info Toast
```typescript
customToast.info('New notification received');
```

### Promise-based Toast
```typescript
customToast.promise(
  saveDataToAPI(),
  {
    loading: 'Saving data...',
    success: 'Data saved successfully!',
    error: 'Failed to save data'
  }
);
```

### Loading Toast
```typescript
const toastId = customToast.loading('Processing...');

// Later, dismiss it
customToast.dismiss(toastId);
```

---

## Common Patterns

### 1. Form Submission with Complete Feedback

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);

  try {
    await customToast.promise(
      submitForm(formData),
      {
        loading: 'Submitting form...',
        success: 'Form submitted successfully!',
        error: 'Failed to submit form'
      }
    );

    // Navigate or reset form
    router.push('/success');
  } catch (error) {
    console.error(error);
  } finally {
    setIsSubmitting(false);
  }
};

// In JSX
<form onSubmit={handleSubmit} className="relative space-y-4">
  <FormLoadingOverlay
    isLoading={isSubmitting}
    message="Submitting your data..."
  />

  <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
  <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

  <div className="flex gap-3">
    <InteractiveButton type="submit" loading={isSubmitting}>
      Submit
    </InteractiveButton>
    <InteractiveButton
      type="button"
      variant="outline"
      onClick={() => router.back()}
      disabled={isSubmitting}
    >
      Cancel
    </InteractiveButton>
  </div>
</form>
```

---

### 2. Action Button with Success/Error States

```typescript
const [actionState, setActionState] = useState<'idle' | 'success' | 'error'>('idle');

const handleAction = async () => {
  try {
    await performAction();
    setActionState('success');
    customToast.success('Action completed!');

    // Reset after 2 seconds
    setTimeout(() => setActionState('idle'), 2000);
  } catch (error) {
    setActionState('error');
    customToast.error('Action failed!');

    // Reset after 2 seconds
    setTimeout(() => setActionState('idle'), 2000);
  }
};

<InteractiveButton
  onClick={handleAction}
  success={actionState === 'success'}
  error={actionState === 'error'}
  loading={actionState === 'loading'}
>
  Perform Action
</InteractiveButton>
```

---

### 3. Card Grid with Click Actions

```typescript
const cards = [
  { id: 1, title: 'Create Ticket', icon: PlusIcon, path: '/tickets/new' },
  { id: 2, title: 'View Reports', icon: ChartIcon, path: '/reports' },
  { id: 3, title: 'Settings', icon: SettingsIcon, path: '/settings' },
];

<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {cards.map((card) => (
    <InteractiveCard
      key={card.id}
      clickable
      onClick={() => router.push(card.path)}
      variant="elevated"
    >
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-brand-100 dark:bg-brand-900/30">
          <card.icon className="w-6 h-6 text-brand-600" />
        </div>
        <h3 className="font-semibold">{card.title}</h3>
      </div>
    </InteractiveCard>
  ))}
</div>
```

---

### 4. Multi-step Form with Progress

```typescript
const [currentStep, setCurrentStep] = useState(1);
const totalSteps = 3;
const progress = (currentStep / totalSteps) * 100;

const handleNextStep = () => {
  if (currentStep < totalSteps) {
    setCurrentStep(currentStep + 1);
  } else {
    handleSubmit();
  }
};

// In JSX
<div className="space-y-6">
  <ProgressIndicator
    value={progress}
    showLabel
    label={`Step ${currentStep} of ${totalSteps}`}
  />

  {/* Step content */}
  {currentStep === 1 && <Step1Content />}
  {currentStep === 2 && <Step2Content />}
  {currentStep === 3 && <Step3Content />}

  <div className="flex gap-3">
    {currentStep > 1 && (
      <InteractiveButton
        variant="outline"
        onClick={() => setCurrentStep(currentStep - 1)}
      >
        Previous
      </InteractiveButton>
    )}

    <InteractiveButton onClick={handleNextStep}>
      {currentStep === totalSteps ? 'Submit' : 'Next'}
    </InteractiveButton>
  </div>
</div>
```

---

## Best Practices

### 1. Always Show Feedback for Async Actions
```typescript
// ✅ Good
const handleSave = async () => {
  setLoading(true);
  try {
    await save();
    customToast.success('Saved!');
  } catch (error) {
    customToast.error('Failed!');
  } finally {
    setLoading(false);
  }
};

// ❌ Bad
const handleSave = async () => {
  await save(); // No feedback
};
```

### 2. Disable Actions During Loading
```typescript
// ✅ Good
<InteractiveButton loading={isLoading} disabled={isLoading}>
  Submit
</InteractiveButton>

// ❌ Bad
<InteractiveButton loading={isLoading}>
  Submit
</InteractiveButton>
```

### 3. Use Appropriate Toast Types
```typescript
// Success for completed actions
customToast.success('Ticket created');

// Error for failures
customToast.error('Failed to save');

// Warning for non-critical issues
customToast.warning('Draft saved locally');

// Info for notifications
customToast.info('New message received');
```

### 4. Provide Undo Actions When Appropriate
```typescript
const handleDelete = async (id: string) => {
  await deleteItem(id);

  customToast.success('Item deleted', {
    action: {
      label: 'Undo',
      onClick: () => restoreItem(id)
    }
  });
};
```

---

## Accessibility

All components follow WCAG 2.1 AA guidelines:

- ✅ ARIA labels for loading states
- ✅ Keyboard navigation support
- ✅ Focus visible styles
- ✅ Screen reader announcements
- ✅ Color contrast compliance

### Keyboard Navigation
- `Tab`: Navigate through interactive elements
- `Enter/Space`: Activate buttons and links
- `Escape`: Close toasts and overlays

---

## Performance Tips

1. **Debounce Actions**: For frequently triggered actions
```typescript
import { debounce } from 'lodash';

const debouncedSave = debounce(handleSave, 500);
```

2. **Optimize Animations**: Use CSS transitions over JavaScript
3. **Cleanup Effects**: Always cleanup timeouts and intervals
```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    setLoading(false);
  }, 2000);

  return () => clearTimeout(timer);
}, []);
```

---

## Troubleshooting

### Ripple Effect Not Showing
- Ensure parent has `overflow: hidden` or `className="overflow-hidden"`
- Check z-index stacking context

### Form Overlay Not Covering Form
- Parent must have `position: relative` or `className="relative"`

### Toast Not Appearing
- Ensure `ToastProvider` is in your layout
- Check console for errors

### Progress Not Animating
- Verify `value` prop is changing
- Check if Framer Motion is installed

---

## Live Examples

Visit `/admin/design-system/visual-feedback` to see all components in action with interactive examples.

---

**Last Updated**: 2025-12-25
**Version**: 1.0.0
