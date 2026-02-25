import { ToolTemplate } from "@/components/tools/ToolTemplate";
import {
  composeIncidentTimeline,
  type TimelineCompositionResult,
} from "@/lib/utils/event-timeline";

export default function EventTimelineTool() {
  const process = (input: string) => JSON.stringify(composeIncidentTimeline(input));

  const renderOutput = (output: string) => {
    let parsed: TimelineCompositionResult;
    try {
      parsed = JSON.parse(output) as TimelineCompositionResult;
    } catch {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Events</div>
            <div className="text-xl font-semibold">{parsed.summary.total}</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Duration</div>
            <div className="text-xl font-semibold">{parsed.summary.durationMinutes}m</div>
          </div>
          <div className="p-3 border rounded bg-muted/20">
            <div className="text-xs uppercase text-muted-foreground">Gaps</div>
            <div className="text-xl font-semibold">{parsed.gaps.length}</div>
          </div>
        </div>

        <div className="space-y-2">
          {parsed.events.map((event) => (
            <div key={`${event.timestamp}:${event.summary}`} className="p-3 border rounded bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{event.summary}</div>
                <div className="text-xs">{event.severity}</div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {event.timestamp} | {event.source} | +{event.offsetMinutes}m
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ToolTemplate
      toolName="Event Timeline Composer"
      description="Normalize incident events into a chronological timeline with gap analysis for triage and post-incident reporting."
      actionLabel="Compose Timeline"
      placeholder={'{"timestamp":"2026-02-25T12:00:00Z","source":"EDR","summary":"Initial detection","severity":"high"}'}
      onProcess={process}
      renderOutput={renderOutput}
      examples={[
        '{"timestamp":"2026-02-25T12:00:00Z","source":"EDR","summary":"Initial detection","severity":"high"}\n{"timestamp":"2026-02-25T12:43:00Z","source":"SIEM","summary":"Credential abuse follow-on","severity":"critical"}',
      ]}
    />
  );
}
