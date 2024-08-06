import {useDecision} from "@/lib/hooks/use-decision";
import {Skeleton} from "@/components/ui/skeleton";
import {DialogContent, DialogDescription, DialogFooter} from "@/components/ui/dialog";
import {MemoizedReactMarkdown} from "@/components/ui/markdown";
import {Button} from "@/components/ui/button";

interface DecisionDialogContentProps {
  decisionNumber: string;
}

export const DecisionDialogContent: React.FC<DecisionDialogContentProps> = ({decisionNumber}: DecisionDialogContentProps) => {
  const {decision, loading, error} = useDecision(decisionNumber);

  return (
    <DialogContent>
      <div>
        <h1 className="text-2xl font-bold">{`Decision de justice ${decisionNumber}`}</h1>
        {loading ? (
          <Skeleton className="w-full h-6"/>
        ) : error ? (
          <DialogDescription className="text-sm">Error: {error}</DialogDescription>
        ) : (
          decision && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-muted-foreground">{decision.juridiction}</h2>
              </div>
              <MemoizedReactMarkdown
                className="prose-sm xl:prose-base prose-a:text-accent-foreground/50 max-h-96 overflow-y-auto pr-2">
                {decision.ficheArret}
              </MemoizedReactMarkdown>
              <DialogFooter className="items-center justify-between">
                <div className="w-full text-xs text-muted-foreground italic">
                  {decision.date}
                </div>
                <Button
                  size="sm"
                  onClick={
                    () => window.open(decision?.decisionLink, '_blank', 'noopener,noreferrer')
                  }>
                  {'Source'}
                </Button>
              </DialogFooter>
            </div>
          )
        )}
      </div>
    </DialogContent>
  );
}
