import { NextResponse } from "next/server";

type TrainingPlanPayload = {
  jobTitle?: string;
  currentSkills?: string[];
  interests?: string[];
  disabilities?: string[];
  medicalConditions?: string[];
  learningPreferences?: string;
  timeAvailablePerWeek?: string;
  location?: string;
};

type TrainingPhase = {
  title: string;
  duration: string;
  focus: string;
  steps: string[];
  resources: { title: string; url: string; cost?: string }[];
};

type TrainingPlanResponse = {
  summary: string;
  phases: TrainingPhase[];
  successMetrics: string[];
  encouragement: string;
  provider: "gemini" | "fallback";
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  process.env.GEMINI_API_URL ??
  "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_TRAINING_MODEL =
  process.env.GEMINI_TRAINING_MODEL ?? "models/gemini-1.5-flash";

const FALLBACK_PLAN: TrainingPlanResponse = {
  summary:
    "Focus on light-duty roles such as front desk support or retail greeter. Build confidence with people-facing tasks and refresh essential digital skills at a relaxed pace.",
  phases: [
    {
      title: "Foundation & Confidence",
      duration: "Week 1-2",
      focus: "Rebuild routine, refresh customer service basics, and set attainable goals.",
      steps: [
        "Spend 20 minutes per day on breathing or stretching to reduce stress.",
        "Complete a short online module on customer empathy and clear communication.",
        "Practice a friendly greeting script with a friend or mentor twice a week.",
      ],
      resources: [
        {
          title: "Coursera: Customer Service Fundamentals (audit option)",
          url: "https://www.coursera.org/learn/customer-service-fundamentals",
          cost: "Free audit",
        },
        {
          title: "YouTube: 10-Minute Chair Stretches",
          url: "https://www.youtube.com/results?search_query=chair+stretches",
        },
      ],
    },
    {
      title: "Job-Specific Skills",
      duration: "Week 3-4",
      focus: "Practice scheduling, note taking, and simple digital check-ins.",
      steps: [
        "Use Google Calendar to plan two mock shifts each week.",
        "Shadow a volunteer coordinator or watch recordings of front desk workflows.",
        "Complete a short typing or data-entry drill every other day (10 minutes).",
      ],
      resources: [
        {
          title: "GCF LearnFree: Google Workspace Basics",
          url: "https://edu.gcfglobal.org/en/subjects/google/",
        },
        {
          title: "Keybr: Gentle typing practice",
          url: "https://www.keybr.com/",
        },
      ],
    },
    {
      title: "Interview & Placement",
      duration: "Week 5",
      focus: "Prepare simple talking points, practice disclosing accommodations, and line up opportunities.",
      steps: [
        "Write a 2-minute story highlighting reliability and empathy.",
        "Role-play an interview with a coach focusing on accessibility needs.",
        "Apply to two community-based roles that match your preferred schedule.",
      ],
      resources: [
        {
          title: "Workability I: Interview prep workbook",
          url: "https://www.dor.ca.gov/Home/Workability",
        },
      ],
    },
  ],
  successMetrics: [
    "Able to greet visitors confidently without relying on a script",
    "Completes mock check-in tasks in under 5 minutes",
    "Identifies at least two accommodations to request during onboarding",
  ],
  encouragement:
    "Progress is steady and flexible—celebrate each small win and rest when needed. You're building skills employers value every day.",
  provider: "fallback",
};

function sanitizeArray(value?: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return sanitizeArray(parsed);
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function buildPrompt(payload: TrainingPlanPayload) {
  const sections = [
    payload.jobTitle ? `Job target: ${payload.jobTitle}` : null,
    sanitizeArray(payload.currentSkills).length
      ? `Current skills: ${sanitizeArray(payload.currentSkills).join(", ")}`
      : null,
    sanitizeArray(payload.interests).length
      ? `Interests: ${sanitizeArray(payload.interests).join(", ")}`
      : null,
    sanitizeArray(payload.disabilities).length
      ? `Disabilities or injuries: ${sanitizeArray(payload.disabilities).join(
          ", "
        )}`
      : null,
    sanitizeArray(payload.medicalConditions).length
      ? `Medical considerations: ${sanitizeArray(
          payload.medicalConditions
        ).join(", ")}`
      : null,
    payload.learningPreferences
      ? `Learning preferences: ${payload.learningPreferences}`
      : null,
    payload.timeAvailablePerWeek
      ? `Time available per week: ${payload.timeAvailablePerWeek}`
      : null,
    payload.location ? `Location: ${payload.location}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `
You are a workforce coach. Create a short, encouraging skills plan for someone preparing for employment with potential disabilities or medical needs.

Candidate context:
${sections || "Not provided"}

Return ONLY valid JSON with this schema:
{
  "summary": "string (2-3 sentences)",
  "phases": [
    {
      "title": "string",
      "duration": "string",
      "focus": "string",
      "steps": ["string"],
      "resources": [
        {"title": "string", "url": "https://...", "cost": "optional string"}
      ]
    }
  ],
  "successMetrics": ["string"],
  "encouragement": "string (1-2 sentences)"
}

Keep each step realistic for someone balancing housing or health challenges. Recommend mostly free US-based resources. Avoid markdown.
`.trim();
}

function extractGeminiText(data: unknown): string | null {
  try {
    const candidates =
      (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
        ?.candidates || [];
    for (const candidate of candidates) {
      const text = candidate?.content?.parts
        ?.map((part) => part?.text ?? "")
        .join("\n")
        .trim();
      if (text) {
        return text;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function parseModelResponse(content: string | null | undefined) {
  if (!content) return null;
  try {
    return JSON.parse(content) as Omit<TrainingPlanResponse, "provider">;
  } catch {
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) {
      return null;
    }
    const slice = content.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice) as Omit<TrainingPlanResponse, "provider">;
    } catch {
      return null;
    }
  }
}

export async function POST(request: Request) {
  let payload: TrainingPlanPayload | null = null;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!payload?.jobTitle && !payload?.currentSkills) {
    return NextResponse.json(
      { error: "Provide at least jobTitle or currentSkills." },
      { status: 400 }
    );
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json(FALLBACK_PLAN, { status: 200 });
  }

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/${GEMINI_TRAINING_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: buildPrompt(payload) }],
            },
          ],
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Gemini training plan error:", response.status, text);
      throw new Error("Gemini request failed");
    }

    const data = await response.json();
    const content = extractGeminiText(data);
    const parsed = parseModelResponse(content);

    if (!parsed) {
      throw new Error("Could not parse model output.");
    }

    const typedResponse: TrainingPlanResponse = {
      summary: parsed.summary ?? FALLBACK_PLAN.summary,
      phases: parsed.phases?.length ? parsed.phases : FALLBACK_PLAN.phases,
      successMetrics:
        parsed.successMetrics?.length === 0
          ? FALLBACK_PLAN.successMetrics
          : parsed.successMetrics ?? FALLBACK_PLAN.successMetrics,
      encouragement: parsed.encouragement ?? FALLBACK_PLAN.encouragement,
      provider: "gemini",
    };

    return NextResponse.json(typedResponse, { status: 200 });
  } catch (error) {
    console.error("Training plan route error:", error);
    return NextResponse.json(FALLBACK_PLAN, { status: 200 });
  }
}