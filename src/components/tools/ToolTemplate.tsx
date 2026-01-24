import { useState, useCallback, ReactNode, useEffect } from "react"
import { motion } from "framer-motion"
import { CopyButton } from "@/components/features/CopyButton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Loader2, Trash2, ArrowRight } from "lucide-react"

import { useHistoryStore } from "@/store/useHistoryStore"
import { useLocation } from "react-router-dom"
import { TOOLS } from "@/lib/constants/tools"
import { SEO } from "@/components/features/SEO"

interface ToolTemplateProps {
  toolName: string
  description: string
  placeholder?: string
  initialInput?: string
  onProcess: (input: string) => Promise<string> | string
  examples?: string[]
  controls?: ReactNode
  renderOutput?: (output: string) => ReactNode
  actionLabel?: string
}

export function ToolTemplate({
  toolName,
  description,
  placeholder = "Enter text here...",
  initialInput = "",
  onProcess,
  examples = [],
  controls,
  renderOutput,
  actionLabel = "Process"
}: ToolTemplateProps) {
  const [input, setInput] = useState(initialInput)
  const [output, setOutput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // History integration
  const location = useLocation()
  const { addToHistory } = useHistoryStore()

  useEffect(() => {
    // Find tool ID from path to add to history
    const currentTool = TOOLS.find(t => t.path === location.pathname)
    if (currentTool) {
      addToHistory(currentTool.id)
    }
  }, [location.pathname, addToHistory])

  const handleProcess = useCallback(async () => {
    if (!input.trim()) return

    setIsLoading(true)
    setError(null)
    try {
      const result = await onProcess(input)
      setOutput(result)
      toast({
        title: "Processed successfully",
        description: "Your input has been processed.",
      })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "An error occurred during processing")
      toast({
        title: "Processing Failed",
        description: "Please check your input and try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }, [input, onProcess, toast])

  const handleClear = () => {
    setInput("")
    setOutput("")
    setError(null)
  }

  return (
    <div className="space-y-6">
      <SEO title={toolName} description={description} />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{toolName}</h1>
        <p className="text-muted-foreground text-lg">{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Input</CardTitle>
            <CardDescription>Enter the data you want to process</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <Textarea
              placeholder={placeholder}
              className="min-h-[300px] font-mono text-sm resize-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            {controls && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                {controls}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={handleProcess} disabled={isLoading || !input.trim()} className="flex-1">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {actionLabel}
              </Button>
              <Button variant="outline" size="icon" onClick={handleClear} disabled={!input && !output}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Output Section */}
        {/* Output Section */}
        <Card className="h-full flex flex-col bg-muted/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Output</CardTitle>
                <CardDescription>Results will appear here</CardDescription>
              </div>
              {output && <CopyButton text={output} />}
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {error ? (
              <div className="h-full flex items-center justify-center text-destructive p-4 text-center bg-destructive/10 rounded-lg border border-destructive/20">
                <p>{error}</p>
              </div>
            ) : output ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative h-full"
              >
                {renderOutput ? renderOutput(output) : (
                  <pre className="h-full min-h-[300px] p-4 rounded-lg bg-background border overflow-auto text-sm font-mono whitespace-pre-wrap break-all">
                    {output}
                  </pre>
                )}
              </motion.div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                <ArrowRight className="h-8 w-8 mb-2 opacity-50" />
                <p>Process input to see results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {
        examples.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Examples</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {examples.map((example, i) => (
                <Card key={i} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setInput(example)}>
                  <CardContent className="p-4">
                    <pre className="text-xs text-muted-foreground truncate font-mono">{example}</pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      }
    </div >
  )
}
