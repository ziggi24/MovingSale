# Firestore Security Rules

Copy and paste these rules into your Firebase Console under Firestore Database > Rules.

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if user is admin
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }

    // Items collection - readable by all, writable by admins only
    match /items/{itemId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // Requests collection - users can create their own, read their own, admins can read all
    match /requests/{requestId} {
      allow create: if request.auth != null &&
        request.resource.data.userId == request.auth.uid;
      allow read: if isAdmin() ||
        (request.auth != null && request.auth.uid == resource.data.userId);
      allow update, delete: if request.auth != null &&
        request.auth.uid == resource.data.userId;
    }

    // Users collection - users can read/write their own document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Setting Up Admin Users

To make a user an admin:

1. Go to Firebase Console > Firestore Database
2. Navigate to the `users` collection
3. Create a document with the document ID matching the user's Firebase Auth UID
4. Add a field: `isAdmin` (boolean) = `true`

Alternatively, you can set this programmatically or via the Firebase CLI.

**Note:** The user must have logged in at least once (so their UID exists) before you can create their user document in Firestore.

