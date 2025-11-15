import { NextResponse } from "next/server";

type SimplifyJobPayload = {
  jobTitle?: string;
  jobDescription: string;
  audienceProfile?: {
    interests?: string[];
    disabilities?: string[];
    medicalConditions?: string[];
    preferredHours?: string;
    location?: string;
  };
};

type SimplifiedJobResponse = {
  jobTitle: string;
  simplifiedDescription: string;
  keyQualifications: string[];
  accommodations: string[];
  trainingSuggestions: string[];
  tone: string;
  provider: "gemini" | "fallback";
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  process.env.GEMINI_API_URL ??
  "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_SIMPLIFY_MODEL =
  process.env.GEMINI_SIMPLIFY_MODEL ?? "models/gemini-1.5-flash";

const FALLBACK_SIMPLIFIED_JOB: SimplifiedJobResponse = {
  jobTitle: "Community Support Assistant",
  simplifiedDescription:
    "Help a neighborhood non-profit greet visitors, keep things tidy, and guide people to the right staff. The role is seated most of the day and allows short stretch breaks whenever you need them.",
  keyQualifications: [
    "Friendly, patient communication style",
    "Comfort using a tablet checklist (training provided)",
    "Reliable attendance for a 4-hour weekday shift",
  ],
  accommodations: [
    "Adjustable chair with lumbar support",
    "Frequent micro-breaks to manage pain or fatigue",
    "Clear written instructions for every shift task",
  ],
  trainingSuggestions: [
    "Watch a 15-minute video on welcoming clients with trauma-informed language",
    "Practice basic tablet navigation using the provided tutorial mode",
    "Shadow another assistant for the first two shifts",
  ],
  tone: "encouraging",
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

function buildPrompt(payload: SimplifyJobPayload) {
  const { jobTitle, jobDescription, audienceProfile } = payload;
  const profileLines = [
    audienceProfile?.location
      ? `Location preference: ${audienceProfile.location}`
      : null,
    audienceProfile?.preferredHours
      ? `Preferred schedule: ${audienceProfile.preferredHours}`
      : null,
    sanitizeArray(audienceProfile?.interests).length
      ? `Interests: ${sanitizeArray(audienceProfile?.interests).join(", ")}`
      : null,
    sanitizeArray(audienceProfile?.disabilities).length
      ? `Disabilities: ${sanitizeArray(audienceProfile?.disabilities).join(
          ", "
        )}`
      : null,
    sanitizeArray(audienceProfile?.medicalConditions).length
      ? `Medical considerations: ${sanitizeArray(
          audienceProfile?.medicalConditions
        ).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `
You are an employment counselor who converts complex job postings into plain-language summaries for people experiencing homelessness, disabilities, or medical conditions.

Job Title: ${jobTitle ?? "Unknown"}
Original Description:
${jobDescription}

Audience Profile:
${profileLines || "Not provided"}

Respond ONLY with valid JSON in the following structure:
{
  "jobTitle": "string",
  "simplifiedDescription": "string (3-4 short paragraphs max)",
  "keyQualifications": ["string"],
  "accommodations": ["string"],
  "trainingSuggestions": ["string"],
  "tone": "encouraging|neutral|direct"
}

Avoid duplicate bullet points, keep the reading level friendly, and highlight flexibility, accessibility, and realistic expectations.
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
    return JSON.parse(content) as Omit<SimplifiedJobResponse, "provider">;
  } catch {
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) {
      return null;
    }
    const sliced = content.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(sliced) as Omit<SimplifiedJobResponse, "provider">;
    } catch {
      return null;
    }
  }
}

export async function POST(request: Request) {
  let payload: SimplifyJobPayload | null = null;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!payload?.jobDescription || typeof payload.jobDescription !== "string") {
    return NextResponse.json(
      { error: "jobDescription is required." },
      { status: 400 }
    );
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json(FALLBACK_SIMPLIFIED_JOB, { status: 200 });
  }

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/${GEMINI_SIMPLIFY_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini error:", response.status, errorText);
      throw new Error("Gemini request failed");
    }

    const data = await response.json();
    const content = extractGeminiText(data);
    const parsed = parseModelResponse(content);

    if (!parsed) {
      throw new Error("The Gemini response could not be parsed as JSON.");
    }

    const typedResponse: SimplifiedJobResponse = {
      jobTitle: parsed.jobTitle ?? payload.jobTitle ?? "Job Opportunity",
      simplifiedDescription: parsed.simplifiedDescription ?? "",
      keyQualifications: parsed.keyQualifications ?? [],
      accommodations: parsed.accommodations ?? [],
      trainingSuggestions: parsed.trainingSuggestions ?? [],
      tone: parsed.tone ?? "encouraging",
      provider: "gemini",
    };

    return NextResponse.json(typedResponse, { status: 200 });
  } catch (error) {
    console.error("Simplify job route error:", error);
    return NextResponse.json(FALLBACK_SIMPLIFIED_JOB, { status: 200 });
  }
}