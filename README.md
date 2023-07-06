## Firestore Import and Database State Check

This project contains Firebase Cloud Functions that perform two main tasks: starting a Firestore import and checking the state of the Firestore database.

## Function: startFirestoreImport

The startFirestoreImport function is an HTTP-triggered Cloud Function (functions.https.onRequest) that initiates the import of Firestore documents from a specified Cloud Storage bucket into the Firestore database.

How it works:
The function receives an HTTP request.
It retrieves the Firestore client instance and lists all collections in the database using firestore.listCollections().
For each collection, it checks if the collection ID is not equal to "storedHash" (to skip that collection).
If not "storedHash", it retrieves all documents in the collection and creates a batch write operation to delete each document.
After deleting documents from all collections (except "storedHash"), it creates an instance of the Firestore Admin client (firestoreAdmin.v1.FirestoreAdminClient) and initiates the import operation using the importDocuments method.
The function logs the operation name and sends a response indicating that the Firestore import has started successfully.

## Function: checkDatabaseState
The checkDatabaseState function is an HTTP-triggered Cloud Function (functions.https.onRequest) that checks the state of the Firestore database by comparing a calculated hash with a stored hash.

How it works:
The function receives an HTTP request.
It retrieves the Firestore client instance and fetches a specific document ('shoes/nike') using docRef.get().
If the document exists, it calculates the hash of the document's data using the calculateHash function.
It retrieves the stored hash from the Firestore document at 'storedHash/hash'.
If the stored hash is equal to the current hash, it sends a response indicating that the database is in a defined state and no changes are detected.
If the stored hash is different from the current hash, it updates the stored hash with the current hash in the Firestore document at 'storedHash/hash' and sends a response indicating that the database state has changed and the hash is updated.
If the document does not exist, it sends a response indicating that the database is not in a defined state or the document does not exist.
 
## Helper Function: calculateHash

The calculateHash function takes any data object and calculates its MD5 hash using the crypto module. The function is used to calculate the hash of the document's data in the checkDatabaseState function.

Use the `BLANK_README.md` to get started.