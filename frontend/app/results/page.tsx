"use client";

import {useEffect, useState} from "react";
/* need to put a database that has jobs in it */

export default function ResultsPage({searchParams}: any){
  const [simplifiedDescriptions, setSimplifiedDescriptions] = useState({});
  const [trainingPlans, setTrainingPlans] = useState({});

  /* processes data here*/


  return(
    <div className= "min-h-screen p-10 bg-gradient-to-br from-sky-50 to-indigo-50">
      <h1 className="text-4xl font-bold text-indigo-700">Your Job Matches</h1>
      <p className="text-gray-600 mb-10">
        Based on your profile, we selected job opportunites and generated summaries
      </p>

      <div className="space-y-10">
        <div className="p-8 bg-white/90 rounded-2x1 shadow-xl border border-indigo-100"
        >
          <h2 className="text-3xl font-semibold text-indigo-700">job.title</h2>
          <h3 className="mt-6 text-xl font-bold text-amber-600">Simplified Description</h3>
          <p className="whitespace-pre-wrap text-gray-700">
            Simplified job Description here
          </p>
          <h3 className="mt-6 text-xl font-bold text-amber-600">Accesibility Accomdations</h3>
          <ul className="list-disc pl-6 text-gray-700">

          </ul>
          <h3 className="mt-6 text-xl font-bold text-amber-600">
            Personalized Training Plan
          </h3>
          <p className="whitespace-pre-wrap text-gray-700"> Training plans here</p>
        </div>
      </div>
    </div>
  )
}