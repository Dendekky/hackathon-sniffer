'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useHackathonStore } from '@/store/hackathon-store';
import { formatDate, formatDateRange, isUpcoming, daysUntil } from '@/lib/api';
import { 
  CalendarIcon, 
  MapPinIcon, 
  GlobeAltIcon, 
  ArrowTopRightOnSquareIcon,
  ArrowLeftIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

export default function HackathonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { selectedHackathon: hackathon, loading, error, loadHackathon } = useHackathonStore();
  
  const hackathonId = params.id as string;

  useEffect(() => {
    if (hackathonId) {
      loadHackathon(hackathonId);
    }
  }, [hackathonId, loadHackathon]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading hackathon details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="rounded-md bg-red-50 p-4 max-w-md mx-auto">
          <div className="text-red-800">
            <h3 className="text-sm font-medium">Error loading hackathon</h3>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        </div>
        <button
          onClick={() => router.back()}
          className="mt-4 btn-secondary inline-flex items-center"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Go Back
        </button>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Hackathon not found.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 btn-secondary inline-flex items-center"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Go Back
        </button>
      </div>
    );
  }

  const upcoming = isUpcoming(hackathon.start_date);
  const daysLeft = upcoming ? daysUntil(hackathon.start_date) : null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="btn-ghost mb-6 inline-flex items-center"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-2" />
        Back to Hackathons
      </button>

      {/* Header */}
      <div className="card p-8 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {hackathon.title}
            </h1>

            <div className="flex flex-wrap gap-2 mb-6">
              <span className="badge-source capitalize">
                {hackathon.source}
              </span>
              <span className={hackathon.is_online ? 'badge-online' : 'badge-onsite'}>
                {hackathon.is_online ? 'Online' : 'On-site'}
              </span>
              {upcoming && daysLeft !== null && (
                <span className="badge bg-yellow-100 text-yellow-800">
                  {daysLeft === 0 ? 'Starting Today' : daysLeft === 1 ? 'Starting Tomorrow' : `Starts in ${daysLeft} days`}
                </span>
              )}
              {!upcoming && (
                <span className="badge bg-gray-100 text-gray-800">
                  Past Event
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center text-gray-600">
                <CalendarIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">Event Dates</p>
                  <p className="text-sm">{formatDateRange(hackathon.start_date, hackathon.end_date)}</p>
                </div>
              </div>

              <div className="flex items-center text-gray-600">
                {hackathon.is_online ? (
                  <GlobeAltIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                ) : (
                  <MapPinIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium text-gray-900">Location</p>
                  <p className="text-sm">{hackathon.location}</p>
                </div>
              </div>

              {hackathon.registration_deadline && (
                <div className="flex items-center text-gray-600">
                  <ClockIcon className="h-5 w-5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">Registration Deadline</p>
                    <p className="text-sm">{formatDate(hackathon.registration_deadline)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:w-48">
            {hackathon.registration_url && (
              <a
                href={hackathon.registration_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary justify-center inline-flex items-center"
              >
                Register Now
                <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-2" />
              </a>
            )}
            
            {hackathon.website_url && (
              <a
                href={hackathon.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary justify-center inline-flex items-center"
              >
                Visit Website
                <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-2" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {hackathon.description && (
        <div className="card p-8 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            About This Hackathon
          </h2>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-600 whitespace-pre-wrap">
              {hackathon.description}
            </p>
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Event Timeline
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Starts</span>
              <span className="text-sm font-medium text-gray-900">
                {formatDate(hackathon.start_date)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Ends</span>
              <span className="text-sm font-medium text-gray-900">
                {formatDate(hackathon.end_date)}
              </span>
            </div>
            {hackathon.registration_deadline && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Registration Deadline</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatDate(hackathon.registration_deadline)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Source Information
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Source</span>
              <span className="badge-source capitalize">
                {hackathon.source}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Last Updated</span>
              <span className="text-sm font-medium text-gray-900">
                {formatDate(hackathon.updated_at)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
