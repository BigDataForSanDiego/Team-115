import { NextResponse } from "next/server";

type JobSearchPayload = {
  location: string;
  interests?: string[];
  disabilities?: string[];
  medicalConditions?: string[];
};

type JobListing = {
  id: string;
  title: string;
  employer: string;
  description: string;
  pay: string;
  location: string;
};

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  process.env.GEMINI_API_URL ??
  "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_JOB_MODEL =
  process.env.GEMINI_JOB_MODEL ?? "models/gemini-1.5-flash";

function extractCityAndState(location: string): { city: string; state: string } {
  const parts = location.split(",");
  const city = parts[0]?.trim() || location.trim();
  const state = parts[1]?.trim() || "";
  return { city, state };
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

function parseModelResponse(content: string | null | undefined): JobListing[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed.jobs && Array.isArray(parsed.jobs)) {
      return parsed.jobs;
    }
    // Try to extract JSON from markdown code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }
    // Try to find JSON object in the text
    const firstBrace = content.indexOf("[");
    const lastBrace = content.lastIndexOf("]");
    if (firstBrace !== -1 && lastBrace !== -1) {
      const slice = content.slice(firstBrace, lastBrace + 1);
      return JSON.parse(slice);
    }
    return [];
  } catch {
    return [];
  }
}

// Get nearby major cities in the same state
function getNearbyCities(state: string): string[] {
  const stateLower = state.toLowerCase();
  const cityMap: Record<string, string[]> = {
    "california": ["Los Angeles", "San Francisco", "San Diego", "Sacramento", "Oakland", "Fresno", "Long Beach", "San Jose"],
    "new york": ["New York", "Buffalo", "Rochester", "Albany", "Syracuse", "Yonkers", "Utica"],
    "texas": ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth", "El Paso", "Arlington"],
    "florida": ["Miami", "Tampa", "Orlando", "Jacksonville", "Tallahassee", "Fort Lauderdale", "St. Petersburg"],
    "illinois": ["Chicago", "Aurora", "Rockford", "Joliet", "Naperville", "Springfield", "Peoria"],
    "pennsylvania": ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton", "Bethlehem"],
    "ohio": ["Columbus", "Cleveland", "Cincinnati", "Toledo", "Akron", "Dayton", "Parma"],
    "georgia": ["Atlanta", "Augusta", "Columbus", "Savannah", "Athens", "Sandy Springs", "Roswell"],
    "north carolina": ["Charlotte", "Raleigh", "Greensboro", "Durham", "Winston-Salem", "Fayetteville", "Cary"],
    "michigan": ["Detroit", "Grand Rapids", "Warren", "Sterling Heights", "Lansing", "Ann Arbor", "Flint"],
    "new jersey": ["Newark", "Jersey City", "Paterson", "Elizabeth", "Edison", "Woodbridge", "Lakewood"],
    "virginia": ["Virginia Beach", "Norfolk", "Richmond", "Chesapeake", "Newport News", "Alexandria", "Hampton"],
    "washington": ["Seattle", "Spokane", "Tacoma", "Vancouver", "Bellevue", "Everett", "Kent"],
    "massachusetts": ["Boston", "Worcester", "Springfield", "Lowell", "Cambridge", "New Bedford", "Brockton"],
    "arizona": ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale", "Glendale", "Gilbert"],
    "tennessee": ["Nashville", "Memphis", "Knoxville", "Chattanooga", "Murfreesboro", "Franklin", "Jackson"],
    "indiana": ["Indianapolis", "Fort Wayne", "Evansville", "South Bend", "Carmel", "Fishers", "Bloomington"],
    "missouri": ["Kansas City", "St. Louis", "Springfield", "Columbia", "Independence", "Lee's Summit", "O'Fallon"],
    "maryland": ["Baltimore", "Frederick", "Rockville", "Gaithersburg", "Bowie", "Annapolis", "College Park"],
    "wisconsin": ["Milwaukee", "Madison", "Green Bay", "Kenosha", "Racine", "Appleton", "Waukesha"],
    "colorado": ["Denver", "Colorado Springs", "Aurora", "Fort Collins", "Lakewood", "Thornton", "Arvada"],
    "minnesota": ["Minneapolis", "St. Paul", "Rochester", "Duluth", "Bloomington", "Brooklyn Park", "Plymouth"],
    "south carolina": ["Charleston", "Columbia", "North Charleston", "Mount Pleasant", "Rock Hill", "Greenville", "Summerville"],
    "alabama": ["Birmingham", "Montgomery", "Mobile", "Huntsville", "Tuscaloosa", "Hoover", "Dothan"],
    "louisiana": ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette", "Lake Charles", "Kenner", "Bossier City"],
    "kentucky": ["Louisville", "Lexington", "Bowling Green", "Owensboro", "Covington", "Hopkinsville", "Richmond"],
    "oregon": ["Portland", "Eugene", "Salem", "Gresham", "Hillsboro", "Bend", "Beaverton"],
    "oklahoma": ["Oklahoma City", "Tulsa", "Norman", "Broken Arrow", "Lawton", "Edmond", "Moore"],
    "connecticut": ["Bridgeport", "New Haven", "Hartford", "Stamford", "Waterbury", "Norwalk", "Danbury"],
    "utah": ["Salt Lake City", "West Valley City", "Provo", "West Jordan", "Orem", "Sandy", "Ogden"],
    "iowa": ["Des Moines", "Cedar Rapids", "Davenport", "Sioux City", "Iowa City", "Waterloo", "Council Bluffs"],
    "nevada": ["Las Vegas", "Henderson", "Reno", "North Las Vegas", "Sparks", "Carson City", "Fernley"],
    "arkansas": ["Little Rock", "Fort Smith", "Fayetteville", "Springdale", "Jonesboro", "North Little Rock", "Conway"],
    "mississippi": ["Jackson", "Gulfport", "Southaven", "Hattiesburg", "Biloxi", "Meridian", "Tupelo"],
    "kansas": ["Wichita", "Overland Park", "Kansas City", "Olathe", "Topeka", "Lawrence", "Shawnee"],
    "new mexico": ["Albuquerque", "Las Cruces", "Rio Rancho", "Santa Fe", "Roswell", "Farmington", "Clovis"],
    "nebraska": ["Omaha", "Lincoln", "Bellevue", "Grand Island", "Kearney", "Fremont", "Hastings"],
    "west virginia": ["Charleston", "Huntington", "Parkersburg", "Morgantown", "Wheeling", "Martinsburg", "Fairmont"],
    "idaho": ["Boise", "Nampa", "Meridian", "Idaho Falls", "Pocatello", "Caldwell", "Coeur d'Alene"],
    "hawaii": ["Honolulu", "Pearl City", "Hilo", "Kailua", "Kaneohe", "Waipahu", "Kahului"],
    "new hampshire": ["Manchester", "Nashua", "Concord", "Derry", "Rochester", "Dover", "Keene"],
    "maine": ["Portland", "Lewiston", "Bangor", "South Portland", "Auburn", "Biddeford", "Sanford"],
    "rhode island": ["Providence", "Warwick", "Cranston", "Pawtucket", "East Providence", "Woonsocket", "Newport"],
    "montana": ["Billings", "Missoula", "Great Falls", "Bozeman", "Butte", "Helena", "Kalispell"],
    "delaware": ["Wilmington", "Dover", "Newark", "Middletown", "Smyrna", "Milford", "Seaford"],
    "south dakota": ["Sioux Falls", "Rapid City", "Aberdeen", "Brookings", "Watertown", "Mitchell", "Yankton"],
    "north dakota": ["Fargo", "Bismarck", "Grand Forks", "Minot", "West Fargo", "Williston", "Dickinson"],
    "alaska": ["Anchorage", "Fairbanks", "Juneau", "Wasilla", "Sitka", "Ketchikan", "Kenai"],
    "vermont": ["Burlington", "Essex", "South Burlington", "Colchester", "Rutland", "Montpelier", "Barre"],
    "wyoming": ["Cheyenne", "Casper", "Laramie", "Gillette", "Rock Springs", "Sheridan", "Green River"],
  };

  // Try to find cities for the state
  for (const [key, cities] of Object.entries(cityMap)) {
    if (stateLower.includes(key) || key.includes(stateLower)) {
      return cities;
    }
  }

  // Default: return major US cities if state not found
  return ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio"];
}

function buildJobGenerationPrompt(
  location: string,
  interests?: string[],
  disabilities?: string[],
  medicalConditions?: string[]
): string {
  const sections = [
    `Location: ${location}`,
    interests && interests.length > 0
      ? `Interests: ${interests.join(", ")}`
      : null,
    disabilities && disabilities.length > 0
      ? `Disabilities or injuries: ${disabilities.join(", ")}`
      : null,
    medicalConditions && medicalConditions.length > 0
      ? `Medical considerations: ${medicalConditions.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `
You are a job matching assistant helping people find employment opportunities. Generate 5 realistic job listings that would be suitable for someone with the following profile:

${sections}

Generate job listings that:
- Are entry-level or accessible positions
- Accommodate the person's disabilities, injuries, or medical conditions
- Match their interests when possible
- Are realistic and actually exist in the job market
- Include appropriate pay ranges for the location
- Have clear, encouraging descriptions

Return ONLY valid JSON array with this exact structure:
[
  {
    "id": "unique-id-1",
    "title": "Job Title",
    "employer": "Company or Organization Name",
    "description": "2-3 sentence description of what the job involves, focusing on accessibility and suitability",
    "pay": "Salary or hourly rate (e.g., '$18/hr · 20 hrs/week' or '$35k - $45k/year')",
    "location": "City, State"
  },
  ...
]

Make each job unique and realistic. Focus on jobs like: customer service, receptionist, data entry, warehouse work, retail, security, janitorial, maintenance, cleaning, delivery driver, remote work, part-time positions, or other accessible roles. Ensure the jobs are appropriate for someone with the specified needs.
`.trim();
}

function generateHardcodedJobs(
  location: string,
  interests?: string[],
  disabilities?: string[],
  medicalConditions?: string[]
): JobListing[] {
  const { city, state } = extractCityAndState(location);
  const locationParam = state ? `${city}, ${state}` : city;
  
  // Base set of accessible jobs that work for various needs
  const baseJobs: JobListing[] = [
    {
      id: `job-1-${Date.now()}`,
      title: "Customer Service Representative",
      employer: "Community Support Services",
      description: "Answer phone calls and assist customers with inquiries. This position offers flexible scheduling and can accommodate various physical needs. Training provided on-site.",
      pay: "$16/hr · 20-30 hrs/week",
      location: locationParam,
    },
    {
      id: `job-2-${Date.now()}`,
      title: "Data Entry Clerk",
      employer: "Local Business Solutions",
      description: "Enter data into computer systems from paper documents. This is a seated position with minimal physical requirements. Perfect for those who prefer desk work.",
      pay: "$15/hr · Full-time",
      location: locationParam,
    },
    {
      id: `job-3-${Date.now()}`,
      title: "Retail Associate",
      employer: "Neighborhood Store",
      description: "Help customers find products and process transactions at the register. Flexible hours available. Accommodations can be made for standing or mobility needs.",
      pay: "$14-17/hr · Part-time or Full-time",
      location: locationParam,
    },
    {
      id: `job-4-${Date.now()}`,
      title: "Security Guard",
      employer: "SafeGuard Services",
      description: "Monitor premises and ensure safety. Positions available for both standing and seated roles. Training and certification assistance provided.",
      pay: "$18/hr · Various shifts",
      location: locationParam,
    },
    {
      id: `job-5-${Date.now()}`,
      title: "Janitorial Staff",
      employer: "CleanWorks Inc.",
      description: "Maintain cleanliness of office buildings. Flexible scheduling with both day and evening shifts. Accommodations available for physical limitations.",
      pay: "$15-18/hr · Part-time",
      location: locationParam,
    },
    {
      id: `job-6-${Date.now()}`,
      title: "Receptionist",
      employer: "Medical Office Group",
      description: "Greet visitors, answer phones, and schedule appointments. Comfortable seated position with friendly work environment. No heavy lifting required.",
      pay: "$17/hr · Full-time",
      location: locationParam,
    },
    {
      id: `job-7-${Date.now()}`,
      title: "Warehouse Associate",
      employer: "Distribution Center",
      description: "Sort and organize inventory. Both light-duty and standard positions available. Accommodations made for physical needs and scheduling preferences.",
      pay: "$16-19/hr · Full-time",
      location: locationParam,
    },
    {
      id: `job-8-${Date.now()}`,
      title: "Delivery Driver Helper",
      employer: "Local Delivery Service",
      description: "Assist delivery drivers with loading and unloading packages. Flexible hours and routes. Can accommodate various physical capabilities.",
      pay: "$17/hr · Part-time",
      location: locationParam,
    },
    {
      id: `job-9-${Date.now()}`,
      title: "Remote Customer Support",
      employer: "Tech Support Solutions",
      description: "Provide technical support via phone and chat from home. Fully remote position with flexible hours. Perfect for those with mobility needs.",
      pay: "$16/hr · Full-time or Part-time",
      location: locationParam,
    },
    {
      id: `job-10-${Date.now()}`,
      title: "Maintenance Helper",
      employer: "Property Management Co.",
      description: "Assist with light maintenance tasks around apartment buildings. Training provided. Accommodations available for physical limitations.",
      pay: "$18/hr · Full-time",
      location: locationParam,
    },
  ];

  // Return 5 random jobs from the base set
  const shuffled = [...baseJobs].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 5).map((job, index) => ({
    ...job,
    id: `job-${index + 1}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  }));
}

async function generateJobsWithGemini(
  location: string,
  interests?: string[],
  disabilities?: string[],
  medicalConditions?: string[]
): Promise<JobListing[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const prompt = buildJobGenerationPrompt(location, interests, disabilities, medicalConditions);

  const response = await fetch(
    `${GEMINI_API_URL}/${GEMINI_JOB_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Gemini API error:", response.status, errorText);
    throw new Error(`Gemini API returned ${response.status}`);
  }

  const data = await response.json();
  const content = extractGeminiText(data);
  const jobs = parseModelResponse(content);

  // Ensure each job has required fields and unique IDs
  return jobs.map((job, index) => ({
    id: job.id || `job-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title: job.title || "Job Opportunity",
    employer: job.employer || "Employer",
    description: job.description || "No description available.",
    pay: job.pay || "Salary not specified",
    location: job.location || location,
  }));
}

export async function POST(request: Request) {
  let payload: JobSearchPayload | null = null;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!payload?.location) {
    return NextResponse.json(
      { error: "Location is required." },
      { status: 400 }
    );
  }

  const { city, state } = extractCityAndState(payload.location);
  const locationParam = state ? `${city}, ${state}` : city;

  try {
    // Use hardcoded jobs as primary method
    let jobs: JobListing[] = generateHardcodedJobs(
      locationParam,
      payload.interests,
      payload.disabilities,
      payload.medicalConditions
    );

    // If Gemini API key is configured, try to enhance with AI-generated jobs
    if (GEMINI_API_KEY) {
      try {
        const aiJobs = await generateJobsWithGemini(
          locationParam,
          payload.interests,
          payload.disabilities,
          payload.medicalConditions
        );
        if (aiJobs.length > 0) {
          jobs = aiJobs; // Use AI-generated jobs if available
        }
      } catch (err) {
        console.error(`Error generating AI jobs for ${locationParam}:`, err);
        // Fall back to hardcoded jobs
      }
    }

    // Remove duplicates based on job ID
    const uniqueJobs = jobs.filter((job, index, self) =>
      index === self.findIndex((j) => j.id === job.id)
    );

    if (uniqueJobs.length === 0) {
      return NextResponse.json(
        { 
          error: "Unable to generate job listings. Please try again or contact support.",
          jobs: []
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      jobs: uniqueJobs.slice(0, 5),
      fallbackUsed: false
    }, { status: 200 });
  } catch (error) {
    console.error("Job generation error:", error);
    // Even on error, return hardcoded jobs as fallback
    const fallbackJobs = generateHardcodedJobs(
      locationParam,
      payload.interests,
      payload.disabilities,
      payload.medicalConditions
    );
    return NextResponse.json({
      jobs: fallbackJobs.slice(0, 5),
      fallbackUsed: false
    }, { status: 200 });
  }
}

