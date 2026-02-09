"""
Cron script to run both Lincoln and Land Rover offer scrapers
"""

import sys
import os
from datetime import datetime
from typing import Tuple

# Add the current directory to the path so we can import the scrapers
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lincoln import LincolnScraper
from landrover import LandRoverScraper


def run_lincoln_scraper(api_url: str = None) -> Tuple[bool, int]:
    """
    Run the Lincoln scraper
    
    Args:
        api_url: Optional API endpoint URL
        
    Returns:
        Tuple of (success: bool, offer_count: int)
    """
    print("\n" + "="*60)
    print("Starting Lincoln Scraper")
    print("="*60)
    
    try:
        scraper = LincolnScraper(api_url=api_url)
        offers = scraper.scrape()
        
        if not offers:
            print("\nNo Lincoln offers found")
            return True, 0
        
        print(f"\n=== Lincoln Scraping Summary ===")
        print(f"Total offers scraped: {len(offers)}")
        
        # Send to API
        success = scraper.send_to_api(offers)
        
        if success:
            print(f"✓ Successfully sent {len(offers)} Lincoln offers to API")
        else:
            print(f"✗ Failed to send Lincoln offers to API")
        
        return success, len(offers)
        
    except Exception as e:
        print(f"✗ Error running Lincoln scraper: {e}")
        import traceback
        traceback.print_exc()
        return False, 0


def run_landrover_scraper(api_url: str = None) -> Tuple[bool, int]:
    """
    Run the Land Rover scraper
    
    Args:
        api_url: Optional API endpoint URL
        
    Returns:
        Tuple of (success: bool, offer_count: int)
    """
    print("\n" + "="*60)
    print("Starting Land Rover Scraper")
    print("="*60)
    
    try:
        scraper = LandRoverScraper(api_url=api_url)
        offers = scraper.scrape_all(headless=True)
        
        if not offers:
            print("\nNo Land Rover offers found")
            return True, 0
        
        print(f"\n=== Land Rover Scraping Summary ===")
        print(f"Total offers scraped: {len(offers)}")
        
        # Send to API
        success = scraper.send_to_api(offers)
        
        if success:
            print(f"✓ Successfully sent {len(offers)} Land Rover offers to API")
        else:
            print(f"✗ Failed to send Land Rover offers to API")
        
        return success, len(offers)
        
    except Exception as e:
        print(f"✗ Error running Land Rover scraper: {e}")
        import traceback
        traceback.print_exc()
        return False, 0


def main():
    """Main entry point for cron script"""
    start_time = datetime.now()
    print(f"\n{'='*60}")
    print(f"Offer Scraping Cron Job Started")
    print(f"Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    
    # Get API URL from environment variable or use default
    api_url = os.getenv("OFFERS_SCRAPER_API_URL", "http://localhost:3000/api/incentives/scrape")
    
    # Run Lincoln scraper
    lincoln_success, lincoln_count = run_lincoln_scraper(api_url=api_url)
    
    # Run Land Rover scraper (runs independently, even if Lincoln failed)
    landrover_success, landrover_count = run_landrover_scraper(api_url=api_url)
    
    # Final summary
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    print(f"\n{'='*60}")
    print(f"Offer Scraping Cron Job Completed")
    print(f"Duration: {duration:.2f} seconds")
    print(f"{'='*60}")
    print(f"\nFinal Summary:")
    print(f"  Lincoln: {'✓' if lincoln_success else '✗'} - {lincoln_count} offers")
    print(f"  Land Rover: {'✓' if landrover_success else '✗'} - {landrover_count} offers")
    print(f"  Total offers: {lincoln_count + landrover_count}")
    print(f"{'='*60}\n")
    
    # Exit with error code if any scraper failed
    if not lincoln_success or not landrover_success:
        sys.exit(1)


if __name__ == "__main__":
    main()
