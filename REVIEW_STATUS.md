# Code Review Status

Tracks which files have been through the simplify/quality review pass.

**Legend:**
- `[REVIEWED]` — Fully reviewed and cleaned up
- `[PARTIAL]` — Batch was submitted but only some files were confirmed fixed before rate limit
- `[ ]` — Not yet reviewed

---

## Backend

### backend/src/modules/backup/
- [REVIEWED] `service.ts` — extracted backupPaths helper, parallelized writes + reads, eliminated over-fetch in deleteBackup
- [REVIEWED] `controller.ts`
- [REVIEWED] `routes.ts`

### backend/src/storage/
- [REVIEWED] `objectStorage.ts`

### backend/scripts/
- [REVIEWED] `generate-token.ts`

### backend/src/modules/auth/
- [ ] `service.ts`
- [ ] `controller.ts`
- [ ] `routes.ts`

### backend/src/middleware/
- [ ] `auth.ts`
- [ ] `errorHandler.ts`

### backend/
- [ ] `index.ts`
- [ ] `config.ts`

---

## Electron Main Process

### electron/main.ts + controllers/
- [ ] `electron/main.ts`
- [ ] `electron/controllers/AutoModController.ts`

### electron/preload.ts
- [ ] `electron/preload.ts`
- [ ] `alpha_preload.ts`
- [ ] `alpha_electron.d.ts`

### electron/services/ — Core services
- [ ] `AuthService.ts`
- [ ] `CredentialsService.ts`
- [ ] `StorageService.ts`
- [ ] `SettingsService.ts`
- [ ] `VRChatApiService.ts`
- [ ] `NetworkService.ts`
- [ ] `UserService.ts`
- [ ] `UserProfileService.ts`
- [ ] `AutoModService.ts`
- [ ] `AutoModRuleService.ts`
- [ ] `AutoModConfigService.ts`
- [ ] `AutoModScannerService.ts`
- [ ] `GroupService.ts`
- [ ] `GroupAuthorizationService.ts`
- [ ] `PermissionGuardService.ts`
- [ ] `WatchlistService.ts`
- [ ] `ReportService.ts`
- [ ] `PipelineService.ts`
- [ ] `LogWatcherService.ts`
- [ ] `LogParserService.ts`
- [ ] `LogScannerService.ts`
- [ ] `SessionService.ts`
- [ ] `InstanceService.ts`
- [ ] `InstanceGuardService.ts`
- [ ] `InstanceLoggerService.ts`
- [ ] `FriendshipService.ts`
- [ ] `FriendshipIpc.ts`
- [ ] `RelationshipService.ts`
- [ ] `SocialFeedService.ts`
- [ ] `AuditService.ts`
- [ ] `DatabaseService.ts`
- [ ] `GameLogService.ts`
- [ ] `EntityEnrichmentService.ts`
- [ ] `ServiceEventBus.ts`
- [ ] `DiscordWebhookService.ts`
- [ ] `DiscordBroadcastService.ts`
- [ ] `OscService.ts`
- [ ] `OscAnnouncementService.ts`
- [ ] `WindowService.ts`
- [ ] `ProcessService.ts`
- [ ] `InstallationIdService.ts`
- [ ] `IdentityService.ts`
- [ ] `StaffService.ts`
- [ ] `TimeTrackingService.ts`
- [ ] `BulkFriendService.ts`
- [ ] `RallyService.ts`
- [ ] `InviteService.ts`
- [ ] `LocationService.ts`
- [ ] `PlayerStateService.ts`
- [ ] `PlayerLogService.ts`
- [ ] `PlayerFlagService.ts`

### electron/services/__tests__/
- [ ] `AuthService.test.ts`
- [ ] `AutoModRuleService.test.ts`
- [ ] `InstanceGuardService.test.ts`
- [ ] `LogParserService.test.ts`
- [ ] `WatchlistService.test.ts`
- [ ] `GroupAuthorizationService.test.ts`

---

## React Renderer

### src/types/
- [ ] `electron.d.ts`

### src/config.ts + constants/
- [ ] `src/config.ts`
- [ ] `src/constants/app.ts`
- [ ] `src/vite-env.d.ts`

### src/utils/
- [ ] `errorUtils.ts`
- [ ] `retry.ts`
- [ ] `ipcCache.ts`
- [ ] `animations.ts`

### src/lib/
- [ ] `utils.ts`

### src/context/
- [ ] `ConfirmationContext.tsx`
- [ ] `ThemeContext.tsx`

### src/App.tsx + src/main.tsx
- [ ] `src/App.tsx`
- [ ] `src/main.tsx`

### src/stores/
- [PARTIAL] `authStore.ts` — removed duplicate User interface, added getErrorMessage, collapsed duplicate autoLogin branches
- [ ] `groupStore.ts`
- [ ] `pipelineStore.ts`
- [ ] `instanceMonitorStore.ts`
- [ ] `scanStore.ts`
- [PARTIAL] `auditStore.ts` — added getErrorMessage, removed redundant alias, inlined slice, removed noisy comments
- [ ] `notificationStore.ts`
- [ ] `autoModAlertStore.ts`
- [ ] `uiStore.ts`
- [ ] `appViewStore.ts`
- [ ] `adminStore.ts`
- [ ] `groupPreferencesStore.ts`
- [ ] `roamingLogStore.ts`
- [ ] `updateStore.ts`
- [ ] `userProfileStore.ts`

### src/hooks/
- [ ] `animation.ts`
- [ ] `useCountUp.ts`
- [ ] `useMicroInteractions.ts`
- [ ] `useMouseGlow.ts`
- [ ] `useTilt.ts`
- [ ] `useRipple.tsx`
- [ ] `useHeartbeat.ts`
- [ ] `usePipelineInit.ts`
- [ ] `useInstanceMonitorInit.ts`
- [ ] `useAutoModNotifications.ts`
- [ ] `useUserBatchFetcher.ts`
- [ ] `useDataRefresh.ts`
- [ ] `useInstanceAutoRefresh.ts`
- [ ] `usePoller.ts`

### src/components/ui/
- [ ] `AppShieldIcon.tsx`
- [ ] `Badge.tsx`
- [ ] `Button.tsx`
- [ ] `Card.tsx`
- [ ] `ConfirmationModal.tsx`
- [ ] `CustomCursor.tsx`
- [ ] `Dialog.tsx`
- [ ] `GlassCard.tsx`
- [ ] `GlassPanel.tsx`
- [ ] `Input.tsx`
- [ ] `Label.tsx`
- [ ] `LiveBadge.tsx`
- [ ] `LogFilterBar.tsx`
- [ ] `Modal.tsx`
- [ ] `NeonButton.tsx`
- [ ] `NeonSelect.tsx`
- [ ] `ParticleDissolveImage.tsx`
- [ ] `PipelineStatus.tsx`
- [ ] `PlayerFlags.tsx`
- [ ] `RefreshTimer.tsx`
- [ ] `Select.tsx`
- [ ] `Skeleton.tsx`
- [ ] `Textarea.tsx`
- [ ] `Toast.tsx`
- [ ] `ToastContainer.tsx`
- [ ] `UserBadges.tsx`
- [ ] `ViewLoader.tsx`
- [ ] `index.ts`

### src/components/layout/
- [ ] `AppLayout.tsx`
- [ ] `DockItem.tsx`
- [ ] `GlobalModals.tsx`
- [ ] `NeonDock.tsx`
- [ ] `PageTransition.tsx`
- [ ] `ParticleBackground.tsx`
- [ ] `TitleBar.tsx`
- [ ] `WindowControls.tsx`

### src/components/ (shared modals + error boundary)
- [ ] `ErrorBoundary.tsx`
- [ ] `ProfileModal.tsx`
- [ ] `modals/AvatarProfileModal.tsx`
- [ ] `modals/GroupProfileModal.tsx`
- [ ] `modals/UserProfileModal.tsx`
- [ ] `modals/WorldProfileModal.tsx`

### src/features/auth/
- [ ] `LoginView.tsx`
- [ ] `AutoLoginLoadingScreen.tsx`
- [ ] `UserProfileWidget.tsx`

### src/features/automod/
- [ ] `AutoModView.tsx`
- [ ] `types.ts`
- [ ] `index.ts`
- [ ] `components/ChipInput.tsx`
- [ ] `components/InterceptionLog.tsx`
- [ ] `components/ModuleTab.tsx`
- [ ] `components/RuleCard.tsx`
- [ ] `components/TagBadge.tsx`
- [ ] `dialogs/BlacklistedGroupsConfigModal.tsx`
- [ ] `dialogs/KeywordConfigModal.tsx`
- [ ] `dialogs/ScanResultsDialog.tsx`
- [ ] `dialogs/UserActionModal.tsx`
- [ ] `dialogs/WhitelistViewerModal.tsx`
- [ ] `utils/automodHelpers.ts`

### src/features/dashboard/
- [ ] `DashboardView.tsx`
- [ ] `components/StatTile.tsx`
- [ ] `dialogs/BansListDialog.tsx`
- [ ] `dialogs/InstancesListDialog.tsx`
- [ ] `dialogs/MassInviteDialog.tsx`
- [ ] `dialogs/MemberRoleDialog.tsx`
- [ ] `dialogs/MemberSearchDialog.tsx`
- [ ] `dialogs/MembersListDialog.tsx`
- [ ] `dialogs/RequestsListDialog.tsx`
- [ ] `dialogs/UserProfileDialog.tsx`
- [ ] `widgets/InstanceMonitorWidget.tsx`
- [ ] `widgets/MemberSearchWidget.tsx`
- [ ] `widgets/OscAnnouncementWidget.tsx`

### src/features/live/
- [ ] `LiveView.tsx`
- [ ] `components/EntityCard.tsx`
- [ ] `components/InstanceHealthWidget.tsx`
- [ ] `components/LivePlayerChart.tsx`
- [ ] `components/LiveToolbar.tsx`
- [ ] `dialogs/AddFlagDialog.tsx`
- [ ] `dialogs/BanUserDialog.tsx`
- [ ] `dialogs/OperationStartDialog.tsx`
- [ ] `dialogs/RecruitResultsDialog.tsx`
- [ ] `overlays/AutoModAlertOverlay.tsx`

### src/features/audit/
- [ ] `AuditLogView.tsx`

### src/features/instances/
- [ ] `InstanceGuardView.tsx`
- [ ] `WorldListModal.tsx`
- [ ] `components/InstanceLog.tsx`
- [ ] `dialogs/InstanceEventModal.tsx`

### src/features/groups/
- [ ] `GroupSelectorView.tsx`
- [ ] `StaffView.tsx`

### src/features/watchlist/
- [ ] `WatchlistView.tsx`
- [ ] `EntityDetailDialog.tsx`
- [ ] `dialogs/EntitySearchModal.tsx`
- [ ] `dialogs/TagManagerDialog.tsx`
- [ ] `types.ts`

### src/features/integrations/
- [ ] `IntegrationsView.tsx`
- [ ] `IntegrationsTabBar.tsx`
- [ ] `index.ts`

### src/features/settings/
- [ ] `SettingsView.tsx`
- [ ] `SettingsTabBar.tsx`
- [ ] `SettingsSearch.tsx`
- [ ] `AudioSettings.tsx`
- [ ] `DiscordRpcSettings.tsx`
- [ ] `DiscordWebhookSettings.tsx`
- [ ] `OscSettings.tsx`
- [ ] `PrivacySettings.tsx`
- [ ] `components/BulkFriendImport.tsx`
- [ ] `dialogs/PrivacyDangerDialog.tsx`

### src/features/setup/
- [ ] `SetupView.tsx`
- [ ] `PrivacyPolicyModal.tsx`
- [ ] `TermsOfServiceModal.tsx`

### src/features/notifications/
- [ ] `NotificationPanel.tsx`

### src/features/reports/
- [ ] `ReportGeneratorDialog.tsx`

### src/features/database/
- [ ] `DatabaseView.tsx`

### src/features/admin/
- [ ] `AdminPanelView.tsx`
- [ ] `UserAnalyticsModal.tsx`

### src/views/ (friendship/social)
- [ ] `FriendshipManagerView.tsx`
- [ ] `friendship/FeedView.tsx`
- [ ] `friendship/FriendsListView.tsx`
- [ ] `friendship/GameLogView.tsx`
- [ ] `friendship/LocationsView.tsx`
- [ ] `friendship/SocialView.tsx`
- [ ] `friendship/index.ts`

### scripts/ + root
- [ ] `list_tokens.js`
- [ ] `scripts/clear_automod_groups.js`
