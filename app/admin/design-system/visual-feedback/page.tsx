'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  InteractiveButton,
  InteractiveLink,
  InteractiveCard,
  FormLoadingOverlay,
  ActionFeedback,
  ProgressIndicator,
  useRipple,
} from '@/components/ui/visual-feedback';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { customToast } from '@/components/ui/toast';
import { InlineSpinner, ButtonLoading } from '@/components/ui/loading-states';

export default function VisualFeedbackShowcase() {
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [buttonSuccess, setButtonSuccess] = useState(false);
  const [buttonError, setButtonError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showToast, setShowToast] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsFormLoading(true);
    customToast.loading('Processing your request...');

    setTimeout(() => {
      setIsFormLoading(false);
      customToast.dismiss();
      customToast.success('Form submitted successfully!');
    }, 2000);
  };

  const handleButtonClick = (type: 'success' | 'error') => {
    if (type === 'success') {
      setButtonSuccess(true);
      customToast.success('Action completed!');
    } else {
      setButtonError(true);
      customToast.error('Something went wrong!');
    }
  };

  const handleProgressSimulation = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          customToast.success('Process completed!');
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            Visual Feedback System
          </h1>
          <p className="text-lg text-description max-w-2xl mx-auto">
            Comprehensive showcase of interactive components with loading states, hover effects,
            and user feedback mechanisms.
          </p>
        </div>

        {/* Interactive Buttons Section */}
        <Card>
          <CardHeader>
            <CardTitle>Interactive Buttons with Ripple Effects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Button Variants
              </h3>
              <div className="flex flex-wrap gap-3">
                <InteractiveButton variant="primary">Primary Button</InteractiveButton>
                <InteractiveButton variant="secondary">Secondary Button</InteractiveButton>
                <InteractiveButton variant="outline">Outline Button</InteractiveButton>
                <InteractiveButton variant="ghost">Ghost Button</InteractiveButton>
                <InteractiveButton variant="destructive">Destructive Button</InteractiveButton>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Button Sizes
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <InteractiveButton size="sm">Small</InteractiveButton>
                <InteractiveButton size="md">Medium</InteractiveButton>
                <InteractiveButton size="lg">Large</InteractiveButton>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Button States
              </h3>
              <div className="flex flex-wrap gap-3">
                <InteractiveButton loading>Loading</InteractiveButton>
                <InteractiveButton
                  success={buttonSuccess}
                  onClick={() => handleButtonClick('success')}
                >
                  Click for Success
                </InteractiveButton>
                <InteractiveButton
                  error={buttonError}
                  variant="destructive"
                  onClick={() => handleButtonClick('error')}
                >
                  Click for Error
                </InteractiveButton>
                <InteractiveButton disabled>Disabled</InteractiveButton>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Standard Button with Loading States
              </h3>
              <div className="flex flex-wrap gap-3">
                <Button loading>Processing...</Button>
                <ButtonLoading isLoading={false}>Submit Form</ButtonLoading>
                <ButtonLoading isLoading={true}>Saving...</ButtonLoading>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interactive Links Section */}
        <Card>
          <CardHeader>
            <CardTitle>Interactive Links with Hover States</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Link Variants
                </h3>
                <div className="flex flex-wrap gap-6">
                  <InteractiveLink href="#" variant="default" showIcon>
                    Default Link
                  </InteractiveLink>
                  <InteractiveLink href="#" variant="underline">
                    Underlined Link
                  </InteractiveLink>
                  <InteractiveLink href="#" variant="subtle">
                    Subtle Link
                  </InteractiveLink>
                  <InteractiveLink href="#" variant="bold">
                    Bold Link
                  </InteractiveLink>
                  <InteractiveLink href="https://example.com" external>
                    External Link
                  </InteractiveLink>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form with Loading Overlay */}
        <Card>
          <CardHeader>
            <CardTitle>Form with Loading Overlay</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormSubmit} className="relative space-y-4">
              <FormLoadingOverlay isLoading={isFormLoading} message="Submitting your data..." />

              <Input label="Full Name" placeholder="Enter your name" required />

              <Input label="Email" type="email" placeholder="your.email@example.com" required />

              <Input
                label="Phone"
                type="tel"
                placeholder="(555) 123-4567"
                description="We'll never share your phone number"
              />

              <div className="flex gap-3">
                <Button type="submit" disabled={isFormLoading}>
                  Submit Form
                </Button>
                <Button type="button" variant="outline" disabled={isFormLoading}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Interactive Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Interactive Cards with Hover Effects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InteractiveCard clickable onClick={() => customToast.info('Card clicked!')}>
                <h3 className="text-lg font-semibold mb-2">Default Card</h3>
                <p className="text-sm text-description">
                  Click me to see the interaction feedback!
                </p>
              </InteractiveCard>

              <InteractiveCard variant="elevated" clickable>
                <h3 className="text-lg font-semibold mb-2">Elevated Card</h3>
                <p className="text-sm text-description">
                  This card has an elevated shadow effect on hover.
                </p>
              </InteractiveCard>

              <InteractiveCard variant="outline" clickable>
                <h3 className="text-lg font-semibold mb-2">Outline Card</h3>
                <p className="text-sm text-description">
                  This card has an outline style with hover animation.
                </p>
              </InteractiveCard>
            </div>
          </CardContent>
        </Card>

        {/* Progress Indicators */}
        <Card>
          <CardHeader>
            <CardTitle>Progress Indicators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <ProgressIndicator
                value={progress}
                showLabel
                label="Upload Progress"
                variant="default"
              />
              <Button onClick={handleProgressSimulation} className="mt-4" size="sm">
                Simulate Progress
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Different Variants
              </h3>
              <div className="space-y-3">
                <ProgressIndicator value={75} variant="success" showLabel label="Success State" />
                <ProgressIndicator value={50} variant="warning" showLabel label="Warning State" />
                <ProgressIndicator value={30} variant="error" showLabel label="Error State" />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Different Sizes
              </h3>
              <div className="space-y-3">
                <ProgressIndicator value={60} size="sm" />
                <ProgressIndicator value={60} size="md" />
                <ProgressIndicator value={60} size="lg" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Toast Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Toast Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => customToast.success('Success notification!')}>
                Show Success
              </Button>
              <Button onClick={() => customToast.error('Error notification!')} variant="destructive">
                Show Error
              </Button>
              <Button onClick={() => customToast.warning('Warning notification!')} variant="secondary">
                Show Warning
              </Button>
              <Button onClick={() => customToast.info('Info notification!')} variant="outline">
                Show Info
              </Button>
              <Button
                onClick={() => {
                  const promise = new Promise((resolve) => setTimeout(resolve, 2000));
                  customToast.promise(promise, {
                    loading: 'Processing...',
                    success: 'Completed!',
                    error: 'Failed!',
                  });
                }}
              >
                Show Promise Toast
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Action Feedback Component */}
        <Card>
          <CardHeader>
            <CardTitle>Action Feedback Component</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={() => setShowToast(!showToast)}>
                Toggle Action Feedback
              </Button>

              {showToast && (
                <ActionFeedback
                  type="success"
                  message="Action completed successfully!"
                  description="Your changes have been saved to the database."
                  onClose={() => setShowToast(false)}
                  action={{
                    label: 'Undo',
                    onClick: () => customToast.info('Action undone!'),
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading Spinners */}
        <Card>
          <CardHeader>
            <CardTitle>Loading Spinners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <InlineSpinner size="xs" />
                <span className="text-xs text-description">Extra Small</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <InlineSpinner size="sm" />
                <span className="text-xs text-description">Small</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <InlineSpinner size="md" />
                <span className="text-xs text-description">Medium</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <InlineSpinner size="lg" />
                <span className="text-xs text-description">Large</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Badges */}
        <Card>
          <CardHeader>
            <CardTitle>Enhanced Badge Hover States</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Status Badges
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="open" dot>
                    Open
                  </Badge>
                  <Badge variant="inProgress" dot pulse>
                    In Progress
                  </Badge>
                  <Badge variant="pending" dot>
                    Pending
                  </Badge>
                  <Badge variant="resolved" dot>
                    Resolved
                  </Badge>
                  <Badge variant="closed" dot>
                    Closed
                  </Badge>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Priority Badges
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="low">Low Priority</Badge>
                  <Badge variant="medium">Medium Priority</Badge>
                  <Badge variant="high">High Priority</Badge>
                  <Badge variant="critical" pulse>
                    Critical Priority
                  </Badge>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                  Removable Badges
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="primary" removable onRemove={() => customToast.info('Badge removed')}>
                    Removable
                  </Badge>
                  <Badge variant="success" removable>
                    Tag 1
                  </Badge>
                  <Badge variant="warning" removable>
                    Tag 2
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
