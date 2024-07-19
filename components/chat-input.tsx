"use client";
import Textarea from 'react-textarea-autosize'
import {ChangeEvent, FormEvent, useRef} from "react";
import {Button} from "@/components/ui/button";
import {ArrowRight} from "lucide-react";
import {StopButton} from "@/components/ui/stop-button";

interface ChatInputProps {
  input: string
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  isGenerating: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStopClicked: () => void;
}

export function ChatInput({input, onChange, isGenerating, onSubmit, onStopClicked}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <form onSubmit={onSubmit} className="max-w-2xl w-full px-6">
      <div className="relative flex items-center w-full">
        <Textarea
          ref={inputRef}
          name="input"
          rows={1}
          maxRows={5}
          tabIndex={0}
          placeholder="Écrivez votre message..."
          spellCheck={false}
          value={input}
          className="resize-none w-full min-h-12 rounded-fill bg-muted border border-input pl-4 pr-10 pt-3 pb-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'"
          onChange={onChange}
          onKeyDown={e => {
            // Enter should submit the form
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              // Prevent the default action to avoid adding a new line
              if (input.trim().length === 0) {
                e.preventDefault()
                return
              }
              e.preventDefault()
              const textarea = e.target as HTMLTextAreaElement
              textarea.form?.requestSubmit()
            }
          }}
          onHeightChange={height => {
            // Ensure inputRef.current is defined
            if (!inputRef.current) return

            // The initial height and left padding is 70px and 2rem
            const initialHeight = 70
            // The initial border radius is 32px
            const initialBorder = 32
            // The height is incremented by multiples of 20px
            const multiple = (height - initialHeight) / 20

            // Decrease the border radius by 4px for each 20px height increase
            const newBorder = initialBorder - 4 * multiple
            // The lowest border radius will be 8px
            inputRef.current.style.borderRadius =
              Math.max(8, newBorder) + 'px'
          }}
        />
        {isGenerating ? (
          <StopButton
            onStopClicked={onStopClicked}
            className="absolute right-2 top-1/2 transform -translate-y-1/2"
          />
        ) : (
          <Button
            type="submit"
            size={'icon'}
            variant={'ghost'}
            className="absolute right-2 top-1/2 transform -translate-y-1/2"
            disabled={input.length === 0 || isGenerating}
          >
            <ArrowRight size={20}/>
          </Button>
        )}
      </div>
      {input.length > 0 && (
        <div className="flex w-full flex-wrap relative">
          <span className="absolute top-2 right-2 text-xs text-gray-500"><strong>Shift + Return</strong> to add a new line</span>
        </div>
      )}
    </form>
  );
}
