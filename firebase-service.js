
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const aiJobsCollection = collection(db, "ai_jobs");

/**
 * Adds a new job to the 'ai_jobs' collection.
 * @param {string} prompt The prompt for the AI job.
 * @returns {Promise<string>} The ID of the newly created job.
 */
export async function createJob(prompt) {
  try {
    const docRef = await addDoc(aiJobsCollection, {
      prompt: prompt,
      status: 'pending',
      result: '',
      timestamp: serverTimestamp()
    });
    console.log("Job created with ID: ", docRef.id);
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    return null;
  }
}

/**
 * Listens for pending jobs in the 'ai_jobs' collection.
 * @param {(job: {id: string, prompt: string}) => void} callback The callback function to execute when a pending job is found.
 * @returns {() => void} An unsubscribe function to stop listening for updates.
 */
export function listenForPendingJobs(callback) {
  const q = query(aiJobsCollection, where("status", "==", "pending"));

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    querySnapshot.forEach((doc) => {
      callback({ id: doc.id, ...doc.data() });
    });
  });

  return unsubscribe;
}

/**
 * Updates a job in the 'ai_jobs' collection.
 * @param {string} jobId The ID of the job to update.
 * @param {object} data The data to update.
 * @returns {Promise<void>}
 */
export async function updateJob(jobId, data) {
  const jobDoc = doc(db, "ai_jobs", jobId);
  await updateDoc(jobDoc, data);
}

/**
 * Example of how to use the firebase-service.
 */
async function exampleUsage() {
  // Example of creating a job
  // const jobId = await createJob("This is a test prompt.");

  // Example of listening for pending jobs
  const unsubscribe = listenForPendingJobs(async (job) => {
    console.log("Processing job:", job.id, job.prompt);

    // Update job status to 'processing'
    await updateJob(job.id, { status: 'processing' });

    // Simulate processing by calling the local Ollama API
    // In a real implementation, you would make the call to localhost:11434
    const result = `Result for prompt: "${job.prompt}"`;

    // Update job with the result and set status to 'done'
    await updateJob(job.id, { result: result, status: 'done' });
    console.log("Finished processing job:", job.id);
  });

  // To stop listening for jobs, call the unsubscribe function
  // setTimeout(() => {
  //   console.log("Stopping job listener.");
  //   unsubscribe();
  // }, 30000); // Stop after 30 seconds
}

// Uncomment to run the example
// exampleUsage();
