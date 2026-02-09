# GMC Offers Scraper

Python script to scrape GMC vehicle offers using Selenium Chrome driver and send data to API endpoint.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Install ChromeDriver:
   - **Windows**: Download from https://chromedriver.chromium.org/ and add to PATH
   - **macOS**: `brew install chromedriver`
   - **Linux**: `sudo apt-get install chromium-chromedriver` or download from website

3. Set API URL (optional):
```bash
export OFFERS_SCRAPER_API_URL=http://localhost:3000/api/incentives/scrape
```

## Usage

### Basic usage (scrapes from API and sends to endpoint):
```bash
python gmc.py
```

### Scrape from website (requires ChromeDriver):
```bash
python gmc.py --use-website
```

### Custom API endpoint:
```bash
python gmc.py --api-url http://your-api-url/api/incentives/scrape
```

### Test without sending to API:
```bash
python gmc.py --no-send
```

### All options:
```bash
python gmc.py --help
```

## How it works

1. **API Method (default)**: Fetches data from GMC's public API endpoint
   - Fast and reliable
   - No browser required
   - May not have all data available on website

2. **Website Method**: Uses Selenium to scrape from GMC website
   - Can access additional data not in API
   - Requires ChromeDriver
   - Slower but more comprehensive

3. **Data Processing**: Extracts and normalizes offer data:
   - Monthly payments
   - Term months
   - Due at signing
   - APR rates
   - Expiration dates
   - Vehicle information

4. **API Submission**: Sends processed data to Next.js API endpoint
   - Validates data
   - Stores in database
   - Returns success/error status

## API Endpoint

The scraper sends data to: `POST /api/incentives/scrape`

This is a generic endpoint that accepts normalized offer data from any brand/manufacturer. All data normalization is handled in the Python script before sending.

Request body:
```json
{
  "offers": [
    {
      "brand": "GMC",
      "year": 2025,
      "make": "GMC",
      "model": "Sierra 1500",
      "modelCode": "sierra-1500",
      "trim": "Elevation",
      "offerType": "lease",
      "offerAmount": 289,
      "apr": null,
      "termMonths": 24,
      "cashBack": null,
      "dueAtSigning": 3629,
      "monthlyPayment": 289,
      "milesPerYear": null,
      "expirationDate": "2026-01-02",
      "terms": "...",
      "finePrint": "..."
    }
  ],
  "scrapedAt": "2025-01-15T10:30:00Z",
  "source": "python_scraper"
}
```

## Troubleshooting

1. **ChromeDriver not found**: Make sure ChromeDriver is installed and in PATH
2. **API connection error**: Check that the Next.js server is running and API endpoint is accessible
3. **No offers found**: Website structure may have changed - check selectors in `extract_offer_from_card()`
4. **Timeout errors**: Increase wait times or check network connection

## Data Normalization

The Python script handles all data normalization before sending to the API:

- **Types**: Ensures all numeric fields are proper floats/ints, strings are trimmed
- **APR**: Converts percentage to decimal (e.g., 2.9% → 0.029)
- **Dates**: **OEM date format is UTC ISO-8601.** All date fields (e.g. `expirationDate`, `scrapedAt`) are serialized as UTC using ISO-8601 (e.g. `2026-01-15T10:30:00+00:00`). Use the shared `to_utc_iso8601()` helper in `offer_scrape/utils.py` for consistency.
- **Validation**: Only sends offers with valid data (lease needs monthly payment, financing needs APR, cash needs amount)
- **Offer Types**: Normalized to lowercase ("lease", "financing", "cash")

The API endpoint accepts the normalized data and stores it directly without additional transformation.

## Notes

- The website scraping method (`extract_offer_from_card()`) needs to be customized based on the actual GMC website structure
- Currently defaults to API method which is more reliable
- All scraped data is normalized and validated in Python before sending
- The API endpoint is generic and can be used by scrapers for other brands
- Duplicate offers are automatically skipped

