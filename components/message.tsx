'use client'

import {MemoizedReactMarkdown} from './ui/markdown'
import rehypeExternalLinks from 'rehype-external-links'
import remarkGfm from 'remark-gfm'
import rehypeRaw from "rehype-raw";
import type {Element} from 'hast'
import {
  Dialog,
  DialogTrigger
} from "@/components/ui/dialog";
import {ArticleDialogContent} from "@/components/article-dialog-content";
import {DecisionDialogContent} from "@/components/ui/decision-dialog-content";

export interface BotMessageProps {
  content: string;
  isGenerating?: boolean;
}

export function BotMessage({content, isGenerating}: BotMessageProps) {
  const renderArticle = (node: Element | undefined, props: any) => {
    if (!node) return null;
    if (node.children.length === 0 || node.children[0].type !== "text") return null;
    const content = node.children[0].value;
    const articleNumber = content.split(" ")[1]
    if (!articleNumber) return null;
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button>
            <mark className="bg-blue-700 p-0.5 text-white" {...props} />
          </button>
        </DialogTrigger>
        {!isGenerating && (
          <ArticleDialogContent articleNumber={articleNumber}/>
        )}
      </Dialog>
    )
  }

  const renderDecision = (node: Element | undefined, props: any) => {
    if (!node) return null;
    if (node.children.length === 0 || node.children[0].type !== "text") return null;
    const decisionNumber = node.children[0].value;
    if (!decisionNumber) return null;
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button>
            <mark className="bg-blue-700 p-0.5 text-white" {...props} />
          </button>
        </DialogTrigger>
        {!isGenerating && (
          <DecisionDialogContent decisionNumber={decisionNumber}/>
        )}
      </Dialog>
    )
  }

  return (
    <MemoizedReactMarkdown
      rehypePlugins={[[rehypeExternalLinks, {target: '_blank'}], rehypeRaw]}
      remarkPlugins={[remarkGfm]}
      className="prose-sm xl:prose-base prose-neutral prose-a:text-accent-foreground/50"
      components={{
        mark: ({node, ...props}) => renderArticle(node, props),
        cite: ({node, ...props}) => renderDecision(node, props),
      }}
      isGenerating={isGenerating}
    >
      {content}
    </MemoizedReactMarkdown>
  );
}
