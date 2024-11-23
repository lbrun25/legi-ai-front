"use client";
import {useAssistant} from "@/lib/hooks/use-assistant";
import {useEffect, useState} from "react";
import {Skeleton} from "@/components/ui/skeleton";
import {Textarea} from "@/components/ui/textarea";
import * as React from "react";
import * as Collapsible from '@radix-ui/react-collapsible';
import {Button} from "@/components/ui/button";
import {AssistantTool} from "openai/resources/beta/assistants";
import {Input} from "@/components/ui/input";
import {FunctionTool} from "openai/resources/beta/assistants";
import OpenAI from "openai";
import Select from 'react-select'
import {useAppState} from "@/lib/context/app-state";

export default function Page() {
  const {assistant, loading, updateAssistant, updatingAssistant} = useAssistant()
  const [instructions, setInstructions] = useState<string>()
  const [model, setModel] = useState<string>()
  const [name, setName] = useState<string>()
  const [description, setDescription] = useState<string>()
  const [tools, setTools] = useState<Array<AssistantTool>>([])
  const [temperature, setTemperature] = useState<string>()
  const [topP, setTopP] = useState<string>()
  const {chunkingMode, setChunkingMode} = useAppState();

  function findFunctionByName(arr: AssistantTool[] | undefined, functionName: string): FunctionTool | undefined {
    return arr?.find(item => item.type === "function" && item.function?.name === functionName) as FunctionTool;
  }

  useEffect(() => {
    setInstructions(assistant?.instructions || "")
    setName(assistant?.name || "")
    setModel(assistant?.model || "")
    setDescription(assistant?.description || "")
    setTools(assistant?.tools || [])
    setTemperature(String(assistant?.temperature) || "1")
    setTopP(String(assistant?.top_p) || "1")
  }, [assistant]);

  const onSubmitClicked = async () => {
    const params: OpenAI.Beta.Assistants.AssistantUpdateParams = {}
    if (instructions) params.instructions = instructions;
    if (name) params.name = name;
    if (model) params.model = model;
    if (description) params.description = description;
    if (temperature) params.temperature = Number(temperature);
    if (topP) params.top_p = Number(topP);
    await updateAssistant(params);
  }

  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col w-full max-w-prose py-24 mx-auto space-y-6">
      <h1 className="text-2xl font-bold">{"Admin Settings"}</h1>
      {loading && (
        <Skeleton className="h-6 w-48"/>
      )}
      {!loading && (
        <div className="space-y-8">
          <div className="space-y-3">
            <h2>Chunking mode</h2>
            <Select
              options={[
                {value: 'semantic', label: 'Semantic'},
                {value: 'character', label: 'Recursive Character'},
              ]}
              value={{
                value: chunkingMode,
                label: chunkingMode === 'semantic' ? 'Semantic' : 'Recursive Character',
              }}
              onChange={(selectedOption) => {
                if (selectedOption)
                  setChunkingMode(selectedOption.value)
              }}
            />
          </div>
          <div className="space-y-3">
            <h2>Assistant response</h2>
            <Collapsible.Root open={open} onOpenChange={setOpen}>
              <Collapsible.Trigger asChild>
                <Button
                  variant={'default'}
                >
                  {!open ? 'Show Response' : 'Hide Response'}
                </Button>
              </Collapsible.Trigger>
              <Collapsible.Content>
                <pre>
                  <code>
                    {JSON.stringify(assistant, null, 2)}
                  </code>
                </pre>
              </Collapsible.Content>
            </Collapsible.Root>
          </div>
          <div className="space-y-3">
            <h2>{"Edit Analysis Instructions"}</h2>
            <Textarea
              name="input"
              rows={5}
              tabIndex={0}
              placeholder="Set analysis instructions..."
              value={instructions}
              className="resize-none w-full min-h-96 h-[500px] rounded-fill bg-muted border border-input pl-4 pr-10 pt-3 pb-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'"
              onChange={e => setInstructions(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <h2>{"Edit name"}</h2>
            <Input
              type="text"
              name="input"
              placeholder="Set name..."
              value={name}
              className="pr-14 h-12"
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <h2>{"Edit description"}</h2>
            <Textarea
              name="input"
              rows={5}
              tabIndex={0}
              placeholder="Set description..."
              value={description}
              className="resize-none w-full min-h-12 rounded-fill bg-muted border border-input pl-4 pr-10 pt-3 pb-1 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'"
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <h2>{"Edit model"}</h2>
            <Input
              type="text"
              name="input"
              placeholder="Set model..."
              value={model}
              className="pr-14 h-12"
              onChange={e => setModel(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <h2>{"Edit temperature"}</h2>
            <Input
              type="text"
              name="input"
              placeholder="Set temperature..."
              value={temperature}
              className="pr-14 h-12"
              onChange={e => setTemperature(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <h2>{"Edit top_p"}</h2>
            <Input
              type="text"
              name="input"
              placeholder="Set top_p..."
              value={topP}
              className="pr-14 h-12"
              onChange={e => setTopP(e.target.value)}
            />
          </div>
          <Button onClick={onSubmitClicked} disabled={updatingAssistant} size="sm">
            {'Update'}
          </Button>
        </div>
      )}
    </div>
  )
}
