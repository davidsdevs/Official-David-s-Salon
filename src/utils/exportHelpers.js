/**
 * Export Helpers
 * Utilities for exporting data to CSV and other formats
 */

import { formatDate, formatTime } from './helpers';

/**
 * Convert array of objects to CSV string
 */
export const convertToCSV = (data, headers) => {
  if (!data || data.length === 0) return '';

  // Create header row
  const headerRow = headers.map(h => h.label).join(',');
  
  // Create data rows
  const dataRows = data.map(row => {
    return headers.map(header => {
      let value = row[header.key];
      
      // Handle nested objects
      if (header.key.includes('.')) {
        const keys = header.key.split('.');
        value = keys.reduce((obj, key) => obj?.[key], row);
      }
      
      // Format value
      if (value === null || value === undefined) {
        value = '';
      } else if (typeof value === 'string' && value.includes(',')) {
        value = `"${value}"`;
      }
      
      return value;
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
};

/**
 * Download CSV file
 */
export const downloadCSV = (csvContent, filename) => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Export appointments to CSV
 */
export const exportAppointmentsToCSV = (appointments, filename = 'appointments.csv') => {
  const headers = [
    { key: 'id', label: 'Appointment ID' },
    { key: 'clientName', label: 'Client Name' },
    { key: 'clientEmail', label: 'Client Email' },
    { key: 'clientPhone', label: 'Client Phone' },
    { key: 'branchName', label: 'Branch' },
    { key: 'serviceName', label: 'Service' },
    { key: 'stylistName', label: 'Stylist' },
    { key: 'appointmentDate', label: 'Date' },
    { key: 'appointmentTime', label: 'Time' },
    { key: 'duration', label: 'Duration (mins)' },
    { key: 'status', label: 'Status' },
    { key: 'notes', label: 'Notes' },
    { key: 'postServiceNotes', label: 'Post-Service Notes' }
  ];

  // Format appointment data
  const formattedData = appointments.map(apt => ({
    ...apt,
    appointmentDate: formatDate(apt.appointmentDate),
    appointmentTime: formatTime(apt.appointmentDate),
    status: apt.status.toUpperCase(),
    notes: apt.notes || '',
    postServiceNotes: apt.postServiceNotes || ''
  }));

  const csvContent = convertToCSV(formattedData, headers);
  downloadCSV(csvContent, filename);
};

/**
 * Export analytics to CSV
 */
export const exportAnalyticsToCSV = (analytics, dateRange, filename = 'analytics.csv') => {
  const sections = [];

  // Top Services
  if (analytics.topServices && analytics.topServices.length > 0) {
    sections.push('TOP SERVICES');
    sections.push('Service,Bookings');
    analytics.topServices.forEach(service => {
      sections.push(`${service.name},${service.count}`);
    });
    sections.push('');
  }

  // Top Stylists
  if (analytics.topStylists && analytics.topStylists.length > 0) {
    sections.push('TOP STYLISTS');
    sections.push('Stylist,Appointments');
    analytics.topStylists.forEach(stylist => {
      sections.push(`${stylist.name},${stylist.count}`);
    });
    sections.push('');
  }

  // Peak Hours
  if (analytics.peakHours && analytics.peakHours.length > 0) {
    sections.push('PEAK HOURS');
    sections.push('Time,Rank');
    analytics.peakHours.forEach((hour, index) => {
      sections.push(`${hour},${index + 1}`);
    });
    sections.push('');
  }

  // Performance Metrics
  sections.push('PERFORMANCE METRICS');
  sections.push('Metric,Value');
  sections.push(`Completion Rate,${analytics.completionRate}%`);
  sections.push(`Cancellation Rate,${analytics.cancellationRate}%`);
  sections.push(`Date Range,${dateRange}`);

  const csvContent = sections.join('\n');
  downloadCSV(csvContent, filename);
};
