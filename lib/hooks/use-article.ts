import {useEffect, useState} from "react";
import {Article} from "@/lib/types/article";
import {useAppState} from "@/lib/context/app-state";

export const useArticle = (articleNumber: string, articleSource: string) => {
  const { getCachedArticle, setCachedArticle } = useAppState();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true);
      setError(null);

      const cachedArticle = getCachedArticle(articleNumber, articleSource);
      if (cachedArticle) {
        setArticle(cachedArticle);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/articles?source=${encodeURIComponent(articleSource)}&number=${encodeURIComponent(articleNumber)}`);
        if (!response.ok) {
          setError(`Error fetching article: ${response.statusText}`);
          return;
        }
        const data = await response.json();

        setCachedArticle(articleNumber, articleSource, data);
        setArticle(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [articleNumber, articleSource, getCachedArticle, setCachedArticle]);

  return { article, loading, error };
};
