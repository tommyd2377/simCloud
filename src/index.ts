import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import * as firestoreAdmin from '@google-cloud/firestore';

admin.initializeApp();

const bucket = 'gs://<bucket name>';
const projectId = '<project id>';

export const startFirestoreImport = functions.https.onRequest(async (request, response) => {
    try {
      const firestore = admin.firestore();
      const collections = await firestore.listCollections();
  
      // Delete all documents in each collection except for "storedHash"
      const deletePromises = collections.map((collection) => {
        if (collection.id !== 'storedHash') { // Skip "storedHash" collection
          const query = collection.orderBy('__name__');
  
          return query.get().then((snapshot) => {
            const batch = firestore.batch();
            snapshot.forEach((doc) => {
              batch.delete(doc.ref);
            });
            return batch.commit();
          });
        } else {
          return Promise.resolve(); // Skip deletion for "storedHash" collection
        }
      });
  
      await Promise.all(deletePromises);
  
      response.send('All documents (except "storedHash") deleted successfully.');
  
      const firestoreAdminClient = new firestoreAdmin.v1.FirestoreAdminClient();
      const databaseName = `projects/${projectId}/databases/(default)`;
  
      const importOperation = await firestoreAdminClient.importDocuments({
        name: databaseName,
        inputUriPrefix: bucket + '/current/',
        collectionIds: [],
      });
  
      console.log(`Operation Name: ${importOperation}`);
  
      response.send('Firestore import started successfully.');
    } catch (error) {
      console.error(error);
      response.status(500).send('An error occurred while starting Firestore import.');
    }
});
  
export const checkDatabaseState = functions.https.onRequest(async (request, response) => {
  try {
    const docRef = admin.firestore().doc('shoes/nike');
    const snapshot = await docRef.get();

    //563c38a5d8334a9b25a166860d9a8c44

    if (snapshot.exists) {
      const data = snapshot.data();
      const currentHash = calculateHash(data);

      // Retrieve the stored hash from the database
      const storedHashSnapshot = await admin.firestore().doc('storedHash/hash').get();
      const storedHash = storedHashSnapshot.exists ? storedHashSnapshot.data()?.hash : null;

      if (storedHash === currentHash) {
        response.send('Database is in a defined state. No changes detected.');
      } else {
        // Update the stored hash with the current hash
        await admin.firestore().doc('storedHash/hash').set({ hash: currentHash });
        response.send('Database state has changed. Hash updated.');
      }
    } else {
      response.send('Database is not in a defined state or the document does not exist.');
    }
  } catch (error) {
    console.error('Error retrieving Firestore document:', error);
    response.status(500).send('An error occurred while retrieving Firestore document.');
  }
});

function calculateHash(data: any): string {
  const hash = createHash('md5').update(JSON.stringify(data)).digest('hex');
  return hash;
}