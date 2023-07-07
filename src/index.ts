import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import * as firestoreAdmin from '@google-cloud/firestore';
import { Request, Response } from 'express';

admin.initializeApp();

const bucket = 'gs://<bucket name>';
const projectId = '<project id>';
const firestore = admin.firestore();

export const startFirestoreImport = functions.https.onRequest(async (request, response) => {
    try {
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
    const collections = await firestore.listCollections();
    const hash = createHash('md5');

    for (const collectionRef of collections) {
      if (collectionRef.id !== 'storedHash') { // Skip "storedHash" collection
        const querySnapshot = await collectionRef.get();

        querySnapshot.forEach((docSnapshot) => {
          const data = docSnapshot.data();
          const serializedData = JSON.stringify(data);
          hash.update(serializedData);
        });
      }
    }

    const currentHash = hash.digest('hex');

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
  } catch (error) {
    console.error('Error retrieving Firestore document:', error);
    response.status(500).send('An error occurred while retrieving Firestore document.');
  }
});

export const triggerFirestoreImport = functions.pubsub.topic('trigger-import').onPublish((message) => {
  console.log('Firestore import triggered');
  return startFirestoreImport({} as Request, {} as Response);
});