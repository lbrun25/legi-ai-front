import React from 'react';
import {DialogContent, DialogTitle} from "@/components/ui/dialog";
import {MemoizedReactMarkdown} from "@/components/ui/markdown";
import {MatchedCollectiveAgreementDocument} from "@/lib/supabase/agreements";

interface ConventionArticlesDialogContentProps {
  articles: MatchedCollectiveAgreementDocument[];
}

export function ConventionArticlesDialogContent({articles}: ConventionArticlesDialogContentProps) {
  return (
    <DialogContent>
      <div>
        <DialogTitle className="text-2xl font-bold">{`Articles de la convention collective`}</DialogTitle>
        <div className="space-y-4">
          <MemoizedReactMarkdown
            className="prose-sm xl:prose-base prose-ul:list-disc prose-ol:list-decimal prose-li:ml-6 prose-a:text-accent-foreground/50 max-h-96 overflow-y-auto pr-2"
          >
            {articles.map(article => article.content).join("\n\n")}
          </MemoizedReactMarkdown>
        </div>
      </div>
    </DialogContent>
  );
}
