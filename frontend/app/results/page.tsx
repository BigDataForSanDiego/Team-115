"use client";

import { useEffect, useMemo, useState } from "react";

type EncodedFormData = {
  name?: string;
  gender?: string;
  homeless?: string;
  race?: string | string[];
  interest?: string;
  disabilities?: string;
  "medical-conditions"?: string;
  location?: string;
};

type AudienceProfile = {
  name?: string;
  gender?: string;
  homeless?: string;
  race?: string[];
  interests?: string[];
  disabilities?: string[];
  medicalConditions?: string[];
  location?: string;
};

type SimplifiedJob = {
  jobTitle: string;
  simplifiedDescription: string;
  keyQualifications: string[];
  accommodations: string[];
  trainingSuggestions: string[];
  tone: string;
  provider: string;
};

type TrainingPlan = {
  summary: string;
  phases: {
    title: string;
    duration: string;
    focus: string;
    steps: string[];
    resources: { title: string; url: string; cost?: string }[];
  }[];
  successMetrics: string[];
  encouragement: string;
  provider: string;
};

const SAMPLE_JOBS = [
  {
    id: "community-support",
    title: "Community Support Assistant",
    employer: "Safe Harbor Resource Center",
    description:
      "Assist visitors at the front desk, keep the lobby tidy, answer simple questions, and route clients to the correct case manager using a tablet sign-in system. Role is seated most of the shift with opportunities for short breaks.",
    pay: "$18/hr · 20 hrs/week",
    location: "Downtown San Diego",
  },
  {
    id: "shelter-coordinator",
    title: "Evening Shelter Coordinator",
    employer: "Harbor Nights Shelter",
    description:
      "Welcome guests, distribute linens, log maintenance requests, and communicate shift updates using a radio. Light lifting (under 15 lbs) and short standing periods.",
    pay: "$19/hr · 25 hrs/week",
    location: "Chula Vista",
  },
  {
    id: "urban-gardener",
    title: "Urban Garden Steward",
    employer: "Fresh Start Plots",
    description:
      "Maintain raised garden beds, water plants, harvest produce, and log observations. Tasks can be paced slowly with adaptive tools available.",
    pay: "$17/hr · 15 hrs/week",
    location: "City Heights",
  },
];

function safeParseArray(value?: string | string[]) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  try {
    const parsed = JSON.parse(value);
    return safeParseArray(parsed);
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function decodeBase64(value: string) {
  if (typeof window !== "undefined" && typeof window.atob === "function") {
    return window.atob(value);
  }

  const nodeBuffer = typeof globalThis !== "undefined" ? (globalThis as any).Buffer : null;
  if (nodeBuffer?.from) {
    return nodeBuffer.from(value, "base64").toString("utf-8");
  }

  throw new Error("No base64 decoder available in this environment.");
}

function decodeUserProfile(searchParams: Record<string, string>) {
  const encoded = searchParams?.data;
  if (!encoded) return null;

  try {
    const decodedString = decodeBase64(encoded);
    const parsed: EncodedFormData = JSON.parse(decodedString);
    return {
      name: parsed.name,
      gender: parsed.gender,
      homeless: parsed.homeless,
      race: safeParseArray(parsed.race),
      interests: safeParseArray(parsed.interest),
      disabilities: safeParseArray(parsed.disabilities),
      medicalConditions: safeParseArray(parsed["medical-conditions"]),
      location: parsed.location,
    } satisfies AudienceProfile;
  } catch (error) {
    console.error("Failed to decode profile:", error);
    return null;
  }
}

export default function ResultsPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string>;
}) {
  const profile = useMemo(() => decodeUserProfile(searchParams), [searchParams]);
  const [simplifiedDescriptions, setSimplifiedDescriptions] = useState<
    Record<string, SimplifiedJob>
  >({});
  const [trainingPlans, setTrainingPlans] = useState<Record<string, TrainingPlan>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const activeProfile: AudienceProfile = profile;

    let isMounted = true;
    async function fetchAll() {
      setIsLoading(true);
      setError(null);

      try {
        await Promise.all(
          SAMPLE_JOBS.map(async (job) => {
            const [simplified, training] = await Promise.all([
              fetch("/api/simplify-job", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jobTitle: job.title,
                  jobDescription: job.description,
                  audienceProfile: {
                    interests: activeProfile.interests,
                    disabilities: activeProfile.disabilities,
                    medicalConditions: activeProfile.medicalConditions,
                    location: activeProfile.location,
                  },
                }),
              }).then((res) => {
                if (!res.ok) {
                  throw new Error("Failed to simplify job posting");
                }
                return res.json();
              }),
              fetch("/api/training-plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jobTitle: job.title,
                  currentSkills: activeProfile.interests,
                  interests: activeProfile.interests,
                  disabilities: activeProfile.disabilities,
                  medicalConditions: activeProfile.medicalConditions,
                  location: activeProfile.location,
                  learningPreferences: "Short, low-bandwidth lessons",
                  timeAvailablePerWeek: "5 hours",
                }),
              }).then((res) => {
                if (!res.ok) {
                  throw new Error("Failed to generate training plan");
                }
                return res.json();
              }),
            ]);

            if (!isMounted) return;
            setSimplifiedDescriptions((prev) => ({
              ...prev,
              [job.id]: simplified,
            }));
            setTrainingPlans((prev) => ({
              ...prev,
              [job.id]: training,
            }));
          })
        );
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while generating results."
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchAll();

    return () => {
      isMounted = false;
    };
  }, [profile]);

  return (
    <div className="min-h-screen p-10 bg-gradient-to-br from-sky-50 to-indigo-50">
      <h1 className="text-4xl font-bold text-indigo-700">Your Job Matches</h1>
      <p className="text-gray-600 mb-6">
        We personalized these opportunities using the information you shared.
      </p>

      {!profile && (
        <div className="p-6 mb-6 rounded-2xl border border-amber-200 bg-white shadow">
          <p className="text-gray-700">
            We couldn’t read your profile data. Please return to the application
            form and submit it again.
          </p>
        </div>
      )}

      {error && (
        <div className="p-6 mb-6 rounded-2xl border border-rose-200 bg-white shadow">
          <p className="text-rose-700 font-semibold">Heads up</p>
          <p className="text-gray-700">{error}</p>
        </div>
      )}

      <div className="space-y-10">
        {SAMPLE_JOBS.map((job) => {
          const simplified = simplifiedDescriptions[job.id];
          const training = trainingPlans[job.id];
          return (
            <div
              key={job.id}
              className="p-8 bg-white/90 rounded-2xl shadow-xl border border-indigo-100"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-3xl font-semibold text-indigo-700">
                    {job.title}
                  </h2>
                  <p className="text-gray-500">
                    {job.employer} · {job.location}
                  </p>
                </div>
                <span className="text-lg font-semibold text-amber-600">
                  {job.pay}
                </span>
              </div>

              <h3 className="mt-6 text-xl font-bold text-amber-600">
                Simplified Description
              </h3>
              <p className="whitespace-pre-wrap text-gray-700">
                {simplified
                  ? simplified.simplifiedDescription
                  : isLoading
                  ? "Generating an easy-to-read summary..."
                  : job.description}
              </p>

              {simplified?.keyQualifications?.length ? (
                <>
                  <h3 className="mt-6 text-xl font-bold text-amber-600">
                    Key Qualifications
                  </h3>
                  <ul className="list-disc pl-6 text-gray-700 space-y-1">
                    {simplified.keyQualifications.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              ) : null}

              <h3 className="mt-6 text-xl font-bold text-amber-600">
                Accessibility Accommodations
              </h3>
              <ul className="list-disc pl-6 text-gray-700 space-y-1">
                {simplified?.accommodations?.length
                  ? simplified.accommodations.map((item) => (
                      <li key={item}>{item}</li>
                    ))
                  : ["Loading accommodations tailored to your needs..."]}
              </ul>

              <h3 className="mt-6 text-xl font-bold text-amber-600">
                Personalized Training Plan
              </h3>
              {training ? (
                <div className="space-y-4 text-gray-700">
                  <p>{training.summary}</p>
                  <div className="space-y-4">
                    {training.phases.map((phase) => (
                      <div
                        key={phase.title}
                        className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <p className="font-semibold text-indigo-700">
                            {phase.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {phase.duration}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {phase.focus}
                        </p>
                        <ul className="list-disc pl-6 mt-2 space-y-1 text-sm">
                          {phase.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ul>
                        {phase.resources.length > 0 && (
                          <div className="mt-3 space-y-1 text-sm">
                            {phase.resources.map((resource) => (
                              <a
                                key={resource.title}
                                href={resource.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-amber-600 hover:text-amber-700 underline"
                              >
                                {resource.title}
                                {resource.cost ? ` · ${resource.cost}` : ""}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                    <p className="text-emerald-800 font-semibold">
                      Encouragement
                    </p>
                    <p>{training.encouragement}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">
                  {isLoading
                    ? "Creating a phased training roadmap just for you..."
                    : "Training plan unavailable. Try refreshing the page."}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}