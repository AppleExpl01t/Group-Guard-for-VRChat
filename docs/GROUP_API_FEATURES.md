# VRChat Group API Features & Moderation Capabilities

This document catalogs every known VRChat Group API feature accessible to the "Group Guard" application. It is categorized by relevance to moderation tasks to aid in feature planning.

**Data Sources:**

- `vrchat.community` API Documentation
- VRCX Reference Implementation (`src/api/group.js`, `GroupMemberModerationDialog.vue`)

---

## 1. Moderation Usable Features

_Features explicitly designed for enforcing rules, managing access, and disciplining users._

### A. Member Discipline

Direct actions taken against specific users.

| Feature           | Endpoint Logic                              | Description                                                                                                             |
| :---------------- | :------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| **Kick Member**   | `DELETE /groups/{groupId}/members/{userId}` | Removes a user from the group. They can re-join if the group is Open/Request, or be re-invited.                         |
| **Ban Member**    | `POST /groups/{groupId}/bans`               | Removes a user and prevents them from re-joining or requesting to join.                                                 |
| **Unban Member**  | `DELETE /groups/{groupId}/bans/{userId}`    | Restores a user's ability to join the group.                                                                            |
| **View Bans**     | `GET /groups/{groupId}/bans`                | Lists all currently banned users. Essential for audit and appeals.                                                      |
| **Manager Notes** | `PUT /groups/{groupId}/members/{userId}`    | Allows admins to attach private notes to a member (e.g., "Warned for spamming"). This is stored on the `member` object. |

### B. Access Control (Join Requests)

Managing the flow of new users into the group.

| Feature                    | Endpoint Logic                                    | Description                                                                             |
| :------------------------- | :------------------------------------------------ | :-------------------------------------------------------------------------------------- |
| **View Requests**          | `GET /groups/{groupId}/requests`                  | Lists users waiting to join (for Request-only groups).                                  |
| **Accept Request**         | `PUT /.../requests/{userId} { action: 'accept' }` | Approves a user's entry into the group.                                                 |
| **Deny Request**           | `PUT /.../requests/{userId} { action: 'reject' }` | Denies entry. The user can potentially request again.                                   |
| **Block Request**          | `PUT /.../requests/{userId} { block: true }`      | Denies entry and **blocks** the user from requesting again. Prevents spamming requests. |
| **View Blocked Requests**  | `GET` (Inferred via filter or separate list)      | View users who have been soft-blocked from requesting.                                  |
| **Delete Blocked Request** | `DELETE /groups/{groupId}/members/{userId}`       | Removes the "blocked request" status, allowing the user to try again.                   |

### C. Invite Management

Managing outgoing invitations.

| Feature            | Endpoint Logic                              | Description                                          |
| :----------------- | :------------------------------------------ | :--------------------------------------------------- |
| **Send Invite**    | `POST /groups/{groupId}/invites`            | Invites a user to the group (bypasses requests).     |
| **Rescind Invite** | `DELETE /groups/{groupId}/invites/{userId}` | Cancels a pending invite before the user accepts it. |
| **View Invites**   | `GET /groups/{groupId}/invites`             | Lists all outstanding invites sent by admins.        |

### D. Audit Logging

Tracking who did what.

| Feature         | Endpoint Logic                        | Description                                                                             |
| :-------------- | :------------------------------------ | :-------------------------------------------------------------------------------------- |
| **Fetch Logs**  | `GET /groups/{groupId}/auditLogs`     | Retrieves a chronological list of actions (bans, kicks, role changes, setting updates). |
| **Log Filters** | `GET /groups/{groupId}/auditLogTypes` | Returns valid types to filter the log query (e.g., `member.kick`, `group.update`).      |

---

## 2. Possibly Usable for Moderation

_Features that are primarily administrative but can be leveraged for advanced moderation workflows._

### A. Role Management

| Feature               | Description                                   | Moderation Use Case                                                       |
| :-------------------- | :-------------------------------------------- | :------------------------------------------------------------------------ |
| **Assign Role**       | `PUT /.../members/{userId}/roles/{roleId}`    | Creating "Muted", "Probation", or "Guest" roles with limited permissions. |
| **Remove Role**       | `DELETE /.../members/{userId}/roles/{roleId}` | Stripping permissions from rogue moderators or promoting users.           |
| **View Roles**        | `GET /groups/{groupId}/roles`                 | specific permissions attached to roles to verify security hierarchy.      |
| **Permissions Check** | `GET /users/{userId}/groups/permissions`      | Verifying what the _current_ user (the bot/admin) can actually do.        |

### B. Instance Monitoring

| Feature             | Description                                  | Moderation Use Case                                                         |
| :------------------ | :------------------------------------------- | :-------------------------------------------------------------------------- |
| **Group Instances** | `GET /users/{id}/instances/groups/{groupId}` | Lists active instances tagged with the group.                               |
| **Monitoring**      | -                                            | Allows moderators to see where activity is happening and jump in to patrol. |

### C. Member Information

| Feature            | Description                         | Moderation Use Case                                           |
| :----------------- | :---------------------------------- | :------------------------------------------------------------ |
| **Search Members** | `GET /.../members/search?query=...` | Quickly finding a user to ban/kick by name.                   |
| **Member Details** | `GET /.../members/{userId}`         | Checking "Joined At" dates to identify raids or new accounts. |

### D. Communication

| Feature         | Description                               | Moderation Use Case                                              |
| :-------------- | :---------------------------------------- | :--------------------------------------------------------------- |
| **Create Post** | `POST /groups/{groupId}/posts`            | Posting "Rules," "Ban Waves," or important safety announcements. |
| **Delete Post** | `DELETE /groups/{groupId}/posts/{postId}` | Moderating the group's news feed (removing unauthorized posts).  |

---

## 3. Not Moderation Features (General Management)

_Features related to cosmetics, social display, and basic configuration. Lower priority for "Group Guard"._

- **Group Metadata:**
  - `getGroup`: Viewing Name, Description, Icon, Banner, Member Count.
  - `editGroup` (Inferred): Changing description/icon.
- **Galleries:** `getGroupGallery` (Image collections).
- **Search:** `groupSearch` (Finding _other_ groups).
- **Calendars:** `getGroupCalendar`, `getGroupCalendarEvent` (Event scheduling).
- **Representation:** `setGroupRepresentation` (Showing the group badge on a profile).
- **Privacy Settings:** Toggling between Public/Private/Open/Closed (technically moderation, but usually a one-time setup).

---

## 4. Key Data Structures

### `GroupMember` Object

Critical for displaying user lists.

```json
{
  "id": "gmem_...",
  "groupId": "grp_...",
  "userId": "usr_...",
  "isRepresenting": false,
  "roleIds": ["role_..."],
  "mangerNotes": "String (Admin only)",
  "membershipStatus": "member|admin|owner",
  "visibility": "visible|hidden|friends",
  "joinedAt": "ISO Date",
  "bannedAt": "ISO Date (if banned)",
  "user": { ...LimitedUserObject... }
}
```

### `AuditLog` Object

Critical for the "Log Viewer" feature.

```json
{
  "id": "log_...",
  "created_at": "ISO Date",
  "eventType": "member.kick",
  "actorId": "usr_... (Admin who did it)",
  "actorDisplayName": "Admin Name",
  "targetId": "usr_... (Victim)",
  "description": "Human readable string",
  "data": { ...metadata args... }
}
```
