
# Reviews v2 Read Spec

This document freezes the canonical v2 review read contract: required fields, supported query patterns, and composite index requirements.

## Required v2 Fields

- `createdAt`: Firestore `Timestamp`
- `updatedAt`: Firestore `Timestamp`
- `userId`: `string`
- `restaurantId`: `string`
- `dishId`: `string | null`
- `dishName`: `string`
- `dishCategory`: `string`
- `rating`: `number`
- `isDeleted`: `boolean`
- `media.photos`: `string[]`

Legacy fields to ignore: `timestamp`, `isPublic`, `visibility`.

## Canonical Read Patterns (Query-Enforced isDeleted)

We enforce public visibility via a query filter on `isDeleted == false`. This avoids brittle rule-side filtering and makes index needs explicit.

### A) Home Feed (public)
- Filters: `where('isDeleted', '==', false)`
- Order: `orderBy('createdAt', 'desc')`
- Index: Composite on `(isDeleted ASC, createdAt DESC)`

### B) User Feed
- Filters: `where('userId', '==', <uid>)`, `where('isDeleted', '==', false)`
- Order: `orderBy('createdAt', 'desc')`
- Index: Composite on `(userId ASC, isDeleted ASC, createdAt DESC)`

### C) Restaurant Feed
- Filters: `where('restaurantId', '==', <id>)`, `where('isDeleted', '==', false)`
- Order: `orderBy('createdAt', 'desc')`
- Index: Composite on `(restaurantId ASC, isDeleted ASC, createdAt DESC)`

### D) Menu/Dish Feed
- Menu path: `where('menuItemId', '==', <id>)`, `where('isDeleted', '==', false)`, `orderBy('createdAt', 'desc')`
  - Index: `(menuItemId ASC, isDeleted ASC, createdAt DESC)`
- Dish path: `where('dishId', '==', <id>)`, `where('isDeleted', '==', false)`, `orderBy('createdAt', 'desc')`
  - Index: `(dishId ASC, isDeleted ASC, createdAt DESC)`

### E) Following Feed
- Filters: `where('userId', 'in', [<uids..>])`, `where('isDeleted', '==', false)`
- Order: `orderBy('createdAt', 'desc')`
- Index: Composite on `(userId ASC, isDeleted ASC, createdAt DESC)`
  - Note: Firestore allows up to 10 items for `'in'`. If more, page the ID list.

## Index Snippet (spec only)

These represent the minimal required composite indexes for the above patterns. Directions shown; Firestore stores equality fields as ASC in the index definition.

```json
{
  "indexes": [
    { "collectionGroup": "reviews", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "reviews", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "userId", "order": "ASCENDING" },
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "reviews", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "restaurantId", "order": "ASCENDING" },
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "reviews", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "menuItemId", "order": "ASCENDING" },
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "reviews", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "dishId", "order": "ASCENDING" },
      { "fieldPath": "isDeleted", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]}
  ],
  "fieldOverrides": []
}
```

## Notes

- All reads rely on `createdAt` as Firestore `Timestamp` and `isDeleted === false`.
- Ignore legacy fields (`timestamp`, `isPublic`, `visibility`) in all read paths.
- For following feed, if switching from `timestamp` to `createdAt`, ensure the `(userId, isDeleted, createdAt)` index exists first.

Stabilization complete (2025-10-11): All review reads use where(isDeleted==false) + orderBy(createdAt desc) with minimal composites; legacy timestamp removed; v2 data normalized; probes (Home/User/Restaurant/Following) pass. 
---

### ✅ Stabilization Summary (2025-10-11)

All review reads now use:

```js
where('isDeleted', '==', false)
orderBy('createdAt', 'desc')
