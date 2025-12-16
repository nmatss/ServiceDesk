'use client';

/**
 * Workflow Builder Page
 * Visual workflow editor with React Flow
 */

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WorkflowBuilder from '@/src/components/workflow/WorkflowBuilder';
import WorkflowTester from '@/src/components/workflow/WorkflowTester';
import { WorkflowDefinition } from '@/lib/types/workflow';
import toast from 'react-hot-toast';

function WorkflowBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workflowId = searchParams.get('id');

  const [workflow, setWorkflow] = useState<WorkflowDefinition | undefined>(undefined);
  const [loading, setLoading] = useState(!!workflowId);
  const [showTester, setShowTester] = useState(false);

  useEffect(() => {
    if (workflowId) {
      loadWorkflow(parseInt(workflowId));
    }
  }, [workflowId]);

  const loadWorkflow = async (id: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/workflows/definitions/${id}`);
      const data = await response.json();

      if (data.workflow) {
        setWorkflow(data.workflow);
      }
    } catch (error) {
      console.error('Error loading workflow:', error);
      toast.error('Failed to load workflow');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updatedWorkflow: WorkflowDefinition) => {
    try {
      const url = workflow?.id
        ? `/api/workflows/definitions/${workflow.id}`
        : '/api/workflows/definitions';

      const method = workflow?.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedWorkflow),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Workflow saved successfully');
        if (data.workflow) {
          setWorkflow(data.workflow);
          // Update URL if this was a new workflow
          if (!workflow?.id && data.workflow.id) {
            router.push(`/workflows/builder?id=${data.workflow.id}`);
          }
        }
      } else {
        toast.error(data.error || 'Failed to save workflow');
      }
    } catch (error) {
      console.error('Error saving workflow:', error);
      toast.error('Failed to save workflow');
    }
  };

  const handleTest = (workflowToTest: WorkflowDefinition) => {
    setWorkflow(workflowToTest);
    setShowTester(true);
  };

  const handleDeploy = async (workflowToDeploy: WorkflowDefinition) => {
    try {
      if (!workflowToDeploy.id) {
        toast.error('Please save the workflow first');
        return;
      }

      const response = await fetch(`/api/workflows/definitions/${workflowToDeploy.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...workflowToDeploy,
          isActive: true,
        }),
      });

      if (response.ok) {
        toast.success('Workflow deployed successfully');
        setWorkflow({ ...workflowToDeploy, isActive: true });
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to deploy workflow');
      }
    } catch (error) {
      console.error('Error deploying workflow:', error);
      toast.error('Failed to deploy workflow');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <WorkflowBuilder
        workflow={workflow}
        onSave={handleSave}
        onTest={handleTest}
        onDeploy={handleDeploy}
        className="flex-1"
      />

      {showTester && workflow && (
        <WorkflowTester
          workflow={workflow}
          onClose={() => setShowTester(false)}
        />
      )}
    </div>
  );
}

export default function WorkflowBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <WorkflowBuilderContent />
    </Suspense>
  );
}
