import {NextRequest, NextResponse} from "next/server";
import {getThread, updateTimeSavedForThread} from "@/lib/supabase/threads";
import {ToolName} from "@/lib/types/functionTool";
import {z} from "zod";

const getDurationForTool = (toolName: ToolName) => {
  if (toolName === "getArticleByNumber")
    return 900; // 15 minutes
  if (toolName === "getMatchedArticles")
    return 900; // 15 minutes
  if (toolName === "getMatchedDecisions")
    return 900; // 15 minutes
  if (toolName === "getMatchedDoctrines")
    return 900; // 15 minutes
  return 0;
}

const routeContextSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
})

export async function POST(req: NextRequest, context: z.infer<typeof routeContextSchema>) {
  const input: {
    toolsCalled: ToolName[];
  } = await req.json();
  const {params} = routeContextSchema.parse(context);
  const threadId = params.id;

  let timeSaved = 0;
  for (const toolName of input.toolsCalled) {
    timeSaved += getDurationForTool(toolName);
  }
  const existingThread = await getThread(threadId);
  if (existingThread) {
    timeSaved += existingThread.time_saved ?? 0;
    try {
      await updateTimeSavedForThread(threadId, timeSaved);
    } catch (error) {
      console.error("cannot update time saved:", error);
      return NextResponse.json(error, { status: 500 });
    }
  }
  return NextResponse.json({ message: 'Time saved updated', timeSaved });
}
