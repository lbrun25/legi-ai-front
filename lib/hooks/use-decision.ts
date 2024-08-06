import {useEffect, useState} from "react";
import {Decision} from "@/lib/types/decision";

export const useDecision = (decisionNumber: string) => {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDecision = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/decisions?number=${encodeURIComponent(decisionNumber)}`);
        if (!response.ok) {
          setError(`Error fetching decision: ${response.statusText}`);
          return;
        }
        const data = await response.json();
        setDecision(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDecision();
  }, [decisionNumber]);

  return {decision, loading, error};
};
