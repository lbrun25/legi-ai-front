import {useEffect, useState} from "react";
import {Decision} from "@/lib/types/decision";
import {useAppState} from "@/lib/context/app-state";

export const useDecision = (decisionNumber: string) => {
  const { getCachedDecision, setCachedDecision } = useAppState();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDecision = async () => {
      setLoading(true);
      setError(null);

      const cachedDecision = getCachedDecision(decisionNumber);
      if (cachedDecision) {
        setDecision(cachedDecision);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/decisions?number=${encodeURIComponent(decisionNumber)}`);
        if (!response.ok) {
          setError(`Error fetching decision: ${response.statusText}`);
          return;
        }
        const data = await response.json();

        setCachedDecision(decisionNumber, data);
        setDecision(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDecision();
  }, [decisionNumber, getCachedDecision, setCachedDecision]);

  return { decision, loading, error };
};
