import {DialogContent, DialogDescription, DialogFooter, DialogTitle} from "@/components/ui/dialog";
import {Button} from "@/components/ui/button";
import {useArticle} from "@/lib/hooks/use-article";
import {Skeleton} from "@/components/ui/skeleton";
import {Article} from "@/lib/types/article";
import {formatDate} from "@/lib/utils/date";
import {MemoizedReactMarkdown} from "@/components/ui/markdown";

interface ArticleDialogContentProps {
  articleNumber: string;
  articleSource: string;
}

export function ArticleDialogContent({articleNumber, articleSource}: ArticleDialogContentProps) {
  const {article, loading, error} = useArticle(articleNumber, articleSource);

  const renderArticleDate = (article: Article) => {
    return (
      article.isRepealed ? (
        <p>{`Article abrogé depuis le ${formatDate(article.endDate)}`}</p>
      ) : (
        <p>{`Article en vigueur depuis le ${formatDate(article.startDate)}`}</p>
      )
    )
  }

  return (
    <DialogContent>
      <div>
        <DialogTitle className="text-2xl font-bold">{`Article ${articleNumber}`}</DialogTitle>
        {loading ? (
          <Skeleton className="w-full h-6"/>
        ) : error ? (
          <DialogDescription className="text-sm">Error: {error}</DialogDescription>
        ) : (
          article && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-muted-foreground">{article.source}</h2>
                <h3 className="text-xs font-medium text-muted-foreground">{article.context.split("\n").join(" - ")}</h3>
              </div>
              <MemoizedReactMarkdown
                className="prose-sm xl:prose-base prose-a:text-accent-foreground/50 max-h-96 overflow-y-auto pr-2"
              >
                {article.content}
              </MemoizedReactMarkdown>
              <DialogFooter className="items-center justify-between">
                <div className="w-full text-xs text-muted-foreground italic">
                  {renderArticleDate(article)}
                </div>
                <Button
                  size="sm"
                  onClick={
                    () => window.open(article?.url, '_blank', 'noopener,noreferrer')
                  }>
                  {'Source'}
                </Button>
              </DialogFooter>
            </div>
          )
        )}
      </div>
    </DialogContent>
  )
}
