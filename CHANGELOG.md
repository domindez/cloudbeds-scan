# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-06

### Added

- **Price Comparison Tool** - Compare hotel prices directly from the CloudBeds calendar
  - Floating button with magnifying glass icon on calendar page
  - Two-table comparison layout: "Mi Hotel" and "Competencia"
  - Dynamic room type detection from calendar (no hardcoded IDs)
  - Support for multi-night date ranges
  - Real-time price extraction from CloudBeds calendar
  - Booking.com competitor price scraping via background worker
  - Automatic price summation for multi-night stays
  - Display of 3 cheapest room types ordered by price
  - Configurable competitor hotels via extension settings
  - Smart button visibility (shows only on calendar page)
  - URL change detection for SPA navigation
  - Click outside to close panel
  - Progress bar with real-time status updates
  - Batch processing for multiple competitors (5 concurrent requests)
  - Tooltip on truncated room names
  - Responsive table design with no horizontal scroll

### Technical Features

- Background service worker for Booking.com scraping
- Chrome tabs API for hidden tab price extraction
- Dynamic DOM parsing for room types
- History API monitoring for SPA navigation detection
- CSS truncation with ellipsis for long room names
- Fixed table layout for consistent column widths

## [1.0.0] - 2024-12-16

### Added

- Identity document scanning using OpenAI Vision API
- Support for Spanish DNI and NIE (2 sides: front and back)
- Support for passports and other single-sided documents
- Auto-fill guest forms in Cloudbeds
- Spanish municipalities database for autocomplete
- Countries and nationalities database
- Scanner folder configuration for automatic loading
- Option to upload document image as guest photo
- Step-by-step progress view during scanning
- Postal code inference based on Spanish addresses

### Technical features

- OpenAI GPT-5-mini integration
- File System Access API support
- Local configuration storage
- Content script injection for Cloudbeds
