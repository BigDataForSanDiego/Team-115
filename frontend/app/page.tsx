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
      <div className="flex flex-wrap gap-2 p-3 min-h-[48px] border-2 border-indigo-200 rounded-xl bg-white/50 focus-within:ring-2 focus-within:ring-amber-400 focus-within:border-amber-400 transition-all">
        {selected.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-100 to-orange-100 text-indigo-800 rounded-full text-sm font-medium"
          >
            {item}
            <button
              type="button"
              onClick={() => handleRemove(item)}
              className="ml-1 text-indigo-600 hover:text-indigo-800 focus:outline-none"
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
          className="flex-1 min-w-[120px] outline-none bg-transparent text-gray-800"
        />
      </div>
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 max-h-48 overflow-y-auto bg-white/95 backdrop-blur-sm border-2 border-indigo-200 rounded-xl shadow-xl">
          {filteredOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className="w-full text-left px-4 py-2 hover:bg-amber-50 text-gray-700 focus:bg-amber-50 focus:outline-none transition-colors"
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

function LocationAutocomplete({ value, onChange, placeholder }: LocationAutocompleteProps) {
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
          className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl bg-white/50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-5 w-5 text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1 max-h-64 overflow-y-auto bg-white/95 backdrop-blur-sm border-2 border-indigo-200 rounded-xl shadow-xl">
          {suggestions.map((option, index) => (
            <button
              key={`${option}-${index}`}
              type="button"
              onClick={() => handleSelect(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`w-full text-left px-4 py-3 text-gray-700 focus:outline-none transition-colors ${
                index === highlightedIndex
                  ? "bg-amber-100 text-indigo-900"
                  : "hover:bg-amber-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-amber-500 flex-shrink-0"
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
        <div className="absolute z-20 w-full mt-1 bg-white/95 backdrop-blur-sm border-2 border-indigo-200 rounded-xl shadow-xl px-4 py-3 text-gray-500 text-sm">
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
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 font-sans relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      {/* Pathway decorative lines */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <svg className="w-full h-full opacity-10" viewBox="0 0 1200 800" preserveAspectRatio="none">
          <path d="M0,400 Q300,200 600,400 T1200,400" stroke="currentColor" strokeWidth="2" fill="none" className="text-blue-400"/>
          <path d="M0,500 Q300,300 600,500 T1200,500" stroke="currentColor" strokeWidth="2" fill="none" className="text-indigo-400"/>
        </svg>
      </div>

      <div className="relative z-10">
        {/* Welcome Section */}
        <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
          <div className="flex flex-col items-center gap-8 w-full max-w-4xl text-center">
            <h1 className="text-7xl font-extrabold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent drop-shadow-lg">
              Hopeful Futures
            </h1>
            <p className="text-2xl text-gray-700 font-medium max-w-3xl">
              AI-Powered Job Matching Platform
            </p>
            <p className="text-lg text-gray-600 max-w-3xl">
              Our platform uses AI to curate personalized job descriptions tailored to your unique needs, including disabilities, injuries, and circumstances. We'll match you with suitable opportunities and provide resources like skill training videos, courses, and certificates to help you prepare for success.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <button
                onClick={scrollToForm}
                className="px-10 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-lg hover:from-amber-600 hover:to-orange-600 active:from-amber-700 active:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 hover:scale-105"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>

        {/* Form Section */}
        <div ref={formRef} className="flex flex-col items-center justify-center px-6 py-12">
          <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
            <div className="text-center space-y-4 mb-4">
              <h2 className="text-4xl font-bold text-indigo-700">
                Application Form
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl">
                Fill out the form below with your information. Select all options that apply to you, then click "Submit Application" to get started.
              </p>
            </div>

            <form className="w-full flex flex-col gap-6 p-10 bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/50"
            onSubmit={(e)=>{
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());

              const encoded = btoa(JSON.stringify(data));
              window.location.href = `/results?data=${encoded}`;
            }}>
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
              <span className="text-amber-500">✦</span>
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              className="px-4 py-3 border-2 border-indigo-200 rounded-xl bg-white/50 text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all placeholder:text-gray-400"
              placeholder="Enter your name"
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
              <span className="text-amber-500">✦</span>
              Gender
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Male</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Female</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="non-binary"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Non-binary</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="other"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Other</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="gender"
                  value="prefer-not-to-say"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Prefer not to say</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
              <span className="text-amber-500">✦</span>
              Homeless
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="homeless"
                  value="yes"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="homeless"
                  value="no"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">No</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
              <span className="text-amber-500">✦</span>
              Race
            </label>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="american-indian"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">American Indian or Alaska Native</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="asian"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Asian</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="black"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Black or African American</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="hispanic"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Hispanic or Latino</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="native-hawaiian"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Native Hawaiian or Other Pacific Islander</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="white"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">White</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="other"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Other</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="race"
                  value="prefer-not-to-say"
                  className="w-5 h-5 text-amber-500 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-amber-400 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-700">Prefer not to say</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
              <span className="text-amber-500">✦</span>
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
            <label className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
              <span className="text-amber-500">✦</span>
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
            <label className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
              <span className="text-amber-500">✦</span>
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
            <label htmlFor="location" className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
              <span className="text-amber-500">✦</span>
              Location/Area
            </label>
            <LocationAutocomplete
              value={location}
              onChange={setLocation}
              placeholder="Search for a city..."
            />
            <input
              type="hidden"
              name="location"
              value={location}
            />
          </div>

          <button
            type="submit"
            className="mt-6 px-10 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-lg hover:from-amber-600 hover:to-orange-600 active:from-amber-700 active:to-orange-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1 hover:scale-105"
          >
            Submit Application
          </button>
        </form>
          </div>
        </div>
      </div>
    </div>
  );
}
