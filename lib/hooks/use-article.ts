import {useEffect, useState} from "react";
import {Article} from "@/lib/types/article";

export const useArticle = (articleNumber: string) => {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  console.log('articleNumber:', articleNumber)

  useEffect(() => {
    const fetchArticle = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/articles/${articleNumber}`);
        if (!response.ok) {
          setError(`Error fetching article: ${response.statusText}`);
          return;
        }
        const data = await response.json();
        setArticle(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [articleNumber]);

  return { article, loading, error };
};
