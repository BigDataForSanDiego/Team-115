"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

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

type JobListing = {
  id: string;
  title: string;
  employer: string;
  description: string;
  pay: string;
  location: string;
};

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
  if (!encoded) {
    console.error("No data parameter found in URL");
    return null;
  }

  try {
    // URL decode first, then base64 decode
    const urlDecoded = decodeURIComponent(encoded);
    const decodedString = decodeBase64(urlDecoded);
    const parsed: EncodedFormData = JSON.parse(decodedString);
    console.log("Successfully decoded profile:", parsed);
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

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const dataParam = searchParams.get("data") || "";
  
  const profile = useMemo(() => {
    if (!dataParam) return null;
    return decodeUserProfile({ data: dataParam });
  }, [dataParam]);
  const [jobs, setJobs] = useState<JobListing[]>([]);
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
        // First, search for jobs based on location
        const jobsResponse = await fetch("/api/search-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: activeProfile.location,
            interests: activeProfile.interests,
            disabilities: activeProfile.disabilities,
            medicalConditions: activeProfile.medicalConditions,
          }),
        });

        const jobsData = await jobsResponse.json();
        
        if (!isMounted) return;

        // Handle API errors
        if (jobsData.error && (!jobsData.jobs || jobsData.jobs.length === 0)) {
          setError(jobsData.error);
          setJobs([]);
          return;
        }

        // Set jobs (could be empty array if no results)
        const foundJobs: JobListing[] = jobsData.jobs || jobsData || [];
        setJobs(foundJobs);
        
        // Show info message if fallback was used
        if (jobsData.fallbackUsed && foundJobs.length > 0) {
          setError(`No jobs found in ${activeProfile.location}. Showing results from nearby cities that match your profile.`);
        } else if (foundJobs.length === 0) {
          setError("No jobs found for this location. Try searching with a different city name.");
        } else {
          setError(null); // Clear any previous errors
        }

        // Then simplify and get training plans for each job
        await Promise.all(
          foundJobs.map(async (job) => {
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
              }).then(async (res) => {
                if (!res.ok) {
                  // Try to get the response body for better error info
                  const errorText = await res.text();
                  console.error("Training plan API error:", res.status, errorText);
                  // Return fallback plan instead of throwing
                  return {
                    summary: "Focus on light-duty roles such as front desk support or retail greeter. Build confidence with people-facing tasks and refresh essential digital skills at a relaxed pace.",
                    phases: [{
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
                      ],
                    }],
                    successMetrics: ["Able to greet visitors confidently"],
                    encouragement: "Progress is steady and flexible—celebrate each small win and rest when needed.",
                    provider: "fallback",
                  };
                }
                return res.json();
              }).catch((err) => {
                console.error("Training plan fetch error:", err);
                // Return fallback plan on network errors
                return {
                  summary: "Focus on light-duty roles such as front desk support or retail greeter. Build confidence with people-facing tasks and refresh essential digital skills at a relaxed pace.",
                  phases: [{
                    title: "Foundation & Confidence",
                    duration: "Week 1-2",
                    focus: "Rebuild routine, refresh customer service basics, and set attainable goals.",
                    steps: [
                      "Spend 20 minutes per day on breathing or stretching to reduce stress.",
                      "Complete a short online module on customer empathy and clear communication.",
                    ],
                    resources: [],
                  }],
                  successMetrics: ["Able to greet visitors confidently"],
                  encouragement: "Progress is steady and flexible—celebrate each small win and rest when needed.",
                  provider: "fallback",
                };
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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 font-sans relative">
      {/* Accent line */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-sky-400"></div>

      <div className="relative z-10 p-10">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-sky-600 mb-2">Your Job Matches</h1>
            <div className="w-16 h-1 bg-sky-400 rounded-full mb-3"></div>
            {profile?.location && (
              <p className="text-base text-gray-700 mb-1">
                Jobs near <span className="font-semibold text-sky-600">{profile.location}</span>
              </p>
            )}
            <p className="text-sm text-gray-600">
              We personalized these opportunities using the information you shared.
            </p>
          </div>

          {!profile && (
            <div className="p-5 mb-6 border border-gray-200 bg-white rounded-lg shadow-sm">
              <p className="text-gray-700 text-sm">
                We couldn't read your profile data. Please return to the application
                form and submit it again.
              </p>
            </div>
          )}

          {error && (
            <div className={`p-4 mb-6 border rounded-lg bg-white shadow-sm ${
              error.includes("nearby cities") || error.includes("major cities")
                ? "border-sky-200"
                : "border-red-200"
            }`}>
              <p className={`font-medium text-sm mb-1 ${
                error.includes("nearby cities") || error.includes("major cities")
                  ? "text-sky-600"
                  : "text-red-700"
              }`}>
                {error.includes("nearby cities") || error.includes("major cities") ? "Info" : "Heads up"}
              </p>
              <p className="text-gray-700 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-8">
            {jobs.length === 0 && isLoading && (
              <div className="p-8 bg-white border border-gray-200 rounded-lg shadow-sm text-center">
                <div className="w-10 h-10 border-2 border-sky-200 border-t-sky-500 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-gray-600 text-sm">Searching for jobs in your area...</p>
              </div>
            )}
            {jobs.length === 0 && !isLoading && (
              <div className="p-8 bg-white border border-gray-200 rounded-lg shadow-sm text-center">
                <p className="text-gray-900 font-semibold mb-2">No jobs found</p>
                <p className="text-gray-600 text-sm">We couldn't find any jobs matching your location. Try searching with a different city name.</p>
              </div>
            )}
          {jobs.map((job) => {
            const simplified = simplifiedDescriptions[job.id];
            const training = trainingPlans[job.id];
            return (
              <div
                key={job.id}
                className="p-8 bg-white border border-gray-200 rounded-xl shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div>
                    <h2 className="text-2xl font-semibold text-sky-600 mb-1">
                      {job.title}
                    </h2>
                    <p className="text-gray-600 text-sm">
                      {job.employer} · {job.location}
                    </p>
                  </div>
                  <span className="text-base font-semibold text-sky-600">
                    {job.pay}
                  </span>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-sky-600 mb-3">
                    Simplified Description
                  </h3>
                  <p className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                    {simplified
                      ? simplified.simplifiedDescription
                      : isLoading
                      ? "Generating an easy-to-read summary..."
                      : job.description}
                  </p>
                </div>

                {simplified?.keyQualifications?.length ? (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-sky-600 mb-3">
                      Key Qualifications
                    </h3>
                    <ul className="list-disc pl-5 text-gray-700 space-y-1.5 text-sm">
                      {simplified.keyQualifications.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-sky-600 mb-3">
                    Accessibility Accommodations
                  </h3>
                  <ul className="list-disc pl-5 text-gray-700 space-y-1.5 text-sm">
                    {simplified?.accommodations?.length
                      ? simplified.accommodations.map((item) => (
                          <li key={item}>{item}</li>
                        ))
                      : ["Loading accommodations tailored to your needs..."]}
                  </ul>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-sky-600 mb-3">
                    Personalized Training Plan
                  </h3>
                  {training ? (
                    <div className="space-y-4 text-gray-700">
                      <p className="text-sm leading-relaxed">{training.summary}</p>
                      <div className="space-y-3">
                        {training.phases.map((phase) => (
                          <div
                            key={phase.title}
                            className="p-4 border border-gray-200 bg-gray-50 rounded-lg"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                              <p className="font-semibold text-sky-600 text-sm">
                                {phase.title}
                              </p>
                              <p className="text-xs text-gray-500">
                                {phase.duration}
                              </p>
                            </div>
                            <p className="text-xs text-gray-600 mb-3">
                              {phase.focus}
                            </p>
                            <ul className="list-disc pl-5 space-y-1 text-xs">
                              {phase.steps.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ul>
                            {phase.resources.length > 0 && (
                              <div className="mt-3 space-y-1.5 text-xs">
                                {phase.resources.map((resource) => (
                                  <a
                                    key={resource.title}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sky-600 hover:text-sky-700 underline block"
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
                      <div className="p-4 border border-sky-200 bg-sky-50 rounded-lg">
                        <p className="text-sky-700 font-semibold text-sm mb-1">
                          Encouragement
                        </p>
                        <p className="text-sm text-gray-700">{training.encouragement}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-gray-600 text-sm">
                        {isLoading
                          ? "Creating a phased training roadmap just for you..."
                          : "Training plan unavailable. Try refreshing the page."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}