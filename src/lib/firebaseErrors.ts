export const handleFirestoreError = (error: any, context: string) => {
  const message = error?.message || 'Unknown database error.';
  console.error(`Firestore Error [${context}]:`, error);
  // No alert() — callers handle UX feedback
  return message;
};
