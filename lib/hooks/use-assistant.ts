import {useEffect, useState} from "react";
import {Assistant} from "openai/resources/beta/assistants";
import OpenAI from "openai";

export const useAssistant = () => {
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingAssistant, setUpdatingAssistant] = useState<boolean>(false);
  const [updateAssistantError, setUpdateAssistantError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAssistant = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/assistant/me`);
        if (!response.ok) {
          setError(`Error fetching assistant: ${response.statusText}`);
          return;
        }
        const data = await response.json();
        setAssistant(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAssistant();
  }, []);


  const updateAssistant = async (assistantUpdateParams: OpenAI.Beta.Assistants.AssistantUpdateParams) => {
    setUpdatingAssistant(true);
    setUpdateAssistantError(null);

    try {
      const response = await fetch('/api/assistant/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assistant: assistantUpdateParams }),
      });
      if (!response.ok) {
        setUpdateAssistantError(`Error updating assistant: ${response.statusText}`);
        return;
      }
      const updatedAssistant = await response.json();
      setAssistant(updatedAssistant);
    } catch (err: any) {
      setUpdateAssistantError(err.message);
    } finally {
      setUpdatingAssistant(false);
    }
  };

  return { assistant, loading, error, updateAssistant, updatingAssistant, updateAssistantError };
};
