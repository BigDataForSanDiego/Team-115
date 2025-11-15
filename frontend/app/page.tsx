"use client";

import { useState, useRef, useEffect } from "react";

interface SearchableMultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
}

function SearchableMultiSelect({ options, selected, onChange, placeholder }: SearchableMultiSelectProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(
    (option) =>
      option.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selected.includes(option)
  );

  const handleSelect = (option: string) => {
    onChange([...selected, option]);
    setSearchQuery("");
    setIsOpen(false);
  };

  const handleRemove = (option: string) => {
    onChange(selected.filter((item) => item !== option));
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex flex-wrap gap-2 p-2.5 min-h-[42px] border border-gray-300 rounded-lg bg-white focus-within:ring-1 focus-within:ring-sky-400 focus-within:border-sky-400 transition-all">
        {selected.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-100 text-sky-700 text-sm rounded-md"
          >
            {item}
            <button
              type="button"
              onClick={() => handleRemove(item)}
              className="ml-0.5 text-sky-600 hover:text-sky-800 focus:outline-none text-base leading-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selected.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-gray-900 text-sm"
        />
      </div>
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {filteredOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className="w-full text-left px-4 py-2 hover:bg-sky-50 text-gray-700 focus:bg-sky-50 focus:outline-none transition-colors text-sm"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hasError?: boolean;
}

interface LocationResult {
  display_name: string;
  place_id: number;
  type: string;
  class: string;
  address?: {
    city?: string;
    town?: string;
    state?: string;
  };
}

function LocationAutocomplete({ value, onChange, placeholder, hasError = false }: LocationAutocompleteProps) {
  const [searchQuery, setSearchQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setSearchQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Don't search if query is too short or empty
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Debounce API calls - wait 300ms after user stops typing
    debounceTimerRef.current = setTimeout(async () => {
      try {
        // Using OpenStreetMap Nominatim API (free, no API key required)
        // Note: Nominatim requires a User-Agent header and has rate limits
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=20&addressdetails=1&countrycodes=us&featuretype=city`,
          {
            headers: {
              'User-Agent': 'HopefulFutures/1.0', // Required by Nominatim
              'Accept-Language': 'en-US,en;q=0.9'
            }
          }
        );

        if (!response.ok) {
          console.error('API response not OK:', response.status, response.statusText);
          setSuggestions([]);
          return;
        }

        const data: LocationResult[] = await response.json();
        
        if (!Array.isArray(data)) {
          console.error('Unexpected API response format:', data);
          setSuggestions([]);
          return;
        }
        
        if (!data || data.length === 0) {
          setSuggestions([]);
          return;
        }
        
        // Since we're using featuretype=city, most results should be cities
        // But let's still filter to be safe and format properly
        const resultsToUse = data;
        
        // Format results: prioritize city, state format
        const formattedResults = resultsToUse.map((item) => {
          // Try to use address details first
          if (item.address) {
            const city = item.address.city || item.address.town;
            const state = item.address.state;
            if (city && state) {
              return `${city}, ${state}`;
            }
            if (city) {
              return city;
            }
          }
          
          // Fallback to parsing display_name
          const parts = item.display_name.split(',');
          if (parts.length >= 2) {
            // Try to find city and state
            const city = parts[0].trim();
            // Look for state abbreviation (2 letters) or full state name
            const stateMatch = parts.find(p => p.trim().match(/^[A-Z]{2}$/)) || 
                              parts[parts.length - 2]?.trim();
            if (stateMatch) {
              return `${city}, ${stateMatch}`;
            }
            return `${city}, ${parts[parts.length - 1]?.trim()}`;
          }
          return item.display_name;
        }).filter(Boolean); // Remove any empty strings

        // Remove duplicates
        const uniqueResults = Array.from(new Set(formattedResults));
        setSuggestions(uniqueResults.slice(0, 10));
      } catch (error) {
        console.error('Error fetching locations:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchQuery(newValue);
    onChange(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSelect = (option: string) => {
    setSearchQuery(option);
    onChange(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full px-4 py-2.5 border rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 transition-all ${
            hasError 
              ? 'border-red-300 focus:border-red-400 focus:ring-red-400' 
              : 'border-gray-300 focus:border-sky-400 focus:ring-sky-400'
          }`}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {suggestions.map((option, index) => (
            <button
              key={`${option}-${index}`}
              type="button"
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full text-left px-4 py-2.5 text-gray-700 focus:outline-none transition-colors text-sm ${
                index === highlightedIndex
                  ? "bg-sky-50 text-sky-900"
                  : "hover:bg-sky-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-3.5 h-3.5 text-sky-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>{option}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      {isOpen && searchQuery.length >= 2 && !isLoading && suggestions.length === 0 && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-gray-500 text-sm">
          No locations found. Try a different search term.
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [interests, setInterests] = useState<string[]>([]);
  const [disabilities, setDisabilities] = useState<string[]>([]);
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const validateForm = (formData: FormData): { isValid: boolean; errors: Record<string, string> } => {
    const newErrors: Record<string, string> = {};

    // Validate name
    const name = formData.get("name") as string;
    if (!name || name.trim() === "") {
      newErrors.name = "Name is required";
    }

    // Validate gender
    const gender = formData.get("gender") as string;
    if (!gender) {
      newErrors.gender = "Please select a gender";
    }

    // Validate homeless
    const homeless = formData.get("homeless") as string;
    if (!homeless) {
      newErrors.homeless = "Please select an option";
    }

    // Validate race
    const raceValues = formData.getAll("race") as string[];
    if (raceValues.length === 0) {
      newErrors.race = "Please select at least one race";
    }

    // Validate location
    if (!location || location.trim() === "") {
      newErrors.location = "Location is required";
    }

    setErrors(newErrors);
    return { isValid: Object.keys(newErrors).length === 0, errors: newErrors };
  };

  const interestOptions = [
    "Sports",
    "Music",
    "Reading",
    "Technology",
    "Art",
    "Travel",
    "Cooking",
    "Fitness",
    "Gaming",
    "Volunteering",
    "Photography",
    "Writing",
    "Dancing",
    "Gardening",
    "Crafts",
  ];

  const disabilityOptions = [
    "Knee Injury",
    "Back Injury",
    "Shoulder Injury",
    "Hip Injury",
    "Ankle Injury",
    "Neck Injury",
    "Wrist Injury",
    "Elbow Injury",
    "Spinal Cord Injury",
    "Amputation",
    "Blindness",
    "Low Vision",
    "Deafness",
    "Hearing Loss",
    "Speech Impairment",
    "Cognitive Impairment",
    "Learning Disability",
    "ADHD",
    "Autism Spectrum Disorder",
    "Down Syndrome",
    "Cerebral Palsy",
    "Multiple Sclerosis",
    "Parkinson's Disease",
    "Arthritis",
    "Fibromyalgia",
    "Chronic Fatigue Syndrome",
    "Post-Traumatic Stress Disorder",
    "Depression",
    "Anxiety Disorder",
    "Bipolar Disorder",
    "Schizophrenia",
    "None",
  ];

  const medicalConditionOptions = [
    "Diabetes",
    "Hypertension",
    "Asthma",
    "Heart Disease",
    "Arthritis",
    "Epilepsy",
    "Cancer",
    "HIV/AIDS",
    "Chronic Kidney Disease",
    "Mental Health Disorder",
    "Autoimmune Disease",
    "None",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 font-sans relative">
      {/* Accent line */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-sky-400"></div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-10 max-w-md mx-4 text-center rounded-xl shadow-lg">
            <div className="mb-6">
              <div className="w-12 h-12 border-[3px] border-sky-200 border-t-sky-500 rounded-full animate-spin mx-auto"></div>
            </div>
            <h3 className="text-xl font-semibold text-sky-600 mb-2">Processing Your Application</h3>
            <p className="text-gray-600 text-sm">Please wait while we process your information...</p>
          </div>
        </div>
      )}

      <div className="relative z-10">
        {/* Welcome Section */}
        <div className="flex flex-col items-center justify-center min-h-screen px-6 py-16 relative z-10">
          <div className="flex flex-col items-center gap-8 w-full max-w-3xl text-center">
            <div className="relative">
              <h1 className="text-6xl md:text-7xl font-bold text-sky-600 tracking-tight leading-tight">
                Hopeful Futures
              </h1>
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-20 h-1 bg-sky-400 rounded-full"></div>
            </div>
            <p className="text-2xl md:text-3xl text-gray-800 font-semibold max-w-2xl leading-tight mt-4">
              AI-Powered Job Matching Platform
            </p>
            <p className="text-lg text-gray-700 max-w-2xl leading-relaxed mt-2">
              Our platform uses AI to curate personalized job descriptions tailored to your unique needs, including disabilities, injuries, and circumstances. We'll match you with suitable opportunities and provide resources like skill training videos, courses, and certificates to help you prepare for success.
            </p>
            <div className="mt-10">
              <button
                onClick={scrollToForm}
                className="group px-8 py-3 bg-sky-500 text-white font-medium text-base rounded-lg hover:bg-sky-600 transition-colors shadow-md"
              >
                <span className="flex items-center gap-2">
                  Get Started
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div ref={formRef} className="flex flex-col items-center justify-center px-6 py-16 bg-white relative z-10">
          <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
            <div className="text-center space-y-3 mb-4">
              <h2 className="text-3xl md:text-4xl font-bold text-sky-600">
                Application Form
              </h2>
              <div className="w-16 h-1 bg-sky-400 mx-auto rounded-full"></div>
              <p className="text-base text-gray-600 max-w-xl mt-4">
                Fill out the form below with your information. Select all options that apply to you, then click "Submit Application" to get started.
              </p>
            </div>

            <form className="w-full flex flex-col gap-6 p-8 bg-white border border-gray-200 rounded-xl shadow-sm"
            onSubmit={async (e)=>{
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              
              // Validate form
              const validation = validateForm(formData);
              if (!validation.isValid) {
                // Scroll to first error
                setTimeout(() => {
                  const firstErrorField = Object.keys(validation.errors)[0];
                  if (firstErrorField) {
                    let errorElement: HTMLElement | null = null;
                    if (firstErrorField === 'location') {
                      // Find the location input within LocationAutocomplete
                      errorElement = document.querySelector('input[placeholder*="city"]') as HTMLElement ||
                                   document.querySelector('input[placeholder*="Search for"]') as HTMLElement;
                    } else {
                      errorElement = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement ||
                                   document.querySelector(`#${firstErrorField}`) as HTMLElement;
                    }
                    if (errorElement) {
                      errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      errorElement.focus();
                    }
                  }
                }, 100);
                return;
              }

              setIsLoading(true);
              
              // Simulate processing time
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              const data = Object.fromEntries(formData.entries());
              data.interests = JSON.stringify(interests);
              data.disabilities = JSON.stringify(disabilities);
              data["medical-conditions"] = JSON.stringify(medicalConditions);
              data.location = location;

              const encoded = btoa(JSON.stringify(data));
              // URL encode the base64 string to handle special characters
              window.location.href = `/results?data=${encodeURIComponent(encoded)}`;
            }}>
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              className={`px-4 py-2.5 border rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 transition-all placeholder:text-gray-400 ${
                errors.name ? 'border-red-300 focus:ring-red-400 focus:border-red-400' : 'border-gray-300 focus:ring-sky-400 focus:border-sky-400'
              }`}
              placeholder="Enter your name"
            />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">
              Gender <span className="text-red-500">*</span>
            </label>
            {errors.gender && <p className="text-sm text-red-600 -mt-2">{errors.gender}</p>}
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  className="w-4 h-4 text-sky-500 border-gray-300 focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Male</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  className="w-4 h-4 text-sky-500 border-gray-300 focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Female</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="non-binary"
                  className="w-4 h-4 text-sky-500 border-gray-300 focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Non-binary</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="other"
                  className="w-4 h-4 text-sky-500 border-gray-300 focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Other</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="prefer-not-to-say"
                  className="w-4 h-4 text-sky-500 border-gray-300 focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Prefer not to say</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">
              Homeless <span className="text-red-500">*</span>
            </label>
            {errors.homeless && <p className="text-sm text-red-600 -mt-2">{errors.homeless}</p>}
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="homeless"
                  value="yes"
                  className="w-4 h-4 text-sky-500 border-gray-300 focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="homeless"
                  value="no"
                  className="w-4 h-4 text-sky-500 border-gray-300 focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">No</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">
              Race <span className="text-red-500">*</span>
            </label>
            {errors.race && <p className="text-sm text-red-600 -mt-2">{errors.race}</p>}
            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="american-indian"
                  className="w-4 h-4 text-sky-500 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">American Indian or Alaska Native</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="asian"
                  className="w-4 h-4 text-sky-500 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Asian</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="black"
                  className="w-4 h-4 text-sky-500 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Black or African American</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="hispanic"
                  className="w-4 h-4 text-sky-500 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Hispanic or Latino</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="native-hawaiian"
                  className="w-4 h-4 text-sky-500 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Native Hawaiian or Other Pacific Islander</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="white"
                  className="w-4 h-4 text-sky-500 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">White</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="other"
                  className="w-4 h-4 text-sky-500 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Other</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="prefer-not-to-say"
                  className="w-4 h-4 text-sky-500 border-gray-300 rounded focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-gray-700 text-sm">Prefer not to say</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">
              Interest
            </label>
            <SearchableMultiSelect
              options={interestOptions}
              selected={interests}
              onChange={setInterests}
              placeholder="Search and select interests..."
            />
            <input
              type="hidden"
              name="interest"
              value={JSON.stringify(interests)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">
              Disabilities
            </label>
            <SearchableMultiSelect
              options={disabilityOptions}
              selected={disabilities}
              onChange={setDisabilities}
              placeholder="Search and select disabilities..."
            />
            <input
              type="hidden"
              name="disabilities"
              value={JSON.stringify(disabilities)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">
              Medical Conditions
            </label>
            <SearchableMultiSelect
              options={medicalConditionOptions}
              selected={medicalConditions}
              onChange={setMedicalConditions}
              placeholder="Search and select medical conditions..."
            />
            <input
              type="hidden"
              name="medical-conditions"
              value={JSON.stringify(medicalConditions)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <label htmlFor="location" className="text-sm font-medium text-gray-700">
              Location/Area <span className="text-red-500">*</span>
            </label>
            <LocationAutocomplete
              value={location}
              onChange={setLocation}
              placeholder="Search for a city..."
              hasError={!!errors.location}
            />
            {errors.location && <p className="text-sm text-red-600 mt-1">{errors.location}</p>}
            <input
              type="hidden"
              name="location"
              value={location}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-4 px-8 py-3 bg-sky-500 text-white font-medium text-base rounded-lg hover:bg-sky-600 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              "Submit Application"
            )}
          </button>
        </form>
          </div>
        </div>
      </div>
    </div>
  );
}
