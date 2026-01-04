/**
 * usePipelineInit Hook
 * 
 * Initializes the Pipeline WebSocket connection and sets up event listeners
 * for all stores that need real-time updates.
 * 
 * Usage: Call once in your root App component.
 */

import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePipelineStore } from '../stores/pipelineStore';
import { useGroupStore } from '../stores/groupStore';
import { useAuthStore } from '../stores/authStore';

export function usePipelineInit(): void {
  const initRef = useRef(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const pipelineConnect = usePipelineStore((state) => state.connect);
  const pipelineDisconnect = usePipelineStore((state) => state.disconnect);
  const initializeListeners = usePipelineStore((state) => state.initializeListeners);
  const handlePipelineEvent = useGroupStore((state) => state.handlePipelineEvent);
  const pipelineSubscribe = usePipelineStore((state) => state.subscribe);

  // Initialize IPC listeners once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    console.log('[usePipelineInit] Initializing Pipeline IPC listeners');
    const cleanup = initializeListeners();

    return () => {
      console.log('[usePipelineInit] Cleaning up Pipeline IPC listeners');
      cleanup();
    };
  }, [initializeListeners]);

  // Connect/disconnect based on auth state
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[usePipelineInit] User authenticated, connecting to Pipeline');
      pipelineConnect();
    } else {
      console.log('[usePipelineInit] User not authenticated, disconnecting Pipeline');
      pipelineDisconnect();
    }
  }, [isAuthenticated, pipelineConnect, pipelineDisconnect]);

  // Subscribe group store to relevant events
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('[usePipelineInit] Setting up group store event subscriptions');

    // Subscribe to group events and forward to groupStore
    const unsubMember = pipelineSubscribe('group-member-updated', handlePipelineEvent);
    const unsubRole = pipelineSubscribe('group-role-updated', handlePipelineEvent);
    const unsubJoined = pipelineSubscribe('group-joined', handlePipelineEvent);
    const unsubLeft = pipelineSubscribe('group-left', handlePipelineEvent);

    return () => {
      console.log('[usePipelineInit] Cleaning up group store event subscriptions');
      unsubMember();
      unsubRole();
      unsubJoined();
      unsubLeft();
    };
  }, [isAuthenticated, pipelineSubscribe, handlePipelineEvent]);
}

/**
 * Hook to get pipeline connection status
 * Uses shallow comparison to prevent infinite re-renders
 */
export function usePipelineStatus() {
  return usePipelineStore(
    useShallow((state) => ({
      connected: state.connected,
      connecting: state.connecting,
      error: state.error,
      lastEventAt: state.lastEventAt,
      reconnectAttempts: state.reconnectAttempts
    }))
  );
}

/**
 * Hook to get recent pipeline events (for debugging/display)
 */
export function usePipelineEvents(limit = 10) {
  const recentEvents = usePipelineStore((state) => state.recentEvents);
  return recentEvents.slice(0, limit);
}
