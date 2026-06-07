import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../firebase';
import { submitFeedback } from '../utils/orderHelpers';

export function useFeedback(user, view) {
  const [feedbackByDesign, setFeedbackByDesign] = useState({});
  const [submittingFeedback, setSubmittingFeedback] = useState({});
  const [submittedFeedback, setSubmittedFeedback] = useState({});
  const [feedbackList, setFeedbackList] = useState([]);

  useEffect(() => {
    if (!user || view !== 'adminDashboard') return;

    const feedbackRef = collection(db, 'artifacts', appId, 'public', 'data', 'feedback');
    const unsubscribe = onSnapshot(feedbackRef, (snapshot) => {
      const fetchedFeedback = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetchedFeedback.sort((a, b) => b.timestamp - a.timestamp);
      setFeedbackList(fetchedFeedback);
    }, (err) => {
      console.error("Error fetching feedback:", err);
    });

    return () => unsubscribe();
  }, [user, view]);

  const handleSubmitFeedback = async (designId, designs, globalConfig) => {
    const feedback = feedbackByDesign[designId] || '';
    
    setSubmittingFeedback(prev => ({ ...prev, [designId]: true }));

    try {
      await submitFeedback({
        designId,
        feedback,
        designs,
        globalConfig
      });

      setSubmittedFeedback(prev => ({ ...prev, [designId]: true }));
    } catch (err) {
      console.error('Error submitting feedback:', err);
      alert(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmittingFeedback(prev => ({ ...prev, [designId]: false }));
    }
  };

  const handleDeleteFeedback = async (feedbackId) => {
    try {
      const feedbackRef = doc(db, 'artifacts', appId, 'public', 'data', 'feedback', feedbackId);
      await deleteDoc(feedbackRef);
    } catch (err) {
      console.error('Error deleting feedback:', err);
      alert('Failed to delete feedback');
    }
  };

  return {
    feedbackByDesign,
    setFeedbackByDesign,
    submittingFeedback,
    submittedFeedback,
    feedbackList,
    handleSubmitFeedback,
    handleDeleteFeedback
  };
}

// Made with Bob
