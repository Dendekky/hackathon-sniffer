'use client';

import Link from 'next/link';
import { Hackathon } from '@/types/hackathon';
import { formatDateRange, isUpcoming, daysUntil } from '@/lib/api';
import { CalendarIcon, MapPinIcon, GlobeAltIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface HackathonCardProps {
  hackathon: Hackathon;
}

export function HackathonCard({ hackathon }: HackathonCardProps) {
  const upcoming = isUpcoming(hackathon.start_date);
  const daysLeft = upcoming ? daysUntil(hackathon.start_date) : null;

  return (
    <div className="card p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <Link 
            href={`/hackathons/${hackathon.id}`}
            className="text-lg font-semibold text-gray-900 hover:text-primary-600 transition-colors"
          >
            {hackathon.title}
          </Link>
          
          <div className="flex items-center gap-2 mt-2">
            <span className={`badge-source capitalize`}>
              {hackathon.source}
            </span>
            <span className={hackathon.is_online ? 'badge-online' : 'badge-onsite'}>
              {hackathon.is_online ? 'Online' : 'On-site'}
            </span>
            {upcoming && daysLeft !== null && (
              <span className="badge bg-yellow-100 text-yellow-800">
                {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days left`}
              </span>
            )}
          </div>
        </div>
      </div>

      {hackathon.description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
          {hackathon.description}
        </p>
      )}

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <CalendarIcon className="h-4 w-4 mr-2 flex-shrink-0" />
          <span>{formatDateRange(hackathon.start_date, hackathon.end_date)}</span>
        </div>

        <div className="flex items-center text-sm text-gray-600">
          {hackathon.is_online ? (
            <GlobeAltIcon className="h-4 w-4 mr-2 flex-shrink-0" />
          ) : (
            <MapPinIcon className="h-4 w-4 mr-2 flex-shrink-0" />
          )}
          <span className="truncate">{hackathon.location}</span>
        </div>

        {hackathon.registration_deadline && (
          <div className="flex items-center text-sm text-gray-600">
            <CalendarIcon className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>
              Registration deadline: {new Date(hackathon.registration_deadline).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <Link
          href={`/hackathons/${hackathon.id}`}
          className="btn-secondary text-sm"
        >
          View Details
        </Link>

        <div className="flex gap-2">
          {hackathon.registration_url && (
            <a
              href={hackathon.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm inline-flex items-center"
            >
              Register
              <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-1" />
            </a>
          )}
          
          {hackathon.website_url && !hackathon.registration_url && (
            <a
              href={hackathon.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm inline-flex items-center"
            >
              Visit Site
              <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-1" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
