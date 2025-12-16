# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
